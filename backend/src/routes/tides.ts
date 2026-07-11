import { Router, Request, Response } from 'express';
import { getTideData } from '../utils/tideHelper';

const router = Router();

// Get deterministic tide forecast
router.get('/', (req: Request, res: Response): any => {
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

    const dateStr = (date as string) || new Date().toISOString().slice(0, 10);
    const tideData = getTideData(latitude, longitude, dateStr);
    
    return res.json(tideData);
  } catch (error) {
    console.error('Tides routing error:', error);
    return res.status(500).json({ error: 'Failed to retrieve tide forecast.' });
  }
});

export default router;
