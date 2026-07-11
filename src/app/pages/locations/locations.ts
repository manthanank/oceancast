import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import * as L from 'leaflet';
import { LocationService, SavedLocation } from '../../services/location';
import { ToastService } from '../../services/toast';
import { Spinner } from '../../components/spinner/spinner';
import { AuthService } from '../../services/auth';

// Fix Leaflet default marker icon paths broken by Webpack/Angular build
const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const activeIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'active-marker',
});

const clickIcon = L.divIcon({
  html: `<div style="
    width: 20px; height: 20px;
    background: #22d3ee;
    border: 3px solid #0f172a;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgba(34,211,238,0.35), 0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

@Component({
  selector: 'app-locations',
  imports: [ReactiveFormsModule, Spinner],
  templateUrl: './locations.html',
  styleUrl: './locations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Locations implements OnInit, AfterViewInit, OnDestroy {
  private fb = inject(FormBuilder);
  public locationService = inject(LocationService);
  private toastService = inject(ToastService);
  private http = inject(HttpClient);
  private meta = inject(Meta);
  private authService = inject(AuthService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // Suggestions state
  public geoSuggestions = signal<any[]>([]);
  public isSearchingGeo = signal<boolean>(false);
  private searchTimeout: any;

  // Map state
  private map!: L.Map;
  private clickMarker?: L.Marker;
  private savedMarkers: L.Marker[] = [];

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Manage your saved coordinates list on OceanCast. Click the map to pick a location, add new locations, or auto-fill coordinates via GPS.',
    });
  }

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

  public ngAfterViewInit(): void {
    // Small delay so the DOM element is fully rendered before Leaflet initializes
    setTimeout(() => this.initMap(), 100);
  }

  public ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Initialize the Leaflet map with OpenStreetMap tiles.
   */
  private initMap(): void {
    const el = document.getElementById('location-picker-map');
    if (!el || this.map) return;

    this.map = L.map('location-picker-map', {
      center: [20, 78],   // Default: center of Indian Ocean
      zoom: 4,
      zoomControl: true,
    });

    // OpenStreetMap tile layer — free, no API key
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    // Click handler — drop pin and fill form
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => {
        const { lat, lng } = e.latlng;

        // Place/move the cyan click marker
        if (this.clickMarker) {
          this.clickMarker.setLatLng([lat, lng]);
        } else {
          this.clickMarker = L.marker([lat, lng], { icon: clickIcon })
            .addTo(this.map)
            .bindPopup('📍 Selected point')
            .openPopup();
        }

        // Fill lat/lon form fields
        this.locationForm.patchValue({
          lat: lat.toFixed(5),
          lon: lng.toFixed(5),
        });

        this.toastService.show(`Coordinates picked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
        this.cdr.markForCheck();
      });
    });

    // Plot existing saved locations on map
    this.plotSavedMarkers();
  }

  /**
   * Plot all saved locations as markers on the map.
   */
  private plotSavedMarkers(): void {
    if (!this.map) return;

    // Remove old markers
    this.savedMarkers.forEach(m => m.remove());
    this.savedMarkers = [];

    const locs = this.locationService.savedLocations();
    const selected = this.locationService.selectedLocation();

    locs.forEach(loc => {
      const isActive = selected._id === loc._id;
      const marker = L.marker([loc.lat, loc.lon], {
        icon: isActive ? activeIcon : iconDefault,
      })
        .addTo(this.map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:120px;">
            <b style="color:#0f172a">${loc.name}</b><br>
            <span style="font-size:11px;color:#475569;font-family:monospace">
              ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}
            </span><br>
            ${isActive ? '<span style="color:#0891b2;font-size:11px;font-weight:bold">✓ Active location</span>' : ''}
          </div>
        `);

      marker.on('click', () => {
        this.zone.run(() => {
          this.selectLocation(loc);
        });
      });

      this.savedMarkers.push(marker);
    });

    // If we have locations, fit map bounds to show all of them
    if (locs.length > 0) {
      const bounds = L.latLngBounds(locs.map(l => [l.lat, l.lon] as L.LatLngTuple));
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }

  /**
   * Query database for user's saved locations.
   */
  public fetchSavedLocations(): void {
    this.isFetching.set(true);
    this.locationService.fetchLocations().subscribe({
      next: () => {
        this.isFetching.set(false);
        // Re-plot markers after locations load
        setTimeout(() => this.plotSavedMarkers(), 50);
      },
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

    const user = this.authService.currentUser();
    const count = this.locationService.savedLocations().length;
    if (user && (!user.role || user.role === 'standard') && count >= 5) {
      this.toastService.show('Saved location limit (5) reached!', 'error');
      return;
    }

    this.isSaving.set(true);
    const { name, lat, lon } = this.locationForm.value;

    this.locationService.saveLocation(name, Number(lat), Number(lon)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.show(`Location "${name}" saved successfully!`, 'success');
        this.locationForm.reset();
        // Remove click marker and re-plot all saved markers
        if (this.clickMarker) {
          this.clickMarker.remove();
          this.clickMarker = undefined;
        }
        setTimeout(() => this.plotSavedMarkers(), 50);
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
    // Re-plot to update active marker styling
    setTimeout(() => this.plotSavedMarkers(), 50);
  }

  /**
   * Delete a location coordinate.
   */
  public deleteLocation(event: Event, loc: SavedLocation): void {
    event.stopPropagation();
    if (!loc._id) return;

    if (confirm(`Are you sure you want to delete "${loc.name}"?`)) {
      this.locationService.deleteLocation(loc._id).subscribe({
        next: () => {
          this.toastService.show(`Deleted "${loc.name}"`, 'info');
          setTimeout(() => this.plotSavedMarkers(), 50);
        },
      });
    }
  }

  /**
   * Autofills coordinate fields with the user's current GPS location.
   */
  public useCurrentGPS(): void {
    if (!navigator.geolocation) {
      this.toastService.show('Geolocation is not supported by your browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.locationForm.patchValue({
          lat: lat.toFixed(4),
          lon: lng.toFixed(4),
          name: 'My Current Location',
        });

        // Pan map to GPS position and drop click marker
        if (this.map) {
          this.map.setView([lat, lng], 10);
          if (this.clickMarker) {
            this.clickMarker.setLatLng([lat, lng]);
          } else {
            this.clickMarker = L.marker([lat, lng], { icon: clickIcon })
              .addTo(this.map)
              .bindPopup('📍 Your GPS location')
              .openPopup();
          }
        }

        this.toastService.show('Coordinates filled from GPS', 'info');
        this.cdr.markForCheck();
      },
      (error) => {
        this.toastService.show('Failed to retrieve GPS location: ' + error.message, 'error');
      }
    );
  }

  /**
   * Triggers geocoding suggestion query on name input.
   */
  public onNameInput(name: string): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

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
        error: () => this.isSearchingGeo.set(false),
      });
    }, 400);
  }

  /**
   * Selects a geocoding suggestion and pans the map to it.
   */
  public selectGeoSuggestion(item: any): void {
    const displayName = item.country ? `${item.name}, ${item.country}` : item.name;
    const lat = item.latitude;
    const lng = item.longitude;

    this.locationForm.patchValue({
      name: displayName,
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
    });
    this.geoSuggestions.set([]);

    // Pan map and drop click marker at the geocoded location
    if (this.map) {
      this.map.setView([lat, lng], 10);
      if (this.clickMarker) {
        this.clickMarker.setLatLng([lat, lng]);
      } else {
        this.clickMarker = L.marker([lat, lng], { icon: clickIcon })
          .addTo(this.map)
          .bindPopup(`📍 ${displayName}`)
          .openPopup();
      }
    }

    this.toastService.show(`Selected "${displayName}" coordinates`, 'info');
  }
}
