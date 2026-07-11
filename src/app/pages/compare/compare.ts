import { Component, ChangeDetectionStrategy, inject, signal, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LocationService, SavedLocation } from '../../services/location';
import { SettingsService } from '../../services/settings';
import { WeatherService } from '../../services/weather';
import { ToastService } from '../../services/toast';
import { Spinner } from '../../components/spinner/spinner';

interface ComparisonSpot {
  location: SavedLocation;
  weather: any;
  safetyStatus: 'safe' | 'caution' | 'danger';
  safetyReason: string;
}

@Component({
  selector: 'app-compare',
  imports: [Spinner],
  templateUrl: './compare.html',
  styleUrl: './compare.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Compare implements OnInit {
  private http = inject(HttpClient);
  private meta = inject(Meta);
  private weatherService = inject(WeatherService);
  private toastService = inject(ToastService);
  public locationService = inject(LocationService);
  public settingsService = inject(SettingsService);

  public isLoading = signal<boolean>(false);
  public selectedSpotIds = signal<string[]>([]);
  public comparisonSpots = signal<ComparisonSpot[]>([]);

  // Safety threshold configuration
  private thresholds = signal<any>({ surf: 1.5, wind: 15.0 });

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Compare weather, ocean waves, tides, and fishing safety parameters across multiple saved locations side-by-side.',
    });

    // Auto-update comparison if saved locations list is updated
    effect(() => {
      const saved = this.locationService.savedLocations();
      if (saved.length > 0) {
        // Default select first two spots for comparison if none selected
        const currentSelected = this.selectedSpotIds();
        if (currentSelected.length === 0) {
          const defaults = saved.slice(0, 2).map(s => s._id || '');
          this.selectedSpotIds.set(defaults.filter(id => !!id));
        }
        this.loadComparisonData();
      } else {
        this.comparisonSpots.set([]);
      }
    });
  }

  public ngOnInit(): void {
    this.fetchThresholds();
    this.locationService.fetchLocations().subscribe();
  }

  /**
   * Fetch safety thresholds bounds from backend admin console collections.
   */
  private fetchThresholds(): void {
    this.http.get<any>('/api/admin/thresholds').subscribe({
      next: (res) => {
        if (res && res.surf) {
          this.thresholds.set(res);
        }
      },
    });
  }

  /**
   * Retrieve consolidated details for all checked location slots in parallel.
   */
  public loadComparisonData(): void {
    const selectedIds = this.selectedSpotIds();
    if (selectedIds.length === 0) {
      this.comparisonSpots.set([]);
      return;
    }

    this.isLoading.set(true);

    const requests: Observable<any>[] = selectedIds.map(id => {
      const loc = this.locationService.savedLocations().find(l => l._id === id);
      if (!loc) return of(null);

      return this.weatherService.getDashboard(loc.lat, loc.lon).pipe(
        catchError(err => {
          console.error(`Failed to load data for spot ${loc.name}`, err);
          return of(null);
        })
      );
    });

    forkJoin(requests).subscribe({
      next: (results) => {
        const spots: ComparisonSpot[] = [];

        results.forEach((data, index) => {
          if (!data) return;
          const id = selectedIds[index];
          const loc = this.locationService.savedLocations().find(l => l._id === id);
          if (!loc) return;

          const analysis = this.analyzeSafety(data);
          spots.push({
            location: loc,
            weather: data,
            safetyStatus: analysis.status,
            safetyReason: analysis.reason,
          });
        });

        this.comparisonSpots.set(spots);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Comparison load error', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Determine go/no-go safety status matching dashboard advisories.
   */
  private analyzeSafety(data: any): { status: 'safe' | 'caution' | 'danger'; reason: string } {
    const limits = this.thresholds();
    const wind = data.weather?.current?.windSpeed || 0;
    const wave = data.marine?.current?.waveHeight || 0;

    const windMax = limits.wind || 15.0;
    const waveMax = limits.surf || 1.5;

    if (wave > waveMax * 1.5 || wind > windMax * 1.5) {
      return {
        status: 'danger',
        reason: `🔴 Avoid: Waves exceed ${waveMax * 1.5}m or winds exceed ${windMax * 1.5} km/h.`,
      };
    }
    if (wave > waveMax || wind > windMax) {
      return {
        status: 'caution',
        reason: `🟡 Caution: Swells exceed ${waveMax}m or winds exceed ${windMax} km/h.`,
      };
    }
    return {
      status: 'safe',
      reason: '🟢 Safe: Calm wind & waves. Excellent casting conditions.',
    };
  }

  /**
   * Toggle comparison selection mapping lists.
   */
  public toggleSpotSelection(spotId: string): void {
    const selected = [...this.selectedSpotIds()];
    const index = selected.indexOf(spotId);

    if (index > -1) {
      // Remove from comparison
      selected.splice(index, 1);
    } else {
      // Enforce limit of 3 spots side-by-side
      if (selected.length >= 3) {
        this.toastService.show('You can compare a maximum of 3 locations at once.', 'info');
        return;
      }
      selected.push(spotId);
    }

    this.selectedSpotIds.set(selected);
    this.loadComparisonData();
  }

  /**
   * Click handler to set compared spot as active global location.
   */
  public makeActiveLocation(loc: SavedLocation): void {
    this.locationService.selectLocation(loc);
    this.toastService.show(`Active observation spot set to "${loc.name}"`, 'success');
  }

  /** Translate weather codes to verbal status descriptors */
  public getWeatherDescription(code: number): string {
    if (code === 0) return 'Sunny / Clear';
    if ([1, 2, 3].includes(code)) return 'Partly Cloudy';
    if ([45, 48].includes(code)) return 'Foggy';
    if ([51, 53, 55].includes(code)) return 'Drizzle';
    if ([61, 63, 65].includes(code)) return 'Rainy';
    if ([71, 73, 75].includes(code)) return 'Snowy';
    if ([80, 81, 82].includes(code)) return 'Showers';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'Overcast';
  }
}
