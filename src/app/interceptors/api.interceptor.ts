import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { ToastService } from '../services/toast';
import { environment } from '../../environments/environment';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);
  const router = inject(Router);
  const injector = inject(Injector);

  // Load API base URL from the environments configuration
  const apiBaseUrl = environment.apiUrl; 
  
  let modifiedReq = req;

  // Intercept relative '/api/' calls
  if (req.url.startsWith('/api/')) {
    // Read directly from localStorage to break circular dependency with AuthService injection
    const token = localStorage.getItem('oceancast_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    modifiedReq = req.clone({
      url: `${apiBaseUrl}${req.url}`,
      setHeaders: headers,
    });
  }

  return next(modifiedReq).pipe(
    catchError((error) => {
      console.error('[HTTP Error Interceptor]:', error);
      
      if (error.status === 401) {
        // Resolve AuthService lazily to avoid circular dependency during bootstrap
        const authService = injector.get(AuthService);
        authService.logout();
        toastService.show('Session expired. Please log in again.', 'error');
        router.navigate(['/login']);
      } else if (error.status === 403) {
        toastService.show('You do not have permission to perform this action.', 'error');
      } else if (error.status === 0) {
        toastService.show('Cannot connect to the server. Please check your connection.', 'error');
      } else {
        // Pull detail error messages returned by our Express backend
        const detailMsg = error.error?.error || error.error?.message || 'An unexpected error occurred';
        toastService.show(detailMsg, 'error');
      }

      return throwError(() => error);
    })
  );
};
