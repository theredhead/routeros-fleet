import { Injectable, signal } from '@angular/core';
@Injectable({providedIn: 'root'})
export class DeviceNavigationService {
  readonly current = signal<{id: string; name: string} | null>(null);
}
