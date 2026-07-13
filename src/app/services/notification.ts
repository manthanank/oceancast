import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth';
import { SettingsService } from './settings';
import { LocationService } from './location';
import { WeatherService } from './weather';

export interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'alert' | 'system';
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private settingsService = inject(SettingsService);
  private locationService = inject(LocationService);
  private weatherService = inject(WeatherService);

  // Global notifications signal
  public notifications = signal<NotificationItem[]>([]);

  // Track unread count
  public unreadCount = signal<number>(0);

  constructor() {
    this.initializeDefaultNotifications();

    // Reactively refresh warnings when selected location, settings, or user auth changes
    effect(() => {
      const user = this.authService.currentUser();
      const activeLoc = this.locationService.selectedLocation();
      if (user && activeLoc) {
        this.checkLiveWeatherWarnings(activeLoc.lat, activeLoc.lon, activeLoc.name);
      }
    });

    // Fetch system announcements at startup
    this.fetchSystemAnnouncement();
  }

  private initializeDefaultNotifications(): void {
    const list: NotificationItem[] = [
      {
        id: 'welcome',
        type: 'info',
        title: 'Welcome to OceanCast!',
        message: 'Explore marine forecasts, wave swells, and solunar windows. Customize your units on the settings page.',
        time: new Date(),
        read: false,
      }
    ];
    this.notifications.set(list);
    this.updateUnreadCount();
  }

  private fetchSystemAnnouncement(): void {
    this.http.get<any>('/api/admin/announcement').subscribe({
      next: (res) => {
        if (res && res.active) {
          const systemAlert: NotificationItem = {
            id: 'announcement_' + Date.now(),
            type: 'system',
            title: 'System Announcement',
            message: res.text,
            time: new Date(),
            read: false,
          };
          // Prepend announcement
          this.notifications.update(list => [
            systemAlert,
            ...list.filter(n => !n.id.startsWith('announcement_'))
          ]);
          this.updateUnreadCount();
        }
      },
    });
  }

  private checkLiveWeatherWarnings(lat: number, lon: number, name: string): void {
    // Only check if user has warning alerts enabled in settings
    const nPrefs = this.settingsService.notificationPrefs();
    if (!nPrefs.swellWarnings && !nPrefs.windWarnings) {
      // Filter out existing warnings
      this.notifications.update(list => list.filter(n => n.id !== 'wave_warning' && n.id !== 'wind_warning'));
      this.updateUnreadCount();
      return;
    }

    this.weatherService.getDashboard(lat, lon).subscribe({
      next: (data) => {
        const warnings: NotificationItem[] = [];

        // 1. Swell Warnings Check
        if (nPrefs.swellWarnings && data.marine?.current?.waveHeight !== undefined) {
          const waveHeight = data.marine.current.waveHeight;
          const formattedWave = this.settingsService.formatWave(waveHeight);
          // Let's assume waves above 2.0m are warning territory
          if (waveHeight >= 2.0) {
            warnings.push({
              id: 'wave_warning',
              type: 'alert',
              title: `🌊 High Swell warning: ${name}`,
              message: `Wave heights are currently ${formattedWave}. Expect choppy waters and strong rip currents.`,
              time: new Date(),
              read: false,
            });
          }
        }

        // 2. Wind Warnings Check
        if (nPrefs.windWarnings && data.weather?.current?.windSpeed !== undefined) {
          const windSpeed = data.weather.current.windSpeed; // km/h
          const formattedWind = this.settingsService.formatWind(windSpeed);
          // Wind speeds above 25 km/h represent Gale warning territory
          if (windSpeed >= 25) {
            warnings.push({
              id: 'wind_warning',
              type: 'warning',
              title: `💨 Gusty Wind advisory: ${name}`,
              message: `Wind speeds are currently ${formattedWind}. High winds detected, please verify safety before planning.`,
              time: new Date(),
              read: false,
            });
          }
        }

        // Merge into global notifications signal
        this.notifications.update(list => {
          // Remove old wave/wind warning instances first to avoid duplicate pollution
          const filtered = list.filter(n => n.id !== 'wave_warning' && n.id !== 'wind_warning');
          return [...warnings, ...filtered];
        });
        this.updateUnreadCount();
      },
      error: (err) => console.error('[NotificationService] Weather check failed:', err)
    });
  }

  public markAllAsRead(): void {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.updateUnreadCount();
  }

  public markAsRead(id: string): void {
    this.notifications.update(list => list.map(n => n.id === id ? { ...n, read: true } : n));
    this.updateUnreadCount();
  }

  public deleteNotification(id: string): void {
    this.notifications.update(list => list.filter(n => n.id !== id));
    this.updateUnreadCount();
  }

  private updateUnreadCount(): void {
    const unread = this.notifications().filter(n => !n.read).length;
    this.unreadCount.set(unread);
  }
}
