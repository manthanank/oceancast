import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPass = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return newPass && confirm && newPass !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, FormsModule, DatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private toastService = inject(ToastService);
  public authService = inject(AuthService);

  public isSaving = signal<boolean>(false);
  public isChangingPassword = signal<boolean>(false);
  public isDeletingAccount = signal<boolean>(false);
  public showDeleteConfirm = signal<boolean>(false);
  public deleteConfirmText = '';
  public metrics = signal<any | null>(null);
  public lastLoginAt = signal<string | null>(null);

  // Toggle visibility of password inputs
  public showCurrentPassword = signal<boolean>(false);
  public showNewPassword = signal<boolean>(false);
  public showConfirmPassword = signal<boolean>(false);

  // Personal details credentials form
  public profileForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
  });

  // Change password form
  public passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  public ngOnInit(): void {
    this.fetchProfileDetails();
  }

  private fetchProfileDetails(): void {
    this.http.get<any>('/api/auth/me').subscribe({
      next: (res) => {
        this.profileForm.setValue({
          name: res.name || '',
          email: res.email || '',
        });

        this.metrics.set(res.metrics || null);
        this.lastLoginAt.set(res.lastLoginAt || null);
      },
    });
  }

  public saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const payload = {
      name: this.profileForm.value.name,
      email: this.profileForm.value.email,
    };

    this.http.put<any>('/api/auth/profile', payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.toastService.show('Profile details updated successfully', 'success');
        this.authService.setCurrentUser(res.user);
        this.metrics.set(res.metrics || null);
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  public changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isChangingPassword.set(true);
    this.http.post('/api/auth/change-password', {
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword,
    }).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.toastService.show('Password changed successfully!', 'success');
        this.passwordForm.reset();
      },
      error: () => {
        this.isChangingPassword.set(false);
      },
    });
  }

  public deleteAccount(): void {
    if (this.deleteConfirmText !== 'DELETE') return;
    this.isDeletingAccount.set(true);

    this.http.delete('/api/auth/account', { body: { confirmText: 'DELETE' } }).subscribe({
      next: () => {
        this.isDeletingAccount.set(false);
        this.toastService.show('Your account has been permanently deleted.', 'error');
        this.authService.logout();
        this.router.navigate(['/']);
      },
      error: () => {
        this.isDeletingAccount.set(false);
      },
    });
  }
}
