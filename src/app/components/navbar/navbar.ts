import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotificationService, NotificationItem } from '../../services/notification';
import { DatePipe } from '@angular/common';
import { TrackService } from '../../services/track';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  public trackService = inject(TrackService);
  private router = inject(Router);

  // Mobile drawer state
  public isMobileMenuOpen = signal<boolean>(false);

  // Global notification panel state
  public isNotificationsOpen = signal<boolean>(false);

  public toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  public closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  public toggleNotificationsPanel(): void {
    this.isNotificationsOpen.update(val => !val);
  }

  public closeNotificationsPanel(): void {
    this.isNotificationsOpen.set(false);
  }

  public markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  public markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
  }

  public deleteNotification(id: string, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(id);
  }

  public logout(): void {
    this.closeMobileMenu();
    this.closeNotificationsPanel();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
