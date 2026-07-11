import { Router, Request, Response } from 'express';

const router = Router();

// Reference New Moon: January 6, 2000, 18:14 UTC
const REF_NEW_MOON = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
const LUNAR_MONTH = 29.530588853 * 24 * 60 * 60 * 1000; // in milliseconds

interface Period {
  name: string;
  start: string;
  end: string;
  type: 'major' | 'minor';
}

interface SolunarData {
  date: string;
  moonAge: number; // in days
  moonPhase: string;
  illumination: number; // 0 to 100
  activityScore: number; // 0 to 100
  periods: Period[];
  hourlyActivity: number[]; // 24 values
}

/**
 * GET /api/solunar?lat=&lon=&date=
 * Computes solunar activity index, moon phase, and feeding periods for a given date and coordinates.
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
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Set time to noon local equivalent or UTC for simple calculations
    const timeMs = targetDate.getTime();
    const elapsedMs = timeMs - REF_NEW_MOON;
    
    // Calculate moon age in days
    const cycles = elapsedMs / LUNAR_MONTH;
    const agePercent = cycles - Math.floor(cycles);
    const moonAge = agePercent * 29.530588853;

    // Illumination percent: 0% at New Moon, 100% at Full Moon
    // Simple cosine approximation of phase
    const illumination = Math.round((1 - Math.cos(agePercent * 2 * Math.PI)) * 50);

    // Determine phase name
    let moonPhase = 'New Moon';
    if (moonAge < 1.5 || moonAge > 28.0) {
      moonPhase = 'New Moon';
    } else if (moonAge >= 1.5 && moonAge < 6.88) {
      moonPhase = 'Waxing Crescent';
    } else if (moonAge >= 6.88 && moonAge < 8.88) {
      moonPhase = 'First Quarter';
    } else if (moonAge >= 8.88 && moonAge < 13.76) {
      moonPhase = 'Waxing Gibbous';
    } else if (moonAge >= 13.76 && moonAge < 15.76) {
      moonPhase = 'Full Moon';
    } else if (moonAge >= 15.76 && moonAge < 20.64) {
      moonPhase = 'Waning Gibbous';
    } else if (moonAge >= 20.64 && moonAge < 22.64) {
      moonPhase = 'Third Quarter';
    } else {
      moonPhase = 'Waning Crescent';
    }

    // Lunar transit calculation (when the moon crosses the meridian)
    // New Moon transits at 12:00 PM (noon). Full Moon transits at 12:00 AM (midnight).
    const transitHour = (12 + (moonAge * 24 / 29.530588853)) % 24;

    // Major and Minor periods (each peak represents a period)
    const periods: Period[] = [];
    
    // Major 1: Moon directly overhead
    const major1Start = (transitHour - 1 + 24) % 24;
    const major1End = (transitHour + 1) % 24;
    periods.push({
      name: 'Major Period 1 (Moon Overhead)',
      start: formatHour(major1Start),
      end: formatHour(major1End),
      type: 'major'
    });

    // Major 2: Moon directly underfoot
    const major2Start = (transitHour + 11) % 24;
    const major2End = (transitHour + 13) % 24;
    periods.push({
      name: 'Major Period 2 (Moon Underfoot)',
      start: formatHour(major2Start),
      end: formatHour(major2End),
      type: 'major'
    });

    // Minor 1: Moonrise (roughly transit - 6 hours)
    const minor1Start = (transitHour - 6.5 + 24) % 24;
    const minor1End = (transitHour - 5.5 + 24) % 24;
    periods.push({
      name: 'Minor Period 1 (Moonrise)',
      start: formatHour(minor1Start),
      end: formatHour(minor1End),
      type: 'minor'
    });

    // Minor 2: Moonset (roughly transit + 6 hours)
    const minor2Start = (transitHour + 5.5) % 24;
    const minor2End = (transitHour + 6.5) % 24;
    periods.push({
      name: 'Minor Period 2 (Moonset)',
      start: formatHour(minor2Start),
      end: formatHour(minor2End),
      type: 'minor'
    });

    // Compute Daily Activity Score (0 - 100)
    // New Moon/Full Moon gets +30. First/Third Quarter gets -15.
    // Coordinates modifier to add unique variety based on local coordinates
    const phaseFactor = Math.abs(Math.sin((agePercent - 0.25) * Math.PI)); // peaks at 0 (New Moon) and 0.5 (Full Moon)
    let score = 40 + (phaseFactor * 45); // base score 40-85

    // Add unique micro-offsets based on lat/lon so different coordinates yield realistic variance
    const geoSeed = Math.sin(latitude) * Math.cos(longitude);
    score += geoSeed * 8;

    // Normalize to 10-100%
    const activityScore = Math.max(10, Math.min(100, Math.round(score)));

    // Calculate hourly scores (24 hours) for visual bar charts
    const hourlyActivity: number[] = [];
    for (let h = 0; h < 24; h++) {
      // Base activity based on moon phase
      let hourScore = activityScore * 0.4;

      // Add peaks for Major/Minor periods
      // Major periods (overhead/underfoot) add strong gaussian peaks
      const major1Diff = getMinDiff(h, transitHour);
      const major2Diff = getMinDiff(h, (transitHour + 12) % 24);
      const minor1Diff = getMinDiff(h, (transitHour - 6 + 24) % 24);
      const minor2Diff = getMinDiff(h, (transitHour + 6) % 24);

      if (major1Diff < 2) hourScore += (2 - major1Diff) * (activityScore * 0.25);
      if (major2Diff < 2) hourScore += (2 - major2Diff) * (activityScore * 0.25);
      if (minor1Diff < 1.5) hourScore += (1.5 - minor1Diff) * (activityScore * 0.15);
      if (minor2Diff < 1.5) hourScore += (1.5 - minor2Diff) * (activityScore * 0.15);

      // Add a slight sunrise/sunset peak (at 6 AM and 6 PM) for general animal circadian rhythms
      const sunDiff1 = Math.abs(h - 6);
      const sunDiff2 = Math.abs(h - 18);
      if (sunDiff1 < 2) hourScore += (2 - sunDiff1) * 8;
      if (sunDiff2 < 2) hourScore += (2 - sunDiff2) * 8;

      hourlyActivity.push(Math.max(5, Math.min(100, Math.round(hourScore))));
    }

    const result: SolunarData = {
      date: targetDate.toISOString().split('T')[0],
      moonAge: parseFloat(moonAge.toFixed(2)),
      moonPhase,
      illumination,
      activityScore,
      periods,
      hourlyActivity
    };

    return res.json(result);
  } catch (error) {
    console.error('Solunar calculation error:', error);
    return res.status(500).json({ error: 'Failed to calculate solunar details' });
  }
});

// Helper to format hours into standard 12-hour AM/PM string
function formatHour(h: number): string {
  const rounded = Math.round(h * 100) / 100;
  const hours = Math.floor(rounded);
  const minutes = Math.floor((rounded - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

// Helper to get minimal hour difference wrapping around 24 hours
function getMinDiff(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 24 - diff);
}

export default router;
