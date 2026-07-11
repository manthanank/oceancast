import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ToastService } from '../../services/toast';
import { LocationService } from '../../services/location';

@Component({
  selector: 'app-anchor',
  imports: [],
  templateUrl: './anchor.html',
  styleUrl: './anchor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Anchor implements OnDestroy {
  private toastService = inject(ToastService);
  private meta = inject(Meta);
  public locationService = inject(LocationService);

  // Anchor Coordinates
  public anchorLat = signal<number | null>(null);
  public anchorLon = signal<number | null>(null);
  public safetyRadius = signal<number>(30); // in meters

  // Current State
  public currentLat = signal<number | null>(null);
  public currentLon = signal<number | null>(null);
  public gpsAccuracy = signal<number | null>(null);
  public currentDistance = signal<number | null>(null);

  // Simulation status
  public isArmed = signal<boolean>(false);
  public isDragging = signal<boolean>(false);

  private watchId: number | null = null;
  private audioContext?: AudioContext;

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Anchor Drag Alert Simulator. Arm a safety boundary using GPS to watch for anchor slippage or boat drifting alerts.',
    });
  }

  public ngOnDestroy(): void {
    this.disarmAlert();
  }

  /**
   * Set anchor point to current active location coordinate presets.
   */
  public useActiveLocation(): void {
    const loc = this.locationService.selectedLocation();
    this.anchorLat.set(loc.lat);
    this.anchorLon.set(loc.lon);
    this.toastService.show(`Anchor set to preset: ${loc.name}`, 'info');
  }

  /**
   * Trigger device GPS to lock anchor point.
   */
  public dropAnchorGPS(): void {
    if (!navigator.geolocation) {
      this.toastService.show('Geolocation is not supported by your browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.anchorLat.set(pos.coords.latitude);
        this.anchorLon.set(pos.coords.longitude);
        this.toastService.show('Anchor dropped at current GPS position!', 'success');
      },
      (err) => {
        this.toastService.show(`Failed to get GPS lock: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true }
    );
  }

  /**
   * Enable real-time GPS tracking boundary watcher.
   */
  public armAlert(): void {
    const lat = this.anchorLat();
    const lon = this.anchorLon();

    if (lat === null || lon === null) {
      this.toastService.show('Please set anchor coordinates first.', 'error');
      return;
    }

    if (!navigator.geolocation) {
      this.toastService.show('Geolocation tracking is not supported.', 'error');
      return;
    }

    this.isArmed.set(true);
    this.isDragging.set(false);
    this.toastService.show('Anchor Drag Alarm ARMED and watching scope!', 'success');

    // Start watching position changes
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const curLat = pos.coords.latitude;
        const curLon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        this.currentLat.set(curLat);
        this.currentLon.set(curLon);
        this.gpsAccuracy.set(accuracy);

        // Calculate distance in meters using Haversine formula
        const distance = this.calculateDistance(lat, lon, curLat, curLon);
        this.currentDistance.set(parseFloat(distance.toFixed(1)));

        // Check if boat is dragging outside safety radius scope bounds
        if (distance > this.safetyRadius()) {
          if (!this.isDragging()) {
            this.isDragging.set(true);
            this.toastService.show('⚠️ DANGER: ANCHOR DRAGGING DETECTED!', 'error');
          }
          this.playBeepAlarm();
        } else {
          this.isDragging.set(false);
        }
      },
      (err) => {
        this.toastService.show(`Tracking error: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }

  /**
   * Stop position tracking watch.
   */
  public disarmAlert(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isArmed.set(false);
    this.isDragging.set(false);
    this.currentDistance.set(null);
    this.gpsAccuracy.set(null);
    this.toastService.show('Alarm disarmed.', 'info');
  }

  /**
   * Set radius limit bounds.
   */
  public setRadius(radius: number): void {
    this.safetyRadius.set(radius);
    if (this.isArmed() && this.currentDistance() !== null) {
      const distance = this.currentDistance() || 0;
      this.isDragging.set(distance > radius);
    }
  }

  /**
   * Math helper: Haversine formula calculates distance between 2 points in meters.
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Audio synthesizer helper: Plays a repeating warning alarm tone.
   */
  private playBeepAlarm(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // High pitch A note

      gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(this.audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio Context alarm beep blocked by browser permissions', e);
    }
  }
}
