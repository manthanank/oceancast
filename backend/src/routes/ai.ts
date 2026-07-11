import { Router, Request, Response } from 'express';
import { fetchWeatherData } from '../utils/weatherHelper';
import { fetchMarineData } from '../utils/marineHelper';
import { getTideData } from '../utils/tideHelper';
import { GeminiService } from '../services/gemini';

const router = Router();
const geminiService = new GeminiService();

// Context-aware AI Chat endpoint
router.post('/chat', async (req: Request, res: Response): Promise<any> => {
  try {
    const { message, lat, lon } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Retrieve weather and marine data in parallel to compile AI context
    let weatherContext = `Location Coordinates: ${latitude}, ${longitude}\n`;
    try {
      const [weather, marine, tides] = await Promise.all([
        fetchWeatherData(latitude, longitude).catch(() => null),
        fetchMarineData(latitude, longitude).catch(() => null),
        Promise.resolve(getTideData(latitude, longitude)).catch(() => null),
      ]);

      if (weather) {
        weatherContext += `Temperature: ${weather.current.temp}°C\n`;
        weatherContext += `Wind Speed: ${weather.current.windSpeed} km/h\n`;
        weatherContext += `Wind Direction: ${weather.current.windDirection}°\n`;
        weatherContext += `Humidity: ${weather.current.humidity}%\n`;
        weatherContext += `Weather Code: ${weather.current.weatherCode}\n`;
      }
      if (marine) {
        weatherContext += `Wave Height: ${marine.current.waveHeight}m\n`;
        weatherContext += `Wave Period: ${marine.current.wavePeriod}s\n`;
        weatherContext += `Wave Direction: ${marine.current.waveDirection}°\n`;
      }
      if (tides && tides.extremes && tides.extremes.length > 0) {
        const tidesList = tides.extremes
          .map(e => `  - ${e.type} Tide height ${e.height}m at time ${e.time.split('T')[1] || e.time}`)
          .join('\n');
        weatherContext += `Tides Info:\n${tidesList}\n`;
      }
    } catch (err) {
      console.warn('Could not compile local conditions context for Gemini:', err);
    }

    // Call the Gemini AI service
    const reply = await geminiService.askQuestion(message, weatherContext);
    
    return res.json({ reply });
  } catch (error) {
    console.error('AI chat handler error:', error);
    return res.status(500).json({ error: 'Unable to get AI response. Try again.' });
  }
});

// POST /api/ai/angler-report - Generate a structured daily angler briefing
router.post('/angler-report', async (req: Request, res: Response): Promise<any> => {
  try {
    const { locationName, lat, lon } = req.body;

    if (!locationName || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Location name, latitude (lat), and longitude (lon) are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinate bounds' });
    }

    // Retrieve weather and marine data in parallel to compile AI context
    let weatherContext = `Location Coordinates: ${latitude}, ${longitude}\n`;
    try {
      const [weather, marine, tides] = await Promise.all([
        fetchWeatherData(latitude, longitude).catch(() => null),
        fetchMarineData(latitude, longitude).catch(() => null),
        Promise.resolve(getTideData(latitude, longitude)).catch(() => null),
      ]);

      if (weather) {
        weatherContext += `Temperature: ${weather.current.temp}°C\n`;
        weatherContext += `Wind Speed: ${weather.current.windSpeed} km/h\n`;
        weatherContext += `Wind Direction: ${weather.current.windDirection}°\n`;
        weatherContext += `Humidity: ${weather.current.humidity}%\n`;
        weatherContext += `Weather Code: ${weather.current.weatherCode}\n`;
      }
      if (marine) {
        weatherContext += `Wave Height: ${marine.current.waveHeight}m\n`;
        weatherContext += `Wave Period: ${marine.current.wavePeriod}s\n`;
        weatherContext += `Wave Direction: ${marine.current.waveDirection}°\n`;
      }
      if (tides && tides.extremes && tides.extremes.length > 0) {
        const tidesList = tides.extremes
          .map(e => `  - ${e.type} Tide height ${e.height}m at time ${e.time.split('T')[1] || e.time}`)
          .join('\n');
        weatherContext += `Tides Info:\n${tidesList}\n`;
      }
    } catch (err) {
      console.warn('Could not compile local conditions context for Angler Report:', err);
    }

    // Call the Gemini AI service report generator
    const report = await geminiService.generateAnglerReport(locationName, weatherContext);
    
    return res.json({ report });
  } catch (error) {
    console.error('AI Angler Report handler error:', error);
    return res.status(500).json({ error: 'Unable to generate Angler Report. Try again.' });
  }
});

export default router;
