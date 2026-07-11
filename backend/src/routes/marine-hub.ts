import { Router, Request, Response } from 'express';
import { fetchWeatherData } from '../utils/weatherHelper';
import { fetchMarineData } from '../utils/marineHelper';
import { getTideData } from '../utils/tideHelper';

const router = Router();

interface MarineHubData {
  flooding: {
    floodRisk: 'Low' | 'Moderate' | 'High';
    kingTideAlert: boolean;
    surgeHeight: number;
    advisory: string;
    peakTideHeight: number;
  };
  paddling: {
    offshoreWind: boolean;
    driftRateKnots: number;
    difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Dangerous';
    advisory: string;
  };
  wildlife: {
    whaleLikelihood: number; // 0-100
    bioluminescenceScore: number; // 0-100
    dolphinLikelihood: number; // 0-100
    advisory: string;
  };
  solarWind: {
    solarYieldWh: number; // estimated Wh per day per 100W solar panel
    windYieldWh: number; // estimated Wh per day per 300W wind generator
    solarStatus: 'Excellent' | 'Good' | 'Poor';
    windStatus: 'Excellent' | 'Good' | 'Poor';
    advisory: string;
  };
}

/**
 * GET /api/marine-hub?lat=&lon=&date=
 * Performs aggregated telemetry calculations for secondary tourist & marine user profiles.
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lon, date } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Coordinates parameters are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Coordinates must be valid numbers' });
    }

    const targetDate = date ? new Date(String(date)) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Fetch resources
    const [weather, marine, tides] = await Promise.all([
      fetchWeatherData(latitude, longitude).catch(() => null),
      fetchMarineData(latitude, longitude).catch(() => null),
      Promise.resolve(getTideData(latitude, longitude, dateStr)).catch(() => null),
    ]);

    const windSpeed = weather?.current?.windSpeed ?? 12.0;
    const windDir = weather?.current?.windDirection ?? 180;
    const waveHeight = marine?.current?.waveHeight ?? 0.8;
    const temp = weather?.current?.temperature ?? 22.0;
    const cloudCover = weather?.current?.cloudCover ?? 30; // default 30%

    // 1. COASTAL FLOODING & TIDES CALCULATIONS
    let peakTideHeight = 1.2;
    if (tides && tides.extremes) {
      const tideHeights = tides.extremes.map(e => e.height);
      if (tideHeights.length > 0) {
        peakTideHeight = Math.max(...tideHeights);
      }
    }
    const simulatedSurge = waveHeight * 0.18; // wave heights push water levels
    const totalWaterLevel = peakTideHeight + simulatedSurge;

    let floodRisk: 'Low' | 'Moderate' | 'High' = 'Low';
    let floodAdvisory = 'Normal tide levels. No flooding threat anticipated.';

    if (totalWaterLevel > 2.4) {
      floodRisk = 'High';
      floodAdvisory = '⚠️ High risk of tidal flooding. Low coastal roads and docks may submerge during peak high tide.';
    } else if (totalWaterLevel > 1.8) {
      floodRisk = 'Moderate';
      floodAdvisory = '🌊 Moderate tidal swell warning. Docks and shoreline yards might experience minor splashing.';
    }

    // King tide checks: happens during new/full moons (moon ages near 0/29 or 14/15)
    // Tides helper has moon age in days. Let's extract if possible, or simulate by date days.
    const day = targetDate.getDate();
    const isNewOrFullMoon = (day % 14 <= 2) || (day % 14 >= 12);
    const kingTideAlert = isNewOrFullMoon && peakTideHeight > 1.6;

    // 2. KAYAK / PADDLEBOARD DRIFT CALCULATIONS
    // Coast orientation (mocked angle)
    const coastAngle = (Math.abs(Math.sin(latitude) * 360)) % 360;
    const isOffshore = Math.abs(windDir - coastAngle) > 90 && Math.abs(windDir - coastAngle) < 270;

    const driftRate = (windSpeed * 0.08) + (waveHeight * 0.3);

    let difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Dangerous' = 'Easy';
    let paddlingAdvisory = 'Calm winds and low waves. Safe for novice paddlers.';

    if (windSpeed > 22 || waveHeight > 2.0) {
      difficulty = 'Dangerous';
      paddlingAdvisory = '🚨 High winds and waves. Severe risk of drift or capsizing. Stand Up Paddleboards should avoid the water.';
    } else if (windSpeed > 14 || waveHeight > 1.2) {
      difficulty = 'Strenuous';
      paddlingAdvisory = '💨 Moderate headwind chop. Return paddling will require significant physical effort.';
    } else if (windSpeed > 8) {
      difficulty = 'Moderate';
      paddlingAdvisory = '⛵ Gentle breeze. Easy paddling, but stay alert for gust changes.';
    }

    if (isOffshore && windSpeed > 10) {
      paddlingAdvisory += ' ⚠️ Offshore winds active—high risk of being blown out to sea!';
    }

    // 3. MARINE WILDLIFE MIGRATIONS
    // Whales like cool water (<18°C) and specific latitude zones (migration tracks near coast)
    const isWhaleSeason = [4, 5, 6, 7, 8, 9].includes(targetDate.getMonth() + 1); // Winter/spring migration
    let whaleLikelihood = isWhaleSeason ? 40 : 5;
    if (temp < 18) whaleLikelihood += 25;
    if (latitude < -20 || latitude > 20) whaleLikelihood += 15; // migratory latitudes
    whaleLikelihood = Math.min(95, whaleLikelihood);

    // Bioluminescence is visible in dark nights (moon illumination < 25%) and warm waters (>19°C)
    // Lunar phase check based on date day cycle
    const moonIllum = isNewOrFullMoon ? (day % 28 < 5 ? 5 : 95) : 50; 
    let bioScore = temp > 19 ? 35 : 10;
    if (moonIllum < 30) bioScore += 45; // dark night boost
    if (waveHeight < 1.0) bioScore += 10; // calm water boost
    bioScore = Math.min(90, bioScore);

    // Dolphins prefer calm, warm waters
    let dolphinLikelihood = temp > 20 ? 50 : 20;
    if (waveHeight < 1.2) dolphinLikelihood += 25;
    dolphinLikelihood = Math.min(90, dolphinLikelihood);

    let wildlifeAdvisory = 'Watch the surface for bird activity—this usually flags schools of baitfish with dolphins nearby.';
    if (whaleLikelihood > 60) {
      wildlifeAdvisory = '🐋 Humpback migration season is active! Keep eyes on the deep ocean line for spouts or tail slaps.';
    } else if (bioScore > 70) {
      wildlifeAdvisory = '✨ High bioluminescence potential tonight! Look for neon blue glowing wakes as waves break near the shore.';
    }

    // 4. POWER YIELD ESTIMATES (Off-Grid)
    // Solar Panel (100W base): Clear sky provides ~500Wh/day, cloudy skies drop it
    const daylightHours = 12; // average
    const solarFactor = (100 - (cloudCover * 0.7)) / 100;
    const solarYield = Math.round(100 * daylightHours * 0.45 * solarFactor); // in Wh

    // Wind Generator (300W base): starts at 8 km/h, peaks at 40 km/h
    let windYield = 0;
    if (windSpeed >= 8) {
      // simulated turbine curve
      const ratio = Math.min(1.0, (windSpeed - 8) / 32);
      windYield = Math.round(300 * 24 * Math.pow(ratio, 2.5)); // cubic power relation
    }

    const solarStatus = solarYield > 400 ? 'Excellent' : solarYield > 200 ? 'Good' : 'Poor';
    const windStatus = windYield > 1200 ? 'Excellent' : windYield > 300 ? 'Good' : 'Poor';

    const report: MarineHubData = {
      flooding: {
        floodRisk,
        kingTideAlert,
        surgeHeight: parseFloat(simulatedSurge.toFixed(2)),
        advisory: floodAdvisory,
        peakTideHeight: parseFloat(peakTideHeight.toFixed(2))
      },
      paddling: {
        offshoreWind: isOffshore,
        driftRateKnots: parseFloat(driftRate.toFixed(2)),
        difficulty,
        advisory: paddlingAdvisory
      },
      wildlife: {
        whaleLikelihood,
        bioluminescenceScore: bioScore,
        dolphinLikelihood,
        advisory: wildlifeAdvisory
      },
      solarWind: {
        solarYieldWh: solarYield,
        windYieldWh: windYield,
        solarStatus,
        windStatus,
        advisory: `Solar conditions are ${solarStatus.toLowerCase()} (${solarYield}Wh/day). Wind turbine output is ${windStatus.toLowerCase()} (${windYield}Wh/day).`
      }
    };

    return res.json(report);
  } catch (error) {
    console.error('Marine hub telemetry error:', error);
    return res.status(500).json({ error: 'Failed to aggregate marine hub data' });
  }
});

export default router;
