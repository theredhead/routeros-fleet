import { NotificationsService } from '../../core/notifications.service';
import { OverviewFilterComponent } from '../../filters/overview-filter.component';
import { emptyFilter, filterRows } from '../../filters/overview-filter';
import type { FilterExpression } from '@theredhead/lucid-kit';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { ObjectActionsComponent } from '../../shared/object-actions.component';
import { DeviceDialogComponent } from './device-dialog.component';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { OverviewStateComponent } from '../../shared/overview-state.component';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArrayDatasource, UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UITableView, UITextColumn, UITemplateColumn } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { Customer, Device } from '../../models';

@Component({
  selector: 'app-device-list',
  host: {class: 'overview-page'},
  imports: [OverviewFilterComponent, ObjectActionsComponent, DeviceDialogComponent, OverviewStateComponent, HelpPopoverComponent, RouterLink, UISurface, UIButton, UITableView, UITextColumn, UITemplateColumn],
  templateUrl: './device-list.component.html',
})
export class DeviceListComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly dialogs = inject(CommonDialogService);
  readonly editing = signal<Device | null>(null);
  readonly removing = signal<string | null>(null);
  readonly filter = signal<FilterExpression>(emptyFilter());
  private readonly api = inject(ApiService);
  readonly customers = signal<Customer[]>([]);
  readonly devices = signal<Device[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly rows = computed(() => this.devices().map(device => ({...device, customerName: device.customer?.name || 'Unassigned'})));
  readonly visible = computed(() => filterRows(this.rows(), 'devices', this.filter()));
  readonly datasource = computed(() => new ArrayDatasource(this.visible()));
  constructor() {
    inject(LiveUpdatesService).watch(['devices'], () => this.load(), () => this.loading());
    inject(LiveUpdatesService).watch(['customers'], () => this.loadCustomers());
    this.api.listCustomers().subscribe({ next: customers => this.customers.set(customers), error: error => this.error.set(error.message) });
    void this.load();
  }
  private async loadCustomers(): Promise<void> {
    this.customers.set(await firstValueFrom(this.api.listCustomers()));
  }
  onSaved(device: Device): void {
    this.editing.set(null); this.notifications.success(`${device.hostname} saved.`); void this.load();
  }
  async remove(device: Device): Promise<void> {
    if (this.removing()) return;
    this.removing.set(device.id);
    try {
      if (!await this.dialogs.confirm({title: `Delete ${device.hostname}?`, message: 'This forgets the enrolled device, its stored credentials, and desired configuration. The physical router is unchanged.', confirmLabel: 'Delete device', variant: 'danger'})) return;
      await firstValueFrom(this.api.deleteDevice(device.id));
      this.notifications.success(`${device.hostname} deleted.`); await this.load();
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Request failed.';
      this.notifications.error('Couldn’t delete this device.', message);
    } finally { this.removing.set(null); }
  }
  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { this.devices.set(await firstValueFrom(this.api.listDevices())); }
    catch (error: any) { this.error.set(error?.error?.message || error.message); }
    finally { this.loading.set(false); }
  }
}
