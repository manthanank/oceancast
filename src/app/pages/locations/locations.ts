import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { LocationService, SavedLocation } from '../../services/location';
import { ToastService } from '../../services/toast';
import { Spinner } from '../../components/spinner/spinner';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-locations',
  imports: [ReactiveFormsModule, Spinner],
  templateUrl: './locations.html',
  styleUrl: './locations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Locations implements OnInit {
  private fb = inject(FormBuilder);
  public locationService = inject(LocationService);
  private toastService = inject(ToastService);
  private http = inject(HttpClient);
  private meta = inject(Meta);
  private authService = inject(AuthService);

  // Suggestions state
  public geoSuggestions = signal<any[]>([]);
  public isSearchingGeo = signal<boolean>(false);
  private searchTimeout: any;

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Manage your saved coordinates list on OceanCast. Add new locations, auto-fill coordinates via GPS, and select active observations.',
    });
  }

  // Loading signals
  public isFetching = signal<boolean>(false);
  public isSaving = signal<boolean>(false);

  public locationForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    lat: ['', [Validators.required, Validators.min(-90), Validators.max(90)]],
    lon: ['', [Validators.required, Validators.min(-180), Validators.max(180)]],
  });

  public ngOnInit(): void {
    this.fetchSavedLocations();
  }

  /**
   * Query database for user's saved locations.
   */
  public fetchSavedLocations(): void {
    this.isFetching.set(true);
    this.locationService.fetchLocations().subscribe({
      next: () => this.isFetching.set(false),
      error: () => this.isFetching.set(false),
    });
  }

  /**
   * Submit and save a new coordinate location.
   */
  public onSubmit(): void {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    // Enforce SaaS standard limit rule: max 5 saved locations for standard users
    const user = this.authService.currentUser();
    const count = this.locationService.savedLocations().length;
    if (user && (!user.role || user.role === 'standard') && count >= 5) {
      this.toastService.show('Saved location limit (5) reached! Upgrade to a Premium plan to add more destinations.', 'error');
      return;
    }

    this.isSaving.set(true);
    const { name, lat, lon } = this.locationForm.value;

    this.locationService.saveLocation(name, Number(lat), Number(lon)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.show(`Location "${name}" saved successfully!`, 'success');
        this.locationForm.reset();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  /**
   * Set location as active global coordinate selection.
   */
  public selectLocation(loc: SavedLocation): void {
    this.locationService.selectLocation(loc);
    this.toastService.show(`Active location changed to "${loc.name}"`, 'success');
  }

  /**
   * Delete a location coordinate.
   */
  public deleteLocation(event: Event, loc: SavedLocation): void {
    event.stopPropagation(); // Prevent select trigger on click
    if (!loc._id) return;
    
    if (confirm(`Are you sure you want to delete "${loc.name}"?`)) {
      this.locationService.deleteLocation(loc._id).subscribe({
        next: () => {
          this.toastService.show(`Deleted "${loc.name}"`, 'info');
        },
      });
    }
  }

  /**
   * Autofills coordinate fields with the user's current GPS location if browser supports it.
   */
  public useCurrentGPS(): void {
    if (!navigator.geolocation) {
      this.toastService.show('Geolocation is not supported by your browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locationForm.patchValue({
          lat: position.coords.latitude.toFixed(4),
          lon: position.coords.longitude.toFixed(4),
          name: 'My Current Location',
        });
        this.toastService.show('Coordinates filled from GPS', 'info');
      },
      (error) => {
        this.toastService.show('Failed to retrieve GPS location: ' + error.message, 'error');
      }
    );
  }

  /**
   * Triggers an autocomplete geocoding suggestion query on input.
   */
  public onNameInput(name: string): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!name || name.trim().length < 3) {
      this.geoSuggestions.set([]);
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.isSearchingGeo.set(true);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
      this.http.get<any>(url).subscribe({
        next: (res) => {
          this.geoSuggestions.set(res.results || []);
          this.isSearchingGeo.set(false);
        },
        error: () => {
          this.isSearchingGeo.set(false);
        }
      });
    }, 400); // 400ms debounce
  }

  /**
   * Selects a location suggestion and fills input fields.
   */
  public selectGeoSuggestion(item: any): void {
    const displayName = item.country ? `${item.name}, ${item.country}` : item.name;
    this.locationForm.patchValue({
      name: displayName,
      lat: item.latitude.toFixed(4),
      lon: item.longitude.toFixed(4),
    });
    this.geoSuggestions.set([]); // Clear dropdown list
    this.toastService.show(`Selected "${displayName}" coordinates`, 'info');
  }
}
