import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { LocationService } from '../../services/location';
import { WeatherService } from '../../services/weather';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-marine',
  imports: [Spinner],
  templateUrl: './marine.html',
  styleUrl: './marine.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Marine {
  public locationService = inject(LocationService);
  private weatherService = inject(WeatherService);
  private meta = inject(Meta);

  // Reactive state signals
  public marineData = signal<any | null>(null);
  public isLoading = signal<boolean>(false);

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Monitor ocean wave swells, heights, periods, directions, and surf forecast details for coastlines on OceanCast.',
    });

    // Automatically reload wave metrics when location changes
    effect(() => {
      const activeLoc = this.locationService.selectedLocation();
      if (activeLoc) {
        this.loadMarineData(activeLoc.lat, activeLoc.lon);
      }
    });
  }

  /**
   * Request wave parameters.
   */
  public loadMarineData(lat: number, lon: number): void {
    this.isLoading.set(true);
    this.weatherService.getMarine(lat, lon).subscribe({
      next: (data) => {
        this.marineData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch detailed marine waves:', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Returns a wave classification description based on swell height.
   */
  public getWaveClassification(height: number): string {
    if (height === 0) return 'Flat Water';
    if (height < 0.5) return 'Ankle Snapper (Very Small)';
    if (height < 1.2) return 'Clean Swell (Small-Medium)';
    if (height < 2.2) return 'Chunky/Fun Swell (Medium)';
    if (height < 3.5) return 'Heavy Swell (Large)';
    return 'Hazardous Swell (Dangerously Large)';
  }

  /**
   * Helper to format time strings.
   */
  public formatTime(isoStr: string): string {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
