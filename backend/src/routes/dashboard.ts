import { Router, Request, Response } from 'express';
import { fetchWeatherData } from '../utils/weatherHelper';
import { fetchMarineData } from '../utils/marineHelper';
import { getTideData } from '../utils/tideHelper';

const router = Router();

// Aggregate dashboard data
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lon, date } = req.query;

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const targetDateStr = (date as string) || new Date().toISOString().slice(0, 10);

    // Call all data helpers in parallel
    const [weather, marine, tides] = await Promise.all([
      fetchWeatherData(latitude, longitude),
      fetchMarineData(latitude, longitude),
      Promise.resolve(getTideData(latitude, longitude, targetDateStr)), // Tide helper is synchronous
    ]);

    return res.json({
      weather,
      marine,
      tides,
    });
  } catch (error: any) {
    console.error('Dashboard aggregation error:', error);
    return res.status(500).json({ error: 'Failed to retrieve dashboard data: ' + error.message });
  }
});

export default router;
