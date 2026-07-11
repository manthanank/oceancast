import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface SavedLocation {
  _id?: string;
  name: string;
  lat: number;
  lon: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private http = inject(HttpClient);

  // Global default fallback location
  private readonly defaultLocation: SavedLocation = {
    name: 'Gokarna, India',
    lat: 14.5479,
    lon: 74.3188,
  };

  // Signals to track saved and active selections
  public savedLocations = signal<SavedLocation[]>([]);
  public selectedLocation = signal<SavedLocation>(this.defaultLocation);

  constructor() {
    this.loadSelectedLocation();
  }

  /**
   * Load saved locations from backend database.
   */
  public fetchLocations(): Observable<SavedLocation[]> {
    return this.http.get<SavedLocation[]>('/api/locations').pipe(
      tap((locations) => {
        this.savedLocations.set(locations);
        
        // If there is no active location selected (or the current selection is default)
        // and we have saved locations, auto-select the first saved location.
        const current = this.selectedLocation();
        if (locations.length > 0 && current.name === this.defaultLocation.name && current.lat === this.defaultLocation.lat) {
          this.selectLocation(locations[0]);
        }
      })
    );
  }

  /**
   * Save a new location coordinate.
   */
  public saveLocation(name: string, lat: number, lon: number): Observable<SavedLocation> {
    return this.http.post<SavedLocation>('/api/locations', { name, lat, lon }).pipe(
      tap((newLoc) => {
        this.savedLocations.update(list => [newLoc, ...list]);
        this.selectLocation(newLoc);
      })
    );
  }

  /**
   * Delete a location coordinate.
   */
  public deleteLocation(id: string): Observable<any> {
    return this.http.delete(`/api/locations/${id}`).pipe(
      tap(() => {
        this.savedLocations.update(list => list.filter(loc => loc._id !== id));
        
        // If we deleted the active location, reset selection
        const active = this.selectedLocation();
        if (active._id === id) {
          const remaining = this.savedLocations();
          if (remaining.length > 0) {
            this.selectLocation(remaining[0]);
          } else {
            this.selectLocation(this.defaultLocation);
          }
        }
      })
    );
  }

  /**
   * Set the currently active location.
   */
  public selectLocation(location: SavedLocation): void {
    this.selectedLocation.set(location);
    localStorage.setItem('oceancast_active_location', JSON.stringify(location));
  }

  private loadSelectedLocation(): void {
    const saved = localStorage.getItem('oceancast_active_location');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name && parsed.lat !== undefined && parsed.lon !== undefined) {
          this.selectedLocation.set(parsed);
        }
      } catch (e) {
        console.error('Failed to parse active location settings:', e);
      }
    }
  }
}
