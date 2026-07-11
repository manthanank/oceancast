import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { LocationService, SavedLocation } from '../../services/location';
import { SettingsService } from '../../services/settings';
import { ToastService } from '../../services/toast';
import { Spinner } from '../../components/spinner/spinner';

export interface CatchLog {
  _id?: string;
  species: string;
  weight: number;
  length: number;
  locationName: string;
  lat: number;
  lon: number;
  notes: string;
  catchTime: string;
  temp?: number;
  windSpeed?: number;
  waveHeight?: number;
  tideHeight?: number;
}

@Component({
  selector: 'app-catches',
  imports: [ReactiveFormsModule, Spinner, DatePipe],
  templateUrl: './catches.html',
  styleUrl: './catches.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catches implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private meta = inject(Meta);
  private toastService = inject(ToastService);
  public locationService = inject(LocationService);
  public settingsService = inject(SettingsService);

  public isSaving = signal<boolean>(false);
  public isFetching = signal<boolean>(false);
  public catches = signal<CatchLog[]>([]);

  // Statistics signals
  public totalCatches = signal<number>(0);
  public avgWeight = signal<number>(0);
  public biggestCatch = signal<string>('N/A');

  public catchForm: FormGroup = this.fb.group({
    species: ['', [Validators.required, Validators.minLength(2)]],
    weight: ['', [Validators.required, Validators.min(0.01)]],
    length: ['', [Validators.required, Validators.min(0.1)]],
    locationId: ['', [Validators.required]], // selector for saved location
    catchTime: [new Date().toISOString().slice(0, 16), [Validators.required]],
    notes: [''],
  });

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Digital Catch Logbook & Smart Journal. Document your catches with automatically captured weather and tide statistics.',
    });
  }

  public ngOnInit(): void {
    this.fetchCatches();
    this.fetchSavedLocations();
  }

  /**
   * Pre-fetch saved locations to populate the coordinate selector drop-down.
   */
  private fetchSavedLocations(): void {
    this.locationService.fetchLocations().subscribe({
      next: (locs) => {
        // Set default dropdown option if coordinates exist
        if (locs.length > 0) {
          const current = this.locationService.selectedLocation();
          const match = locs.find(l => l.lat === current.lat && l.lon === current.lon);
          if (match && match._id) {
            this.catchForm.patchValue({ locationId: match._id });
          } else if (locs[0]._id) {
            this.catchForm.patchValue({ locationId: locs[0]._id });
          }
        }
      }
    });
  }

  /**
   * Load catch history list from backend.
   */
  public fetchCatches(): void {
    this.isFetching.set(true);
    this.http.get<CatchLog[]>('/api/catches').subscribe({
      next: (data) => {
        this.catches.set(data);
        this.calculateStats(data);
        this.isFetching.set(false);
      },
      error: () => {
        this.isFetching.set(false);
      },
    });
  }

  /**
   * Log a new catch record.
   */
  public onSubmit(): void {
    if (this.catchForm.invalid) {
      this.catchForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    const formVal = this.catchForm.value;
    const selectedLoc = this.locationService.savedLocations().find(l => l._id === formVal.locationId);

    if (!selectedLoc) {
      this.toastService.show('Please select a valid coordinates location', 'error');
      this.isSaving.set(false);
      return;
    }

    const payload = {
      species: formVal.species,
      weight: Number(formVal.weight),
      length: Number(formVal.length),
      locationName: selectedLoc.name,
      lat: selectedLoc.lat,
      lon: selectedLoc.lon,
      catchTime: new Date(formVal.catchTime).toISOString(),
      notes: formVal.notes || '',
    };

    this.http.post<CatchLog>('/api/catches', payload).subscribe({
      next: (newLog) => {
        this.isSaving.set(false);
        this.toastService.show(`Catch logged successfully! Weather & tides tagged.`, 'success');
        
        // Reset form keeping date and location
        this.catchForm.patchValue({
          species: '',
          weight: '',
          length: '',
          notes: '',
        });

        // Add to active array list
        const currentList = [newLog, ...this.catches()];
        this.catches.set(currentList);
        this.calculateStats(currentList);
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  /**
   * Remove a logged catch.
   */
  public deleteCatch(catchId: string, species: string): void {
    if (confirm(`Are you sure you want to delete this catch record of ${species}?`)) {
      this.http.delete(`/api/catches/${catchId}`).subscribe({
        next: () => {
          this.toastService.show('Catch record removed', 'info');
          const updated = this.catches().filter(c => c._id !== catchId);
          this.catches.set(updated);
          this.calculateStats(updated);
        },
      });
    }
  }

  /**
   * Compile and evaluate aggregate catches statistics.
   */
  private calculateStats(list: CatchLog[]): void {
    this.totalCatches.set(list.length);

    if (list.length === 0) {
      this.avgWeight.set(0);
      this.biggestCatch.set('N/A');
      return;
    }

    const totalW = list.reduce((sum, item) => sum + item.weight, 0);
    this.avgWeight.set(parseFloat((totalW / list.length).toFixed(2)));

    let biggest = list[0];
    list.forEach(item => {
      if (item.weight > biggest.weight) {
        biggest = item;
      }
    });
    this.biggestCatch.set(`${biggest.weight}kg ${biggest.species}`);
  }
}
