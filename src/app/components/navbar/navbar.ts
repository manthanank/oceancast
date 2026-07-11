import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  public authService = inject(AuthService);
  private router = inject(Router);

  // Mobile drawer state
  public isMobileMenuOpen = signal<boolean>(false);

  /**
   * Toggles the overlay mobile sub-navigation drawer panel.
   */
  public toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  /**
   * Closes the overlay mobile drawer panel.
   */
  public closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  /**
   * Log out of current session and redirect back to login.
   */
  public logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
