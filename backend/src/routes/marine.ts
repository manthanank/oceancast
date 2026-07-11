import { Router, Request, Response } from 'express';
import { fetchMarineData } from '../utils/marineHelper';

const router = Router();

// Fetch marine wave data
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lon } = req.query;

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const marineData = await fetchMarineData(latitude, longitude);
    return res.json(marineData);
  } catch (error) {
    console.error('Marine routing error:', error);
    return res.status(500).json({ error: 'Failed to fetch marine data.' });
  }
});

export default router;
