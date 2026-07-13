import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private meta = inject(Meta);

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Sign in to your OceanCast account to view saved surf spots, marine conditions, and weather reports.',
    });
  }

  // Signal to handle request loading indicator
  public isLoading = signal<boolean>(false);

  // Toggle visibility of password input
  public showPassword = signal<boolean>(false);

  public loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  /**
   * Submit login credential payload to backend auth.
   */
  public onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const { email, password, rememberMe } = this.loginForm.value;

    this.authService.login(email, password, !!rememberMe).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.toastService.show(`Welcome back, ${res.user.name}!`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading.set(false);
        // Toast notifications are already triggered globally by our HttpInterceptor
      },
    });
  }
}
