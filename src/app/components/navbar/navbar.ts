import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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

  /**
   * Log out of current session and redirect back to login.
   */
  public logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
