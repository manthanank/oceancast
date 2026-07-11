import { Component, ChangeDetectionStrategy, inject, signal, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { LocationService } from '../../services/location';
import { Spinner } from '../../components/spinner/spinner';

interface Period {
  name: string;
  start: string;
  end: string;
  type: 'major' | 'minor';
}

interface SolunarData {
  date: string;
  moonAge: number;
  moonPhase: string;
  illumination: number;
  activityScore: number;
  periods: Period[];
  hourlyActivity: number[];
}

@Component({
  selector: 'app-solunar',
  imports: [Spinner],
  templateUrl: './solunar.html',
  styleUrl: './solunar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Solunar implements OnInit {
  private http = inject(HttpClient);
  private meta = inject(Meta);
  public locationService = inject(LocationService);

  public isLoading = signal<boolean>(false);
  public selectedDate = signal<string>(new Date().toISOString().split('T')[0]);
  public solunarData = signal<SolunarData | null>(null);

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Solunar Fishing Calendar & Peak Bite Hours. Track moon phase, major/minor feeding periods, and fish activity peaks for your locations.',
    });

    // Automatically refresh data when date or selected location changes
    effect(() => {
      const loc = this.locationService.selectedLocation();
      const date = this.selectedDate();
      this.fetchSolunarData(loc.lat, loc.lon, date);
    });
  }

  public ngOnInit(): void {}

  /**
   * Fetch calculated solunar telemetry from the backend.
   */
  public fetchSolunarData(lat: number, lon: number, date: string): void {
    this.isLoading.set(true);
    const url = `/api/solunar?lat=${lat}&lon=${lon}&date=${date}`;
    this.http.get<SolunarData>(url).subscribe({
      next: (data) => {
        this.solunarData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load solunar data', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Date change handler.
   */
  public onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
    }
  }

  /**
   * Jump to previous or next day.
   */
  public adjustDate(daysOffset: number): void {
    const current = new Date(this.selectedDate());
    current.setDate(current.getDate() + daysOffset);
    this.selectedDate.set(current.toISOString().split('T')[0]);
  }

  /**
   * Get a verbal description of the daily feeding index rating.
   */
  public getRatingDescription(score: number): string {
    if (score >= 80) return '🏆 Outstanding Peak Bite';
    if (score >= 60) return '🟢 High Feeding Activity';
    if (score >= 40) return '🟡 Average Bite Rate';
    return '🔴 Poor Bite Rate';
  }

  /**
   * Generates custom SVG markup to draw the moon phase shadow.
   */
  public getMoonPhaseSvgPath(phase: string, illumination: number): string {
    // Basic representation of moon cycle illumination
    const rx = 50;
    const ry = 50;
    const isWaning = phase.toLowerCase().includes('waning') || phase.toLowerCase().includes('third');
    const width = 100 * (illumination / 100);

    if (illumination === 100) {
      // Full Moon: Draw entire circle illuminated
      return 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z';
    }
    if (illumination === 0) {
      // New Moon: Draw nothing (empty black circle handled by outer border)
      return '';
    }

    if (illumination === 50) {
      // Quarter Moons: Left or right half illuminated
      if (isWaning) {
        // Last quarter: Left half illuminated
        return 'M 50 0 A 50 50 0 0 0 50 100 Z';
      } else {
        // First quarter: Right half illuminated
        return 'M 50 0 A 50 50 0 0 1 50 100 Z';
      }
    }

    // Gibbons/Crescent arcs
    if (illumination > 50) {
      // Gibbous: More than half illuminated
      const arcWidth = 50 * ((illumination - 50) / 50);
      if (isWaning) {
        // Waning Gibbous: Left side full, right side arc curves in
        return `M 50 0 A 50 50 0 0 0 50 100 A ${arcWidth} 50 0 0 1 50 0 Z`;
      } else {
        // Waxing Gibbous: Right side full, left side arc curves in
        return `M 50 0 A 50 50 0 0 1 50 100 A ${arcWidth} 50 0 0 0 50 0 Z`;
      }
    } else {
      // Crescent: Less than half illuminated
      const arcWidth = 50 * ((50 - illumination) / 50);
      if (isWaning) {
        // Waning Crescent: Left side sliver, right side curves out
        return `M 50 0 A ${arcWidth} 50 0 0 0 50 100 A 50 50 0 0 1 50 0 Z`;
      } else {
        // Waxing Crescent: Right side sliver, left side curves out
        return `M 50 0 A ${arcWidth} 50 0 0 1 50 100 A 50 50 0 0 0 50 0 Z`;
      }
    }
  }
}
