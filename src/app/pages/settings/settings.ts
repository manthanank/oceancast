import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsService, NotificationPrefs } from '../../services/settings';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  public settingsService = inject(SettingsService);
  public authService = inject(AuthService);

  public changeTempUnit(unit: 'C' | 'F'): void {
    this.settingsService.setTempUnit(unit);
  }

  public changeWindUnit(unit: 'kmh' | 'ms' | 'kt'): void {
    this.settingsService.setWindUnit(unit);
  }

  public changeWaveUnit(unit: 'm' | 'ft'): void {
    this.settingsService.setWaveUnit(unit);
  }

  public toggleNotification(key: keyof NotificationPrefs): void {
    this.settingsService.toggleNotification(key);
  }
}
