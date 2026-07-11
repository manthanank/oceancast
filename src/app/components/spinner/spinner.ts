import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  imports: [],
  templateUrl: './spinner.html',
  styleUrl: './spinner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spinner {
  // Use modern signal-based inputs
  public message = input<string>('Loading...');
  public fullPage = input<boolean>(false);
}
