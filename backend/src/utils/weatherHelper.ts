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
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=auto`;

  const apiResponse = await fetch(openMeteoUrl);
  
  if (!apiResponse.ok) {
    throw new Error(`Open-Meteo API returned status ${apiResponse.status}`);
  }

  const data = (await apiResponse.json()) as any;

  return {
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
};
