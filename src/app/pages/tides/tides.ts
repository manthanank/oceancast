import { Component, ChangeDetectionStrategy, inject, signal, effect, computed } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { LocationService } from '../../services/location';
import { WeatherService } from '../../services/weather';
import { SettingsService } from '../../services/settings';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-tides',
  imports: [Spinner],
  templateUrl: './tides.html',
  styleUrl: './tides.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tides {
  public locationService = inject(LocationService);
  private weatherService = inject(WeatherService);
  public settingsService = inject(SettingsService);
  private meta = inject(Meta);

  // Reactive state signals
  public tideData = signal<any | null>(null);
  public isLoading = signal<boolean>(false);

  // Selected hour for interactive range scrubber
  public scrubberHour = signal<number>(12);

  // Computed Y coordinate and height details for the scrubber cursor dot
  public scrubberDetails = computed(() => {
    const data = this.tideData();
    const hour = this.scrubberHour();
    if (!data?.hourly || data.hourly.length === 0 || hour < 0 || hour >= data.hourly.length) {
      return { x: 400, y: 100, height: 0, time: '12:00' };
    }

    const h = data.hourly[hour];
    const heights = data.hourly.map((item: any) => item.height);
    const maxVal = Math.max(...heights.map(Math.abs)) || 1.0;

    // Scale X to fit 0 to 800 width
    const x = (hour / (data.hourly.length - 1)) * 800;
    // Scale Y to fit Y-center=100, height=200 bounds
    const y = 100 - (h.height / maxVal) * 70;
    const time = h.time.split('T')[1] || h.time;

    return { x, y, height: h.height, time };
  });

  // Computed SVG path coordinate string for drawing the tide curve
  public svgPath = computed((): string => {
    const data = this.tideData();
    if (!data?.hourly || data.hourly.length === 0) return '';

    const heights = data.hourly.map((h: any) => h.height);
    const maxVal = Math.max(...heights.map(Math.abs)) || 1.0;

    const points = data.hourly.map((h: any, idx: number) => {
      // Scale X to fit 0 to 800 width
      const x = (idx / (data.hourly.length - 1)) * 800;
      // Scale Y to fit Y-center=100, height=200 bounds (scale factor 70px)
      const y = 100 - (h.height / maxVal) * 70;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  });

  // Computed list of dots for coordinates display on the graph
  public svgDots = computed((): Array<{ x: number; y: number; height: number; time: string }> => {
    const data = this.tideData();
    if (!data?.hourly || data.hourly.length === 0) return [];

    const heights = data.hourly.map((h: any) => h.height);
    const maxVal = Math.max(...heights.map(Math.abs)) || 1.0;

    // Filter to map a dot every 3 hours to avoid graph pollution
    return data.hourly
      .map((h: any, idx: number) => {
        const x = (idx / (data.hourly.length - 1)) * 800;
        const y = 100 - (h.height / maxVal) * 70;
        const time = h.time.split('T')[1] || h.time;
        return { x, y, height: h.height, time };
      })
      .filter((_: any, idx: number) => idx % 3 === 0);
  });

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'View dynamic 24-hour tide curve vector charts, high/low tide predictions, peaks, heights, and tide tables on OceanCast.',
    });

    // Automatically reload tides schedule when location changes
    effect(() => {
      const activeLoc = this.locationService.selectedLocation();
      if (activeLoc) {
        this.loadTideData(activeLoc.lat, activeLoc.lon);
      }
    });
  }

  /**
   * Request tide prediction.
   */
  public loadTideData(lat: number, lon: number): void {
    this.isLoading.set(true);
    this.weatherService.getTides(lat, lon).subscribe({
      next: (data) => {
        this.tideData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to simulate tides:', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Recalculates and formats tide heights dynamically based on metric/imperial units.
   */
  public formatTideHeight(height: number): string {
    const isImperial = this.settingsService.settings().tempUnit === 'F';
    if (isImperial) {
      const feetValue = height * 3.28084;
      return `${feetValue.toFixed(2)} ft`;
    }
    return `${height.toFixed(2)} m`;
  }

  /**
   * Format tide date-times for list display.
   */
  public formatTime(isoStr: string): string {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr.split('T')[1] || isoStr;
    }
  }
}
