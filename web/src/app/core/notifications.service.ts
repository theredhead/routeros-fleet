import { Injectable, inject } from '@angular/core';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { ToastService } from '@theredhead/lucid-kit';

/** Transient action feedback; persistent loading/validation states stay with their view. */
@Injectable({providedIn: 'root'})
export class NotificationsService {
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(CommonDialogService);
  success(message: string): void { this.toasts.success(message, {duration: 4000, position: 'bottom-right'}); }
  info(message: string): void { this.toasts.info(message, {duration: 4000, position: 'bottom-right'}); }
  warning(message: string): void { this.toasts.warning(message, {duration: 6000, position: 'bottom-right'}); }
  error(message: string, error?: unknown): void {
    const detail: any = error;
    const raw = detail?.error?.message || detail?.message || detail;
    const text = Array.isArray(raw) ? raw.join(', ') : String(raw || 'Request failed.');
    this.toasts.error(message, {duration: 8000, position: 'bottom-right',
      ...(error === undefined ? {} : {actionLabel: 'Details', actionFn: () => { void this.dialogs.alert({title: 'Error details', message: text}); }}),
    });
  }
}
