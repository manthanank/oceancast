import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ToastService } from '../../services/toast';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);

  public isLoading = signal<boolean>(false);
  public success = signal<boolean>(false);
  public tokenInvalid = signal<boolean>(false);
  private token: string = '';

  public resetForm: FormGroup = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  public ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.tokenInvalid.set(true);
    }
  }

  public onSubmit(): void {
    if (this.resetForm.invalid || !this.token) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.http.post('/api/auth/reset-password', {
      token: this.token,
      newPassword: this.resetForm.value.newPassword,
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.success.set(true);
        this.toastService.show('Password reset! You can now log in.', 'success');
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.error || 'Reset link is invalid or expired.';
        this.toastService.show(msg, 'error');
        if (err.status === 400) this.tokenInvalid.set(true);
      },
    });
  }
}
