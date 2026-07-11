import { Component, ChangeDetectionStrategy, inject, signal, effect, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { LocationService } from '../../services/location';
import { WeatherService } from '../../services/weather';
import { SettingsService } from '../../services/settings';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Spinner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  public locationService = inject(LocationService);
  private weatherService = inject(WeatherService);
  public settingsService = inject(SettingsService);
  private http = inject(HttpClient);
  private meta = inject(Meta);

  // Reactive state signals
  public dashboardData = signal<any | null>(null);
  public isLoading = signal<boolean>(false);
  public loadError = signal<string | null>(null);

  // Dynamic activity feasibility thresholds set by administrators
  public thresholds = signal<any>({
    surf: { waveMin: 0.5, windMax: 22 },
    ride: { windMax: 20, tempMin: 15 },
    fish: { waveMax: 1.5, windMax: 15 },
  });

  // Featured coordinates spots pre-loaded for fishermen quick switching
  public presets = signal<any[]>([]);

  // Computed properties for quick dashboard summaries
  public currentTemp = computed(() => {
    const data = this.dashboardData();
    if (!data?.weather?.current?.temp) return 'N/A';
    return this.settingsService.formatTemp(data.weather.current.temp);
  });

  public currentWind = computed(() => {
    const data = this.dashboardData();
    if (!data?.weather?.current?.windSpeed) return 'N/A';
    return this.settingsService.formatWind(data.weather.current.windSpeed);
  });

  public currentSwelledWave = computed(() => {
    const data = this.dashboardData();
    if (!data?.marine?.current) return 'N/A';
    const wave = data.marine.current.waveHeight;
    return wave > 0 ? `${wave.toFixed(1)}m` : 'Flat';
  });

  public nextTide = computed(() => {
    const data = this.dashboardData();
    if (!data?.tides?.extremes || data.tides.extremes.length === 0) return null;
    
    // Find the next tide event that happens after right now
    const now = new Date().getTime();
    const futureEvents = data.tides.extremes
      .map((e: any) => ({ ...e, timeMs: new Date(e.time).getTime() }))
      .filter((e: any) => e.timeMs > now)
      .sort((a: any, b: any) => a.timeMs - b.timeMs);

    return futureEvents.length > 0 ? futureEvents[0] : data.tides.extremes[0];
  });

  public fishingWindows = computed(() => {
    const data = this.dashboardData();
    if (!data?.tides?.extremes || data.tides.extremes.length === 0) return [];

    const windSpeed = data.weather?.current?.windSpeed || 0;
    const waveHeight = data.marine?.current?.waveHeight || 0;

    let statusText = 'Excellent Activity';
    let isFavorable = true;

    if (windSpeed > 25 || waveHeight > 2.2) {
      statusText = 'Suboptimal (Choppy Waves)';
      isFavorable = false;
    } else if (windSpeed > 18 || waveHeight > 1.5) {
      statusText = 'Moderate Activity';
    }

    return data.tides.extremes.map((e: any) => {
      const tideDate = new Date(e.time);
      const start = new Date(tideDate.getTime() - 60 * 60 * 1000);
      const end = new Date(tideDate.getTime() + 60 * 60 * 1000);

      const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        type: `${e.type} Tide Turn`,
        timeRange: `${startTimeStr} - ${endTimeStr}`,
        status: statusText,
        favorable: isFavorable,
        height: `${e.height > 0 ? '+' : ''}${e.height.toFixed(2)}m`,
      };
    });
  });

  public safetyAlerts = computed((): string[] => {
    const data = this.dashboardData();
    if (!data) return [];

    const alerts: string[] = [];
    const windSpeed = data.weather?.current?.windSpeed || 0;
    const waveHeight = data.marine?.current?.waveHeight || 0;

    if (windSpeed > 30) {
      alerts.push(`⚠️ Strong Winds Warning: Wind is currently ${windSpeed.toFixed(0)} km/h. Motorcycle riders should anticipate crosswinds.`);
    }
    if (waveHeight > 2.2) {
      alerts.push(`⚠️ Heavy Surf Advisory: Wave heights are currently ${waveHeight.toFixed(1)}m. Shore casting or pier fishing is hazardous.`);
    }

    return alerts;
  });

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Monitor real-time weather forecasts, sea swells, wind directions, and daily tides curves on the OceanCast aggregated dashboard.',
    });

    // Fetch custom outdoor feasibility thresholds
    this.http.get<any>('/api/admin/thresholds').subscribe({
      next: (res) => {
        if (res && res.surf) {
          this.thresholds.set(res);
        }
      },
    });

    // Load coordinates presets for quick switcher selection
    this.http.get<any[]>('/api/admin/presets').subscribe({
      next: (res) => {
        if (res) {
          this.presets.set(res);
        }
      },
    });

    // Automatically fetch dashboard metrics whenever selectedLocation coordinates change
    effect(() => {
      const activeLoc = this.locationService.selectedLocation();
      if (activeLoc) {
        this.loadDashboardData(activeLoc.lat, activeLoc.lon);
      }
    });
  }

  /**
   * One-tap switcher resetting the coordinates mapping triggers
   */
  public selectPresetLocation(preset: any): void {
    this.locationService.selectedLocation.set({
      name: preset.name,
      lat: preset.lat,
      lon: preset.lon,
    });
  }

  /**
   * Request consolidated weather, marine, and tide metrics.
   */
  public loadDashboardData(lat: number, lon: number): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.weatherService.getDashboard(lat, lon).subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
        this.loadError.set('Failed to fetch dashboard data. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Returns a friendly weather description matching Open-Meteo condition codes.
   */
  public getWeatherDescription(code: number): string {
    if (code === 0) return 'Clear Sky';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 65) return 'Rainy';
    if (code >= 71 && code <= 77) return 'Snowy';
    if (code >= 80 && code <= 82) return 'Rain Showers';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Unspecified Conditions';
  }

  // Accordion details toggle signals
  public showSurfBreakdown = signal<boolean>(false);
  public showRideBreakdown = signal<boolean>(false);
  public showFishBreakdown = signal<boolean>(false);

  /**
   * Resolves visual atmospheric gradient backgrounds for dashboard cards based on Open-Meteo codes.
   */
  public getWeatherBgClass(code: number): string {
    if (code === 0 || code === 1) {
      return 'bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-slate-950/80 border-amber-500/20';
    }
    if (code >= 51 && code <= 82) {
      return 'bg-gradient-to-br from-blue-950/30 via-slate-900/40 to-slate-950/80 border-blue-900/30';
    }
    if (code === 2 || code === 3 || code === 45 || code === 48) {
      return 'bg-gradient-to-br from-slate-800/20 via-slate-900/40 to-slate-950/80 border-slate-700/20';
    }
    return 'bg-slate-900/35 border-slate-800/80';
  }
}
