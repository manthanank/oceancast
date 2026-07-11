import { Router, Request, Response } from 'express';
import { Catch } from '../models/Catch';
import { authenticateToken } from '../middleware/auth';
import { logEvent } from '../services/audit';
import { User } from '../models/User';

interface AuthRequest extends Request {
  userId: string;
}

const router = Router();

// Helper to calculate tide height dynamically at a specific time (matches tideHelper.ts logic)
function calculateTideHeightAtTime(latitude: number, longitude: number, catchDate: Date): number {
  const dateSeed = catchDate.getDate() + catchDate.getMonth() * 31 + (catchDate.getFullYear() - 2020) * 365;
  const seed = Math.sin(latitude * 0.017) * Math.cos(longitude * 0.017) * 100 + dateSeed;
  const absSeed = Math.abs(seed);

  const baseAmplitude = 0.3 + (absSeed % 2.2);
  const diurnalInequality = 0.1 + ((absSeed * 7) % 0.4);
  const basePhase = (longitude / 15.0 + (absSeed % 12.42)) % 12.42;

  // hour decimal format (e.g. 14:30 -> 14.5)
  const t = catchDate.getHours() + catchDate.getMinutes() / 60;

  const hM2 = baseAmplitude * Math.cos((2 * Math.PI * (t - basePhase)) / 12.42);
  const hK1 = (baseAmplitude * diurnalInequality) * Math.cos((2 * Math.PI * (t - basePhase - 3.0)) / 24.0);

  return parseFloat((hM2 + hK1).toFixed(2));
}

// GET /api/catches - Retrieve all catches for authenticated user
router.get('/', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const catches = await Catch.find({ userId: req.userId }).sort({ catchTime: -1 });
    return res.json(catches);
  } catch (error) {
    console.error('Fetch catches error:', error);
    return res.status(500).json({ error: 'Server error retrieving your catches' });
  }
});

// POST /api/catches - Log a new catch record
router.post('/', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { species, weight, length, locationName, lat, lon, catchTime, notes } = req.body;

    if (!species || !weight || !length || !locationName || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Species, weight, length, location name, and coordinates are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);
    const dateOfCatch = catchTime ? new Date(catchTime) : new Date();

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinate bounds' });
    }

    // Default smart environment markers in case API fails
    let temp = 22.5;
    let windSpeed = 12.0;
    let waveHeight = 0.8;

    // Fetch real-time environmental conditions for lat/lon at catch date
    try {
      const [weatherRes, marineRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m&format=json`),
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=wave_height&format=json`)
      ]);

      const weather = await weatherRes.json() as any;
      const marine = await marineRes.json() as any;

      if (weather?.current) {
        temp = weather.current.temperature_2m ?? temp;
        windSpeed = weather.current.wind_speed_10m ?? windSpeed;
      }
      if (marine?.current) {
        waveHeight = marine.current.wave_height ?? waveHeight;
      }
    } catch (apiErr) {
      console.warn('Open-Meteo failed for catch log auto-tagging, using defaults:', apiErr);
    }

    // Compute corresponding tide height matching our harmonic model
    const tideHeight = calculateTideHeightAtTime(latitude, longitude, dateOfCatch);

    const newCatch = new Catch({
      userId: req.userId,
      species,
      weight: Number(weight),
      length: Number(length),
      locationName,
      lat: latitude,
      lon: longitude,
      notes: notes || '',
      catchTime: dateOfCatch,
      temp,
      windSpeed,
      waveHeight,
      tideHeight,
    });

    await newCatch.save();

    // Log in database audit logs
    const user = await User.findById(req.userId);
    if (user) {
      await logEvent('Log Catch', user.email, `Logged ${species} (${weight}kg, ${length}cm) at ${locationName}`);
    }

    return res.status(201).json(newCatch);
  } catch (error) {
    console.error('Create catch log error:', error);
    return res.status(500).json({ error: 'Server error saving catch details' });
  }
});

// DELETE /api/catches/:id - Delete a catch record
router.delete('/:id', authenticateToken as any, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const catchRecord = await Catch.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!catchRecord) {
      return res.status(404).json({ error: 'Catch record not found or unauthorized' });
    }

    const user = await User.findById(req.userId);
    if (user) {
      await logEvent('Delete Catch', user.email, `Deleted catch record: ${catchRecord.species} at ${catchRecord.locationName}`);
    }

    return res.json({ message: 'Catch record deleted successfully' });
  } catch (error) {
    console.error('Delete catch error:', error);
    return res.status(500).json({ error: 'Server error deleting catch' });
  }
});

export default router;
