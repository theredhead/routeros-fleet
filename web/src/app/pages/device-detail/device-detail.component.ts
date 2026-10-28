import { DeviceNavigationService } from '../../core/device-navigation.service';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UIJsonView } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { NotificationsService } from '../../core/notifications.service';
import { Customer, Device, DeviceDetailsSnapshot } from '../../models';
import { RefreshButtonComponent } from '../../shared/refresh-button.component';
import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { DeviceDialogComponent } from '../device-list/device-dialog.component';
@Component({
  selector: 'app-device-detail',
  imports: [RouterLink, UISurface, UIButton, UIJsonView, RefreshButtonComponent, DisclosableComponent, HelpPopoverComponent, DeviceDialogComponent],
  templateUrl: './device-detail.component.html',
  styleUrl: './device-detail.component.scss',
})
export class DeviceDetailComponent {
  private readonly navigation = inject(DeviceNavigationService);
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationsService);
  private generation = 0;
  readonly id = signal('');
  readonly stored = signal<DeviceDetailsSnapshot | null>(null);
  readonly live = signal<Record<string, unknown> | null>(null);
  readonly customers = signal<Customer[]>([]);
  readonly editing = signal(false);
  readonly loadingStored = signal(false);
  readonly loadingLive = signal(false);
  readonly error = signal('');
  readonly snapshot = computed(() => ({stored: this.stored(), live: this.live()}));
  readonly liveError = computed(() => this.live()?.['status'] === 'unavailable' ? String(this.live()?.['message']) : '');
  constructor() {
    inject(LiveUpdatesService).watch(['devices', 'customers', 'configuration', 'jobs', 'diagnostics'], () => this.loadStored(), () => this.loadingStored());
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.generation++; this.id.set(params.get('id')!); this.navigation.current.set({id: this.id(), name: 'Device details'}); this.stored.set(null); this.live.set(null); this.editing.set(false); this.refresh();
    });
    inject(DestroyRef).onDestroy(() => {this.generation++; this.navigation.current.set(null);});
  }
  refresh(): void { void this.loadStored(); void this.loadLive(); }
  async loadStored(): Promise<void> {
    const generation = this.generation; this.loadingStored.set(true); this.error.set('');
    try { const stored = await firstValueFrom(this.api.getDeviceDetails(this.id())); if (generation === this.generation) {this.stored.set(stored); this.navigation.current.set({id: stored.device.id, name: stored.device.hostname});} }
    catch { if (generation === this.generation) this.error.set('Could not load stored device details. Check API availability and whether this device still exists, then retry.'); }
    finally { if (generation === this.generation) this.loadingStored.set(false); }
  }
  private async loadLive(): Promise<void> {
    const generation = this.generation; this.loadingLive.set(true);
    try { const live = await firstValueFrom(this.api.inspectDevice(this.id())); if (generation === this.generation) this.live.set(live); }
    catch { if (generation === this.generation) this.live.set({status: 'unavailable', message: 'Could not retrieve a live router snapshot. Stored data remains visible.'}); }
    finally { if (generation === this.generation) this.loadingLive.set(false); }
  }
  async edit(): Promise<void> {
    try { this.customers.set(await firstValueFrom(this.api.listCustomers())); this.editing.set(true); }
    catch { this.notifications.error('Could not load customer choices. Retry when the API is available.'); }
  }
  onSaved(device: Device): void { this.editing.set(false); this.notifications.success(`${device.hostname} saved.`); void this.loadStored(); }
}
