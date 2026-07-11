import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { SettingsService } from '../../services/settings';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  public settingsService = inject(SettingsService);

  public changeTempUnit(unit: 'C' | 'F'): void {
    this.settingsService.setTempUnit(unit);
  }

  public changeWindUnit(unit: 'kmh' | 'ms' | 'kt'): void {
    this.settingsService.setWindUnit(unit);
  }

  public changeWaveUnit(unit: 'm' | 'ft'): void {
    this.settingsService.setWaveUnit(unit);
  }
}
