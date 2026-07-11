import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private toastService = inject(ToastService);
  public authService = inject(AuthService);

  public isSaving = signal<boolean>(false);
  public metrics = signal<any | null>(null);

  // User alert settings choices
  public swellWarnings = signal<boolean>(true);
  public windWarnings = signal<boolean>(true);
  public solunarAlerts = signal<boolean>(true);

  // Personal details credentials form
  public profileForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
  });

  public ngOnInit(): void {
    this.fetchProfileDetails();
  }

  /**
   * Fetch details dynamically to override stale client state.
   */
  private fetchProfileDetails(): void {
    this.http.get<any>('/api/auth/me').subscribe({
      next: (res) => {
        this.profileForm.setValue({
          name: res.name || '',
          email: res.email || '',
        });

        const pref = res.preferences || {};
        this.swellWarnings.set(pref.swellWarnings !== false);
        this.windWarnings.set(pref.windWarnings !== false);
        this.solunarAlerts.set(pref.solunarAlerts !== false);
        this.metrics.set(res.metrics || null);
      },
    });
  }

  /**
   * Submit profile fields and preferences to backend.
   */
  public saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const payload = {
      name: this.profileForm.value.name,
      email: this.profileForm.value.email,
      preferences: {
        swellWarnings: this.swellWarnings(),
        windWarnings: this.windWarnings(),
        solunarAlerts: this.solunarAlerts(),
      },
    };

    this.http.put<any>('/api/auth/profile', payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.toastService.show('Profile saved successfully', 'success');
        this.authService.setCurrentUser(res.user);
        this.metrics.set(res.metrics || null);
      },
      error: (err) => {
        this.isSaving.set(false);
        const errorMsg = err.error?.error || 'Failed to update profile settings';
        this.toastService.show(errorMsg, 'error');
      },
    });
  }
}
