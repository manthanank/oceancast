export interface MarineData {
  current: {
    waveHeight: number;
    waveDirection: number;
    wavePeriod: number;
    time: string;
  };
  hourly: Array<{
    time: string;
    waveHeight: number;
    waveDirection: number;
    wavePeriod: number;
  }>;
}

export const fetchMarineData = async (latitude: number, longitude: number): Promise<MarineData> => {
  const openMeteoMarineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=wave_height,wave_direction,wave_period&hourly=wave_height,wave_direction,wave_period&timezone=auto`;

  const apiResponse = await fetch(openMeteoMarineUrl);
  
  if (!apiResponse.ok) {
    console.log(`Marine API returned status ${apiResponse.status} for lat=${latitude}, lon=${longitude}. Falling back to flat water representation.`);
    return getLandLockedMarineData();
  }

  const data = (await apiResponse.json()) as any;

  if (!data.current || data.current.wave_height === null || data.current.wave_height === undefined) {
    return getLandLockedMarineData();
  }

  return {
    current: {
      waveHeight: data.current.wave_height || 0,
      waveDirection: data.current.wave_direction || 0,
      wavePeriod: data.current.wave_period || 0,
      time: data.current.time || new Date().toISOString(),
    },
    hourly: (data.hourly?.time || []).slice(0, 24).map((time: string, idx: number) => ({
      time,
      waveHeight: data.hourly.wave_height[idx] || 0,
      waveDirection: data.hourly.wave_direction[idx] || 0,
      wavePeriod: data.hourly.wave_period[idx] || 0,
    })),
  };
};

function getLandLockedMarineData(): MarineData {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const futureDate = new Date(currentHour.getTime() + i * 60 * 60 * 1000);
    hourly.push({
      time: futureDate.toISOString().slice(0, 16),
      waveHeight: 0,
      waveDirection: 0,
      wavePeriod: 0,
    });
  }

  return {
    current: {
      waveHeight: 0,
      waveDirection: 0,
      wavePeriod: 0,
      time: now.toISOString().slice(0, 16),
    },
    hourly,
  };
}
