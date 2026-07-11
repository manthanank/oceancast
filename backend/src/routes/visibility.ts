import { Router, Request, Response } from 'express';
import { fetchWeatherData } from '../utils/weatherHelper';
import { fetchMarineData } from '../utils/marineHelper';
import { getTideData } from '../utils/tideHelper';

const router = Router();

interface VisibilityReport {
  date: string;
  visibilityScore: number; // 0 to 100
  visibilityMeters: number; // estimated visual depth
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  conditionsReason: string;
  bestDiveHour: string;
  hourlyVisibility: number[]; // 24 values
}

/**
 * GET /api/visibility?lat=&lon=&date=
 * Evaluates coastal water clarity and snorkel/dive visibility parameters.
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lon, date } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const targetDate = date ? new Date(String(date)) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Fetch weather, marine and tide data in parallel
    const [weather, marine, tides] = await Promise.all([
      fetchWeatherData(latitude, longitude).catch(() => null),
      fetchMarineData(latitude, longitude).catch(() => null),
      Promise.resolve(getTideData(latitude, longitude, dateStr)).catch(() => null),
    ]);

    const windSpeed = weather?.current?.windSpeed ?? 12.0;
    const waveHeight = marine?.current?.waveHeight ?? 0.8;
    const windDir = weather?.current?.windDirection ?? 180;

    // Estimate visibility score (0 to 100)
    // 1. Swell impact: Every 0.5m wave swell deducts 20% visibility
    let waveDeduction = waveHeight * 40;
    
    // 2. Wind chop impact: Every 5km/h wind speed deducts 8%
    let windDeduction = (windSpeed / 5) * 8;

    // 3. Shoreline onshore wind factor (simulated based on wind direction degree)
    // Onshore winds stir up sediment. Offshore winds flat the chop.
    // We mock the coast orientation based on coordinate values so it varies realistically.
    const coastAngle = (Math.abs(Math.sin(latitude) * 360)) % 360;
    const isOnshore = Math.abs(windDir - coastAngle) < 90 || Math.abs(windDir - coastAngle) > 270;
    const windDirDeduction = isOnshore ? 15 : 0;

    let baseScore = 100 - waveDeduction - windDeduction - windDirDeduction;

    // 4. Tide factor modifier: Slack High Tide adds visibility
    // Find closest high tide hour to current time
    const currentHour = targetDate.getHours();
    let isNearHighTide = false;
    let closestHighTideHour = 10; // default backup

    if (tides && tides.extremes) {
      let minDiff = 24;
      tides.extremes.forEach(e => {
        if (e.type === 'High') {
          const tParts = e.time.split('T')[1]?.split(':');
          if (tParts) {
            const h = Number(tParts[0]);
            const diff = Math.abs(currentHour - h);
            if (diff < minDiff) {
              minDiff = diff;
              closestHighTideHour = h;
            }
            if (diff <= 1.5) {
              isNearHighTide = true;
            }
          }
        }
      });
    }

    if (isNearHighTide) {
      baseScore += 12; // tide boost
    }

    const finalScore = Math.max(5, Math.min(100, Math.round(baseScore)));

    // Estimate visual depth (100% score = 18 meters visibility)
    const visibilityMeters = parseFloat(( (finalScore / 100) * 18 ).toFixed(1));

    // Rating
    let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Good';
    let reason = 'Stable conditions with clear waters. Good snorkeling.';

    if (finalScore >= 75) {
      rating = 'Excellent';
      reason = 'Calm seas and low wind. Crystal clear waters. Perfect for Scuba & Snorkeling!';
    } else if (finalScore >= 50) {
      rating = 'Good';
      reason = 'Minor waves. Decent underwater visibility. Suitable for most spots.';
    } else if (finalScore >= 25) {
      rating = 'Fair';
      reason = 'Choppy surface waves stirring up sediment. Visual clarity is restricted.';
    } else {
      rating = 'Poor';
      reason = '🚨 Muddy waters & rough surf. Avoid diving. Poor visual range.';
    }

    // Generate hourly visibility indices (24 hours)
    const hourlyVisibility: number[] = [];
    for (let h = 0; h < 24; h++) {
      let hScore = baseScore;
      
      // Hourly tide alignment check
      let hourlyNearHigh = false;
      if (tides && tides.extremes) {
        tides.extremes.forEach(e => {
          if (e.type === 'High') {
            const tParts = e.time.split('T')[1]?.split(':');
            if (tParts) {
              const highH = Number(tParts[0]);
              if (Math.abs(h - highH) <= 1.0) {
                hourlyNearHigh = true;
              }
            }
          }
        });
      }

      if (hourlyNearHigh) {
        hScore += 15;
      } else {
        hScore -= 5; // low tide reduction
      }

      hourlyVisibility.push(Math.max(5, Math.min(100, Math.round(hScore))));
    }

    const report: VisibilityReport = {
      date: dateStr,
      visibilityScore: finalScore,
      visibilityMeters,
      rating,
      conditionsReason: reason,
      bestDiveHour: `${closestHighTideHour % 12 === 0 ? 12 : closestHighTideHour % 12}:00 ${closestHighTideHour >= 12 ? 'PM' : 'AM'} (Slack High Tide)`,
      hourlyVisibility
    };

    return res.json(report);
  } catch (error) {
    console.error('Visibility calculations error:', error);
    return res.status(500).json({ error: 'Failed to calculate marine clarity index' });
  }
});

export default router;
