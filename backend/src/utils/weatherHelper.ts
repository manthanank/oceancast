import { apiCache } from './cache';

export interface WeatherData {
  current: {
    temp: number;
    windSpeed: number;
    windDirection: number;
    humidity: number;
    weatherCode: number;
    time: string;
  };
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    sunrise: string;
    sunset: string;
    precipitationSum: number;
  }>;
  hourly: Array<{
    time: string;
    temp: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    precipProb: number;
  }>;
}

export const fetchWeatherData = async (latitude: number, longitude: number): Promise<WeatherData> => {
  const cacheKey = `weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
  const cached = apiCache.get<WeatherData>(cacheKey);
  if (cached) return cached;

  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=auto`;

  try {
    const apiResponse = await fetch(openMeteoUrl);
    
    if (!apiResponse.ok) {
      console.log(`Weather API returned status ${apiResponse.status} for lat=${latitude}, lon=${longitude}. Falling back to default weather representation.`);
      const fallback = getLandLockedWeatherData();
      apiCache.set(cacheKey, fallback, 600000);
      return fallback;
    }

    const data = (await apiResponse.json()) as any;

    const result: WeatherData = {
      current: {
        temp: data.current.temperature_2m,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        humidity: data.current.relative_humidity_2m,
        weatherCode: data.current.weather_code,
        time: data.current.time,
      },
      daily: data.daily.time.map((date: string, idx: number) => ({
        date,
        tempMax: data.daily.temperature_2m_max[idx],
        tempMin: data.daily.temperature_2m_min[idx],
        sunrise: data.daily.sunrise[idx],
        sunset: data.daily.sunset[idx],
        precipitationSum: data.daily.precipitation_sum[idx],
      })),
      hourly: data.hourly.time.slice(0, 24).map((time: string, idx: number) => ({
        time,
        temp: data.hourly.temperature_2m[idx],
        humidity: data.hourly.relative_humidity_2m[idx],
        windSpeed: data.hourly.wind_speed_10m[idx],
        weatherCode: data.hourly.weather_code[idx],
        precipProb: data.hourly.precipitation_probability[idx],
      })),
    };

    apiCache.set(cacheKey, result, 600000);
    return result;
  } catch (error) {
    console.warn(`[Network Warning] Failed to connect to Weather API (lat=${latitude}, lon=${longitude}). Using local fallback:`, (error as Error).message);
    const fallback = getLandLockedWeatherData();
    apiCache.set(cacheKey, fallback, 600000);
    return fallback;
  }
};

function getLandLockedWeatherData(): WeatherData {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const futureDate = new Date(currentHour.getTime() + i * 60 * 60 * 1000);
    hourly.push({
      time: futureDate.toISOString().slice(0, 16),
      temp: 24, // moderate 24 degrees celsius default
      humidity: 60,
      windSpeed: 10,
      weatherCode: 1, // clear
      precipProb: 0,
    });
  }

  const daily = [];
  for (let i = 0; i < 7; i++) {
    const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    daily.push({
      date: futureDate.toISOString().slice(0, 10),
      tempMax: 26,
      tempMin: 18,
      sunrise: futureDate.toISOString().slice(0, 10) + 'T06:00',
      sunset: futureDate.toISOString().slice(0, 10) + 'T18:30',
      precipitationSum: 0,
    });
  }

  return {
    current: {
      temp: 24,
      windSpeed: 10,
      windDirection: 180,
      humidity: 60,
      weatherCode: 1,
      time: now.toISOString().slice(0, 16),
    },
    daily,
    hourly,
  };
}
