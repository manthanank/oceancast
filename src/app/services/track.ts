import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Visit {
  message: string;
  projectName: string;
  uniqueVisitors: number;
}

@Injectable({
  providedIn: 'root',
})
export class TrackService {
  private apiURL = environment.trackingApiUrl;
  private http = inject(HttpClient);

  // Shared signal for tracking count across components
  public uniqueVisitors = signal<number>(0);
  public isLoading = signal<boolean>(false);

  public trackProjectVisit(projectName: string): Observable<Visit> {
    this.isLoading.set(true);
    return this.http.post<Visit>(this.apiURL, { projectName }).pipe(
      tap((res) => {
        if (res && res.uniqueVisitors) {
          this.uniqueVisitors.set(res.uniqueVisitors);
        }
        this.isLoading.set(false);
      })
    );
  }
}
