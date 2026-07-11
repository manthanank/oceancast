import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Public Routes
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Login - OceanCast Marine Weather',
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
    title: 'Create Account - OceanCast',
  },

  // Private Routes (Protected by AuthGuard)
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: 'Dashboard - OceanCast Marine weather overview',
  },
  {
    path: 'weather',
    loadComponent: () => import('./pages/weather/weather').then((m) => m.Weather),
    canActivate: [authGuard],
    title: 'Detailed Weather Forecast - OceanCast',
  },
  {
    path: 'marine',
    loadComponent: () => import('./pages/marine/marine').then((m) => m.Marine),
    canActivate: [authGuard],
    title: 'Wave Swell Heights & Period Forecast - OceanCast',
  },
  {
    path: 'tides',
    loadComponent: () => import('./pages/tides/tides').then((m) => m.Tides),
    canActivate: [authGuard],
    title: 'Tidal Curves & High/Low Predictions - OceanCast',
  },
  {
    path: 'solunar',
    loadComponent: () => import('./pages/solunar/solunar').then((m) => m.Solunar),
    canActivate: [authGuard],
    title: 'Solunar Fishing Calendar & Peak Bite Hours - OceanCast',
  },
  {
    path: 'locations',
    loadComponent: () => import('./pages/locations/locations').then((m) => m.Locations),
    canActivate: [authGuard],
    title: 'Your Saved Observation Locations - OceanCast',
  },
  {
    path: 'map',
    loadComponent: () => import('./pages/ocean-map/ocean-map').then((m) => m.OceanMap),
    canActivate: [authGuard],
    title: 'Ocean Map — Wind & Fishing Zones - OceanCast',
  },
  {
    path: 'ai',
    loadComponent: () => import('./pages/ai-chat/ai-chat').then((m) => m.AiChat),
    canActivate: [authGuard],
    title: 'OceanCast AI Assistant Chat',
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
    title: 'Your Profile - OceanCast',
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
    canActivate: [authGuard],
    title: 'Preferences Settings - OceanCast',
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    canActivate: [authGuard],
    title: 'Admin Management Console - OceanCast',
  },

  // Redirections and Wildcard
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
    pathMatch: 'full',
    title: 'OceanCast - Marine Weather & Tides Forecast',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
    title: 'Page Not Found - OceanCast',
  },
];
