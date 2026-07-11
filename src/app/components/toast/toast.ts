import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast {
  // Inject the ToastService containing our reactive signal list
  public toastService = inject(ToastService);
}
