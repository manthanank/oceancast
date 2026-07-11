import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Navbar } from './components/navbar/navbar';
import { Toast } from './components/toast/toast';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  public authService = inject(AuthService);
  private http = inject(HttpClient);
  
  public announcement = signal<{ text: string; active: boolean } | null>(null);

  public ngOnInit(): void {
    // Check for active administration announcement notifications globally
    this.http.get<any>('/api/admin/announcement').subscribe({
      next: (res) => {
        if (res && res.active) {
          this.announcement.set(res);
        }
      },
    });
  }
}
