import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private meta = inject(Meta);

  public ngOnInit(): void {
    // Dynamically set SEO meta tags
    this.meta.updateTag({
      name: 'description',
      content: 'OceanCast offers marine weather forecasts, ocean swell metrics, astronomical tide curves, and Gemini AI planning for motorcycling, surfing, and fishing.',
    });

    // Automatically bypass landing page if the user is already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Seamless Guest Access session initializer for tech-free fishermen
   */
  public loginAsGuest(): void {
    const guestUser = {
      id: '660000000000000000000000',
      name: 'Guest Fisherman',
      email: 'guest@oceancast.local',
      role: 'standard' as const,
      preferences: {
        swellWarnings: true,
        windWarnings: true,
        solunarAlerts: true,
      },
    };
    
    // Set localStorage mock key for interceptor verification
    localStorage.setItem('oceancast_token', 'guest_jwt_token_mock');
    this.authService.setCurrentUser(guestUser);
    
    this.router.navigate(['/dashboard']);
  }
}
