import { Injectable, signal } from '@angular/core';

export interface UserSettings {
  tempUnit: 'C' | 'F';
  windUnit: 'kmh' | 'ms' | 'kt';
  waveUnit: 'm' | 'ft';
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public settings = signal<UserSettings>({
    tempUnit: 'C',
    windUnit: 'kmh',
    waveUnit: 'm',
  });

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('oceancast_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.settings.set({
          tempUnit: parsed.tempUnit || 'C',
          windUnit: parsed.windUnit || 'kmh',
          waveUnit: parsed.waveUnit || 'm',
        });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }

  public setTempUnit(unit: 'C' | 'F'): void {
    this.settings.update(s => ({ ...s, tempUnit: unit }));
    this.saveSettings();
  }

  public setWindUnit(unit: 'kmh' | 'ms' | 'kt'): void {
    this.settings.update(s => ({ ...s, windUnit: unit }));
    this.saveSettings();
  }

  public setWaveUnit(unit: 'm' | 'ft'): void {
    this.settings.update(s => ({ ...s, waveUnit: unit }));
    this.saveSettings();
  }

  private saveSettings(): void {
    localStorage.setItem('oceancast_settings', JSON.stringify(this.settings()));
  }

  public formatTemp(celsius: number): string {
    if (this.settings().tempUnit === 'F') {
      const fahrenheit = (celsius * 9) / 5 + 32;
      return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  }

  public formatWind(kmh: number): string {
    const unit = this.settings().windUnit;
    if (unit === 'ms') return `${(kmh / 3.6).toFixed(1)} m/s`;
    if (unit === 'kt') return `${(kmh * 0.539957).toFixed(1)} kt`;
    return `${Math.round(kmh)} km/h`;
  }

  public formatWave(meters: number): string {
    if (this.settings().waveUnit === 'ft') {
      return `${(meters * 3.28084).toFixed(1)} ft`;
    }
    return `${meters.toFixed(1)} m`;
  }
}
