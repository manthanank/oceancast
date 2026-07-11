import { Injectable, signal } from '@angular/core';

export interface UserSettings {
  tempUnit: 'C' | 'F';
  windUnit: 'kmh' | 'ms' | 'kt';
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  // Signal containing the current user settings configuration
  public settings = signal<UserSettings>({
    tempUnit: 'C',
    windUnit: 'kmh',
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
        });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }

  /**
   * Update temperature unit preference.
   */
  public setTempUnit(unit: 'C' | 'F'): void {
    this.settings.update(s => ({ ...s, tempUnit: unit }));
    this.saveSettings();
  }

  /**
   * Update wind speed unit preference.
   */
  public setWindUnit(unit: 'kmh' | 'ms' | 'kt'): void {
    this.settings.update(s => ({ ...s, windUnit: unit }));
    this.saveSettings();
  }

  private saveSettings(): void {
    localStorage.setItem('oceancast_settings', JSON.stringify(this.settings()));
  }

  /**
   * Formats a temperature value according to user preferences.
   */
  public formatTemp(celsius: number): string {
    if (this.settings().tempUnit === 'F') {
      const fahrenheit = (celsius * 9) / 5 + 32;
      return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  }

  /**
   * Formats a wind speed value according to user preferences.
   */
  public formatWind(kmh: number): string {
    const unit = this.settings().windUnit;
    if (unit === 'ms') {
      const ms = kmh / 3.6;
      return `${ms.toFixed(1)} m/s`;
    } else if (unit === 'kt') {
      const kt = kmh * 0.539957;
      return `${kt.toFixed(1)} kt`;
    }
    return `${Math.round(kmh)} km/h`;
  }
}
