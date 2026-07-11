import { Component, ChangeDetectionStrategy, inject, signal, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { LocationService } from '../../services/location';
import { Spinner } from '../../components/spinner/spinner';

interface MarineHubData {
  flooding: {
    floodRisk: 'Low' | 'Moderate' | 'High';
    kingTideAlert: boolean;
    surgeHeight: number;
    advisory: string;
    peakTideHeight: number;
  };
  paddling: {
    offshoreWind: boolean;
    driftRateKnots: number;
    difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Dangerous';
    advisory: string;
  };
  wildlife: {
    whaleLikelihood: number;
    bioluminescenceScore: number;
    dolphinLikelihood: number;
    advisory: string;
  };
  solarWind: {
    solarYieldWh: number;
    windYieldWh: number;
    solarStatus: 'Excellent' | 'Good' | 'Poor';
    windStatus: 'Excellent' | 'Good' | 'Poor';
    advisory: string;
  };
}

@Component({
  selector: 'app-marine-hub',
  imports: [Spinner],
  templateUrl: './marine-hub.html',
  styleUrl: './marine-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarineHub implements OnInit {
  public Math = Math;
  private http = inject(HttpClient);
  private meta = inject(Meta);
  public locationService = inject(LocationService);

  public isLoading = signal<boolean>(false);
  public selectedDate = signal<string>(new Date().toISOString().split('T')[0]);
  public data = signal<MarineHubData | null>(null);
  
  // Tab toggle selection
  public activeTab = signal<'flooding' | 'paddling' | 'wildlife' | 'energy'>('flooding');

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'OceanCast Marine Activity Hub. Features coastal flooding alerts, kayak drift advisories, marine wildlife trackers, and off-grid generator estimators.',
    });

    // Auto-refresh on changes
    effect(() => {
      const loc = this.locationService.selectedLocation();
      const date = this.selectedDate();
      this.fetchHubMetrics(loc.lat, loc.lon, date);
    });
  }

  public ngOnInit(): void {}

  public fetchHubMetrics(lat: number, lon: number, date: string): void {
    this.isLoading.set(true);
    const url = `/api/marine-hub?lat=${lat}&lon=${lon}&date=${date}`;
    this.http.get<MarineHubData>(url).subscribe({
      next: (res) => {
        this.data.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load marine hub metrics', err);
        this.isLoading.set(false);
      },
    });
  }

  public switchTab(tab: 'flooding' | 'paddling' | 'wildlife' | 'energy'): void {
    this.activeTab.set(tab);
  }

  public onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
    }
  }

  public adjustDate(daysOffset: number): void {
    const current = new Date(this.selectedDate());
    current.setDate(current.getDate() + daysOffset);
    this.selectedDate.set(current.toISOString().split('T')[0]);
  }
}
