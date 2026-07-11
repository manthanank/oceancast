import { Router, Request, Response } from 'express';
import { fetchWeatherData } from '../utils/weatherHelper';

const router = Router();

// Fetch weather data for latitude/longitude
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lon } = req.query;

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180' });
    }

    const weatherData = await fetchWeatherData(latitude, longitude);
    return res.json(weatherData);
  } catch (error) {
    console.error('Weather routing error:', error);
    return res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
});

export default router;
