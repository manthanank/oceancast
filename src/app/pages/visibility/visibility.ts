import { Component, ChangeDetectionStrategy, inject, signal, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { LocationService } from '../../services/location';
import { SettingsService } from '../../services/settings';
import { Spinner } from '../../components/spinner/spinner';

interface VisibilityReport {
  date: string;
  visibilityScore: number;
  visibilityMeters: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  conditionsReason: string;
  bestDiveHour: string;
  hourlyVisibility: number[];
}

@Component({
  selector: 'app-visibility',
  imports: [Spinner],
  templateUrl: './visibility.html',
  styleUrl: './visibility.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Visibility implements OnInit {
  private http = inject(HttpClient);
  private meta = inject(Meta);
  public locationService = inject(LocationService);
  public settingsService = inject(SettingsService);

  public isLoading = signal<boolean>(false);
  public selectedDate = signal<string>(new Date().toISOString().split('T')[0]);
  public report = signal<VisibilityReport | null>(null);

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Coastal Water Clarity & Scuba Diving Visibility Predictor. Plan snorkeling and diving trips with slack tide visibility analysis.',
    });

    // Auto-refresh when location or date selection changes
    effect(() => {
      const loc = this.locationService.selectedLocation();
      const date = this.selectedDate();
      this.fetchVisibilityReport(loc.lat, loc.lon, date);
    });
  }

  public ngOnInit(): void {}

  /**
   * Request clarity report from Express backend.
   */
  public fetchVisibilityReport(lat: number, lon: number, date: string): void {
    this.isLoading.set(true);
    const url = `/api/visibility?lat=${lat}&lon=${lon}&date=${date}`;
    this.http.get<VisibilityReport>(url).subscribe({
      next: (data) => {
        this.report.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load visibility report', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Handles date changes.
   */
  public onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
    }
  }

  /**
   * Day adjustment navigation helper.
   */
  public adjustDate(daysOffset: number): void {
    const current = new Date(this.selectedDate());
    current.setDate(current.getDate() + daysOffset);
    this.selectedDate.set(current.toISOString().split('T')[0]);
  }

  /**
   * Returns estimated visibility depth formatted by user unit preference (ft/m).
   */
  public getFormattedDepth(meters: number): string {
    const isImperial = this.settingsService.settings().tempUnit === 'F';
    if (isImperial) {
      const feet = meters * 3.28084;
      return `${feet.toFixed(1)} ft`;
    }
    return `${meters.toFixed(1)} m`;
  }
}
