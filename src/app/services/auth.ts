import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'standard' | 'admin';
  preferences?: {
    swellWarnings: boolean;
    windWarnings: boolean;
    solunarAlerts: boolean;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);

  // Signals to manage reactive authentication state
  public currentUser = signal<User | null>(null);

  // Computed signal to easily check login status
  public isAuthenticated = computed(() => !!this.currentUser() || !!this.getToken());

  constructor() {
    this.checkInitialAuth();
  }

  /**
   * Register a new user account.
   */
  public register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { name, email, password }).pipe(
      tap((res) => {
        this.saveToken(res.token);
        this.currentUser.set(res.user);
      })
    );
  }

  /**
   * Log in an existing user.
   */
  public login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => {
        this.saveToken(res.token);
        this.currentUser.set(res.user);
      })
    );
  }

  /**
   * Fetch current user profile details using the stored token.
   */
  public fetchProfile(): Observable<User> {
    return this.http.get<User>('/api/auth/me').pipe(
      tap((user) => {
        this.currentUser.set(user);
      })
    );
  }

  public setCurrentUser(user: User): void {
    this.currentUser.set(user);
  }

  /**
   * Terminate user session.
   */
  public logout(): void {
    localStorage.removeItem('oceancast_token');
    this.currentUser.set(null);
  }

  /**
   * Retrieve JWT from localStorage.
   */
  public getToken(): string | null {
    return localStorage.getItem('oceancast_token');
  }

  private saveToken(token: string): void {
    localStorage.setItem('oceancast_token', token);
  }

  private checkInitialAuth(): void {
    const token = this.getToken();
    if (token) {
      this.fetchProfile().subscribe({
        error: (err) => {
          console.warn('Initial session restore failed (likely token expired).', err);
          this.logout();
        }
      });
    }
  }
}
