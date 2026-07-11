import { Router, Response } from 'express';
import { Location } from '../models/Location';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Protect all location routes
router.use(authenticateToken as any);

// Get all saved locations for the user
router.get('/', async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const locations = await Location.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return res.status(500).json({ error: 'Server error retrieving locations' });
  }
});

// Save a new location
router.post('/', async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name, lat, lon } = req.body;

    if (!name || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Please provide a name, latitude, and longitude' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Invalid latitude. Must be between -90 and 90' });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid longitude. Must be between -180 and 180' });
    }

    // Check if location coordinates already saved by user
    const existing = await Location.findOne({ userId: req.userId, lat: latitude, lon: longitude });
    if (existing) {
      return res.status(400).json({ error: 'This location is already in your list' });
    }

    const newLocation = new Location({
      userId: req.userId,
      name,
      lat: latitude,
      lon: longitude,
    });

    await newLocation.save();
    return res.status(201).json(newLocation);
  } catch (error: any) {
    console.error('Error creating location:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This location is already saved' });
    }
    return res.status(500).json({ error: 'Server error saving location' });
  }
});

// Delete a saved location
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const locationId = req.params.id;
    
    // Find location and verify user ownership
    const location = await Location.findOne({ _id: locationId, userId: req.userId });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found or unauthorized' });
    }

    await Location.deleteOne({ _id: locationId });
    return res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    return res.status(500).json({ error: 'Server error deleting location' });
  }
});

export default router;
