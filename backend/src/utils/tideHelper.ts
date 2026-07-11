export interface TideEvent {
  time: string;
  type: 'High' | 'Low';
  height: number;
}

export interface TideData {
  extremes: TideEvent[];
  hourly: Array<{ time: string; height: number }>;
}

export const getTideData = (latitude: number, longitude: number, dateStr?: string): TideData => {
  const targetDateStr = dateStr || new Date().toISOString().slice(0, 10);
  const targetDate = new Date(targetDateStr);

  const dateSeed = targetDate.getDate() + targetDate.getMonth() * 31 + (targetDate.getFullYear() - 2020) * 365;
  const seed = Math.sin(latitude * 0.017) * Math.cos(longitude * 0.017) * 100 + dateSeed;
  const absSeed = Math.abs(seed);

  const baseAmplitude = 0.3 + (absSeed % 2.2); 
  const diurnalInequality = 0.1 + ((absSeed * 7) % 0.4);
  const basePhase = (longitude / 15.0 + (absSeed % 12.42)) % 12.42;

  const hourly: Array<{ time: string; height: number }> = [];
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const getTideHeightAtHour = (t: number): number => {
    const hM2 = baseAmplitude * Math.cos((2 * Math.PI * (t - basePhase)) / 12.42);
    const hK1 = (baseAmplitude * diurnalInequality) * Math.cos((2 * Math.PI * (t - basePhase - 3.0)) / 24.0);
    return hM2 + hK1;
  };

  for (let hour = 0; hour <= 24; hour++) {
    const height = Number(getTideHeightAtHour(hour).toFixed(2));
    const timeStr = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000).toISOString().slice(0, 16);
    hourly.push({ time: timeStr, height });
  }

  const extremes: TideEvent[] = [];
  let previousSlope = getTideHeightAtHour(0.01) - getTideHeightAtHour(0.0);

  for (let t = 0.1; t <= 24.0; t += 0.1) {
    const height = getTideHeightAtHour(t);
    const nextHeight = getTideHeightAtHour(t + 0.1);
    const currentSlope = nextHeight - height;

    if (Math.sign(previousSlope) !== Math.sign(currentSlope) && previousSlope !== 0 && currentSlope !== 0) {
      const type = previousSlope > 0 ? 'High' : 'Low';
      const eventTime = new Date(startOfDay.getTime() + t * 60 * 60 * 1000).toISOString().slice(0, 16);
      extremes.push({
        time: eventTime,
        type,
        height: Number(height.toFixed(2)),
      });
    }
    previousSlope = currentSlope;
  }

  return { extremes, hourly };
};
