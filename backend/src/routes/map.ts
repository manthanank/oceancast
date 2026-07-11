import { Router, Request, Response } from 'express';

const router = Router();

interface GridPoint {
  lat: number;
  lon: number;
  windSpeed: number;
  windDir: number;
  waveHeight: number;
}

/**
 * GET /api/map/conditions?north=&south=&east=&west=
 * Samples a 4x4 grid of weather + marine conditions across a bounding box.
 * Used to render wind arrow overlays and fishing zone heat maps.
 */
router.get('/conditions', async (req: Request, res: Response): Promise<any> => {
  try {
    const { north, south, east, west } = req.query;

    if (!north || !south || !east || !west) {
      return res.status(400).json({ error: 'Bounding box parameters (north, south, east, west) are required' });
    }

    const n = Number(north);
    const s = Number(south);
    const e = Number(east);
    const w = Number(west);

    if (isNaN(n) || isNaN(s) || isNaN(e) || isNaN(w)) {
      return res.status(400).json({ error: 'All bounding box values must be valid numbers' });
    }

    // Generate a 4×4 grid of evenly-spaced sample points across the bounding box
    const GRID = 4;
    const latStep = (n - s) / (GRID - 1);
    const lonStep = (e - w) / (GRID - 1);

    const points: { lat: number; lon: number }[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        points.push({
          lat: parseFloat((s + row * latStep).toFixed(4)),
          lon: parseFloat((w + col * lonStep).toFixed(4)),
        });
      }
    }

    // Fetch weather + marine data for all 16 points in parallel
    const results: GridPoint[] = await Promise.all(
      points.map(async (pt): Promise<GridPoint> => {
        try {
          const [weatherRes, marineRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}` +
              `&current=wind_speed_10m,wind_direction_10m&format=json`
            ),
            fetch(
              `https://marine-api.open-meteo.com/v1/marine?latitude=${pt.lat}&longitude=${pt.lon}` +
              `&current=wave_height&format=json`
            ),
          ]);

          const weather = await weatherRes.json() as any;
          const marine = await marineRes.json() as any;

          return {
            lat: pt.lat,
            lon: pt.lon,
            windSpeed: weather?.current?.wind_speed_10m ?? 0,
            windDir: weather?.current?.wind_direction_10m ?? 0,
            waveHeight: marine?.current?.wave_height ?? 0,
          };
        } catch {
          // Return zeroed point on individual failure — don't break entire grid
          return { lat: pt.lat, lon: pt.lon, windSpeed: 0, windDir: 0, waveHeight: 0 };
        }
      })
    );

    return res.json(results);
  } catch (error) {
    console.error('Map conditions grid error:', error);
    return res.status(500).json({ error: 'Failed to fetch map condition grid data' });
  }
});

export default router;
