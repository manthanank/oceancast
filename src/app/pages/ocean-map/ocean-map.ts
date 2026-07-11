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
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { LocationService } from '../../services/location';
import { SettingsService } from '../../services/settings';

interface GridPoint {
  lat: number;
  lon: number;
  windSpeed: number;
  windDir: number;
  waveHeight: number;
}

@Component({
  selector: 'app-ocean-map',
  imports: [],
  templateUrl: './ocean-map.html',
  styleUrl: './ocean-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OceanMap implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  public locationService = inject(LocationService);
  public settingsService = inject(SettingsService);

  public isLoading = signal(false);
  public lastUpdated = signal<string | null>(null);
  public activeLayer = signal<'wind' | 'fishing' | 'both'>('both');

  private map!: L.Map;
  private overlayLayers: L.Layer[] = [];
  private locationMarker?: L.Marker;

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  public ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  private initMap(): void {
    const el = document.getElementById('ocean-map');
    if (!el || this.map) return;

    const loc = this.locationService.selectedLocation();

    this.map = L.map('ocean-map', {
      center: [loc.lat, loc.lon],
      zoom: 6,
      zoomControl: true,
    });

    // Dark-styled OpenStreetMap tile layer for ocean look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(this.map);

    // Active location pin
    this.addLocationPin(loc.lat, loc.lon, loc.name);

    // Fetch grid data when map finishes moving
    this.map.on('moveend', () => {
      this.zone.run(() => this.loadGridData());
    });

    // Initial load
    this.loadGridData();
  }

  private addLocationPin(lat: number, lon: number, name: string): void {
    if (this.locationMarker) this.locationMarker.remove();

    const icon = L.divIcon({
      html: `<div style="
        width: 14px; height: 14px;
        background: #22d3ee;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(34,211,238,0.3), 0 2px 8px rgba(0,0,0,0.6);
      "></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    this.locationMarker = L.marker([lat, lon], { icon })
      .addTo(this.map)
      .bindPopup(`<b style="color:#0f172a">📍 ${name}</b><br><span style="font-size:11px;color:#475569">Active Location</span>`);
  }

  /**
   * Fetch condition grid from backend and render overlays.
   */
  public loadGridData(): void {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    const north = bounds.getNorth().toFixed(4);
    const south = bounds.getSouth().toFixed(4);
    const east = bounds.getEast().toFixed(4);
    const west = bounds.getWest().toFixed(4);

    this.isLoading.set(true);
    this.cdr.markForCheck();

    this.http.get<GridPoint[]>(
      `/api/map/conditions?north=${north}&south=${south}&east=${east}&west=${west}`
    ).subscribe({
      next: (points) => {
        this.zone.run(() => {
          this.renderOverlays(points);
          this.isLoading.set(false);
          this.lastUpdated.set(new Date().toLocaleTimeString());
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Clear existing overlays and render wind arrows + fishing heat map.
   */
  private renderOverlays(points: GridPoint[]): void {
    // Remove old overlays
    this.overlayLayers.forEach(l => l.remove());
    this.overlayLayers = [];

    const layer = this.activeLayer();

    points.forEach(pt => {
      if (layer === 'fishing' || layer === 'both') {
        this.addFishingZoneCircle(pt);
      }
      if (layer === 'wind' || layer === 'both') {
        this.addWindArrow(pt);
      }
    });
  }

  /**
   * Colored semi-transparent circle showing fishing safety zone.
   */
  private addFishingZoneCircle(pt: GridPoint): void {
    // Thresholds: waveMax 1.5m, windMax 15 km/h
    const safe = pt.waveHeight < 1.5 && pt.windSpeed < 15;
    const danger = pt.waveHeight > 2.5 || pt.windSpeed > 25;

    const color = safe ? '#22c55e' : danger ? '#ef4444' : '#f59e0b';
    const fillOpacity = safe ? 0.18 : danger ? 0.28 : 0.22;

    // Radius in meters — bigger circle at wider zooms
    const zoom = this.map.getZoom();
    const radius = Math.max(15000, 80000 / zoom);

    const circle = L.circle([pt.lat, pt.lon], {
      radius,
      color,
      fillColor: color,
      fillOpacity,
      weight: 1,
      opacity: 0.5,
    }).bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;min-width:130px;">
        <b style="color:${color}">${safe ? '🟢 Safe to Fish' : danger ? '🔴 Dangerous' : '🟡 Use Caution'}</b><br>
        🌊 Swell: <b>${pt.waveHeight.toFixed(1)}m</b><br>
        💨 Wind: <b>${this.settingsService.formatWind(pt.windSpeed)}</b><br>
        <span style="font-size:10px;color:#64748b">${pt.lat.toFixed(2)}°, ${pt.lon.toFixed(2)}°</span>
      </div>
    `);

    circle.addTo(this.map);
    this.overlayLayers.push(circle);
  }

  /**
   * Directional wind arrow at each grid point.
   */
  private addWindArrow(pt: GridPoint): void {
    const speed = pt.windSpeed;
    const dir = pt.windDir;

    // Color arrow by wind speed
    const color = speed < 10 ? '#34d399' : speed < 20 ? '#fbbf24' : '#f87171';

    const icon = L.divIcon({
      html: `
        <div style="transform: rotate(${dir}deg); display:flex; align-items:center; justify-content:center; width:32px; height:32px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L7 10H10V22H14V10H17L12 2Z" fill="${color}" fill-opacity="0.9" stroke="rgba(0,0,0,0.4)" stroke-width="0.5"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([pt.lat, pt.lon], { icon, interactive: true })
      .bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;min-width:130px;">
          <b style="color:#0f172a">💨 Wind Conditions</b><br>
          Speed: <b>${this.settingsService.formatWind(speed)}</b><br>
          Direction: <b>${dir}°</b> (${this.degToCompass(dir)})<br>
          <span style="font-size:10px;color:#64748b">${pt.lat.toFixed(2)}°, ${pt.lon.toFixed(2)}°</span>
        </div>
      `);

    marker.addTo(this.map);
    this.overlayLayers.push(marker);
  }

  /** Convert degrees to compass bearing label */
  public degToCompass(deg: number): string {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  /** Switch overlay and re-render */
  public setLayer(layer: 'wind' | 'fishing' | 'both'): void {
    this.activeLayer.set(layer);
    this.loadGridData();
  }

  /** Pan map to the active selected location */
  public panToLocation(): void {
    const loc = this.locationService.selectedLocation();
    if (this.map) {
      this.map.setView([loc.lat, loc.lon], 6);
      this.addLocationPin(loc.lat, loc.lon, loc.name);
    }
  }
}
