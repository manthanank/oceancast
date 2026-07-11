import { Component, ChangeDetectionStrategy, inject, signal, effect, computed } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { LocationService } from '../../services/location';
import { WeatherService } from '../../services/weather';
import { SettingsService } from '../../services/settings';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-weather',
  imports: [Spinner],
  templateUrl: './weather.html',
  styleUrl: './weather.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Weather {
  public locationService = inject(LocationService);
  private weatherService = inject(WeatherService);
  public settingsService = inject(SettingsService);
  private meta = inject(Meta);

  // Reactive state signals
  public weatherData = signal<any | null>(null);
  public isLoading = signal<boolean>(false);
  public activeTab = signal<'hourly' | 'daily'>('hourly');

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'View detailed hourly weather forecasts, temperatures, wind metrics, sunrise/sunset times, and 7-day projections on OceanCast.',
    });

    // Automatically reload weather metrics when location changes
    effect(() => {
      const activeLoc = this.locationService.selectedLocation();
      if (activeLoc) {
        this.loadWeatherData(activeLoc.lat, activeLoc.lon);
      }
    });
  }

  /**
   * Request weather parameters.
   */
  public loadWeatherData(lat: number, lon: number): void {
    this.isLoading.set(true);
    this.weatherService.getWeather(lat, lon).subscribe({
      next: (data) => {
        if (data && data.daily) {
          data.daily = data.daily.map((day: any) => {
            const date = new Date(day.date);
            return {
              ...day,
              dayName: date.toLocaleDateString([], { weekday: 'short' }),
              dayNum: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            };
          });
        }
        this.weatherData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch detailed weather metrics:', err);
        this.isLoading.set(false);
      },
    });
  }

  public setTab(tab: 'hourly' | 'daily'): void {
    this.activeTab.set(tab);
  }

  public morningGoldenHour = computed(() => {
    const data = this.weatherData();
    if (!data?.daily?.[0]?.sunrise) return 'N/A';
    try {
      const sunrise = new Date(data.daily[0].sunrise);
      const startStr = sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const end = new Date(sunrise.getTime() + 60 * 60 * 1000);
      const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${startStr} - ${endStr}`;
    } catch {
      return 'N/A';
    }
  });

  public eveningGoldenHour = computed(() => {
    const data = this.weatherData();
    if (!data?.daily?.[0]?.sunset) return 'N/A';
    try {
      const sunset = new Date(data.daily[0].sunset);
      const start = new Date(sunset.getTime() - 60 * 60 * 1000);
      const startStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endStr = sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${startStr} - ${endStr}`;
    } catch {
      return 'N/A';
    }
  });

  public solarNoon = computed(() => {
    const data = this.weatherData();
    if (!data?.daily?.[0]?.sunrise || !data?.daily?.[0]?.sunset) return 'N/A';
    try {
      const sunrise = new Date(data.daily[0].sunrise).getTime();
      const sunset = new Date(data.daily[0].sunset).getTime();
      const noon = new Date(sunrise + (sunset - sunrise) / 2);
      return noon.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'N/A';
    }
  });

  /**
   * Helper to format raw sunrise/sunset string times.
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

  /**
   * Returns condition description matching weather code.
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
    return 'Unspecified';
  }
}
