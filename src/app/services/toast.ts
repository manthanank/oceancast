import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  // A signal to hold the active toasts list
  public toasts = signal<Toast[]>([]);
  private counter = 0;

  /**
   * Publish a toast notification message.
   * @param message Text to display
   * @param type Style theme
   * @param duration Milliseconds before automatic dismissal
   */
  public show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3500): void {
    const id = ++this.counter;
    const toast: Toast = { id, message, type };
    
    this.toasts.update(current => [...current, toast]);

    // Auto-dismiss after the duration
    setTimeout(() => {
      this.dismiss(id);
    }, duration);
  }

  /**
   * Manually dismiss a specific toast message.
   */
  public dismiss(id: number): void {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}
