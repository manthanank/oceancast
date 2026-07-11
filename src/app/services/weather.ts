import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  private http = inject(HttpClient);

  /**
   * Fetch weather forecast for coordinates.
   */
  public getWeather(lat: number, lon: number): Observable<any> {
    return this.http.get('/api/weather', { params: { lat: lat.toString(), lon: lon.toString() } });
  }

  /**
   * Fetch ocean wave forecast for coordinates.
   */
  public getMarine(lat: number, lon: number): Observable<any> {
    return this.http.get('/api/marine', { params: { lat: lat.toString(), lon: lon.toString() } });
  }

  /**
   * Fetch simulated tide cycles forecast for coordinates.
   */
  public getTides(lat: number, lon: number): Observable<any> {
    return this.http.get('/api/tides', { params: { lat: lat.toString(), lon: lon.toString() } });
  }

  /**
   * Fetch unified dashboard status (weather + marine + tides) in one request.
   */
  public getDashboard(lat: number, lon: number): Observable<any> {
    return this.http.get('/api/dashboard', { params: { lat: lat.toString(), lon: lon.toString() } });
  }
}
