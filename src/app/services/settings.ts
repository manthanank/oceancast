import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth';

export interface UserSettings {
  tempUnit: 'C' | 'F';
  windUnit: 'kmh' | 'ms' | 'kt';
  waveUnit: 'm' | 'ft';
}

export interface NotificationPrefs {
  swellWarnings: boolean;
  windWarnings: boolean;
  solunarAlerts: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Signals for local preferences
  public settings = signal<UserSettings>({
    tempUnit: 'C',
    windUnit: 'kmh',
    waveUnit: 'm',
  });

  public notificationPrefs = signal<NotificationPrefs>({
    swellWarnings: true,
    windWarnings: true,
    solunarAlerts: true,
  });

  constructor() {
    this.loadSettings();

    // Reactively update settings when auth profile is fetched/changed
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        if (user.unitPrefs) {
          this.settings.set({
            tempUnit: user.unitPrefs.tempUnit || 'C',
            windUnit: user.unitPrefs.windUnit || 'kmh',
            waveUnit: user.unitPrefs.waveUnit || 'm',
          });
        }
        if (user.preferences) {
          this.notificationPrefs.set({
            swellWarnings: user.preferences.swellWarnings !== false,
            windWarnings: user.preferences.windWarnings !== false,
            solunarAlerts: user.preferences.solunarAlerts !== false,
          });
        }
      }
    });
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
    this.syncToServer();
  }

  public setWindUnit(unit: 'kmh' | 'ms' | 'kt'): void {
    this.settings.update(s => ({ ...s, windUnit: unit }));
    this.saveSettings();
    this.syncToServer();
  }

  public setWaveUnit(unit: 'm' | 'ft'): void {
    this.settings.update(s => ({ ...s, waveUnit: unit }));
    this.saveSettings();
    this.syncToServer();
  }

  public toggleNotification(key: keyof NotificationPrefs): void {
    this.notificationPrefs.update(n => ({ ...n, [key]: !n[key] }));
    this.syncToServer();
  }

  private saveSettings(): void {
    localStorage.setItem('oceancast_settings', JSON.stringify(this.settings()));
  }

  private syncToServer(): void {
    if (this.authService.isAuthenticated()) {
      const payload = {
        unitPrefs: this.settings(),
        preferences: this.notificationPrefs(),
      };
      this.http.put<any>('/api/auth/profile', payload).subscribe({
        next: (res) => {
          if (res.user) {
            // Silently update user info in AuthService to maintain synchronization
            this.authService.currentUser.set(res.user);
          }
        },
        error: (err) => {
          console.error('[Settings] Failed to sync preferences with server:', err);
        }
      });
    }
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
