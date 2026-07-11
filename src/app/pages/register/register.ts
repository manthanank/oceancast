import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private meta = inject(Meta);

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Create an account with OceanCast to track weather forecasts, marine waves, tide predictive charts, and consult the Gemini AI outdoor planner.',
    });
  }

  // Signal to handle request loading indicator
  public isLoading = signal<boolean>(false);

  public registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  /**
   * Submit registration payload to backend.
   */
  public onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const { name, email, password } = this.registerForm.value;

    this.authService.register(name, email, password).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.toastService.show(`Registration successful! Welcome, ${res.user.name}`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
