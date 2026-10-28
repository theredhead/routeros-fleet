import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { NotificationsService } from '../../core/notifications.service';
import { ScanDialogComponent, DiscoveryScan } from './scan-dialog.component';
import { OverviewFilterComponent } from '../../filters/overview-filter.component';
import { emptyFilter, filterRows } from '../../filters/overview-filter';
import type { FilterExpression } from '@theredhead/lucid-kit';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { OverviewStateComponent } from '../../shared/overview-state.component';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArrayDatasource, UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UITableView, UITextColumn, UITemplateColumn } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { EnrollmentDialogComponent } from './enrollment-dialog.component';
import { Device, DiscoveredDevice } from '../../models';

@Component({
  selector: 'app-discover',
  host: {class: 'overview-page'},
  imports: [DisclosableComponent, ScanDialogComponent, OverviewFilterComponent, OverviewStateComponent, HelpPopoverComponent, UISurface, UIButton, UITableView, UITextColumn, UITemplateColumn, EnrollmentDialogComponent],
  templateUrl: './discover.component.html',
})
export class DiscoverComponent {
  private readonly notifications = inject(NotificationsService);
  readonly filter = signal<FilterExpression>(emptyFilter());
  private readonly api = inject(ApiService);
  readonly scanSetup = signal(false);
  readonly lastScan = signal<DiscoveryScan | null>(null);
  readonly inventoryLoading = signal(false);
  readonly inventoryError = signal('');
  readonly scanning = signal(false);
  readonly searched = signal(false);
  readonly error = signal('');
  readonly results = signal<DiscoveredDevice[]>([]);
  readonly known = signal<Device[]>([]);
  readonly selected = signal<DiscoveredDevice | null>(null);
  readonly visible = computed(() => filterRows(this.results(), 'discovery', this.filter()));
  readonly datasource = computed(() => new ArrayDatasource(this.visible()));


  constructor() {
    inject(LiveUpdatesService).watch(['devices'], () => this.loadInventory());
    void this.loadInventory();
  }

  async loadInventory(): Promise<void> {
    this.inventoryLoading.set(true);
    try {
      this.known.set(await firstValueFrom(this.api.listDevices()));
      this.inventoryError.set('');
    } catch (error) { this.inventoryError.set(this.message(error)); }
    finally { this.inventoryLoading.set(false); }
  }

  isKnown(device: DiscoveredDevice): boolean {
    return this.known().some(known => known.mgmtIp === device.ip ||
      Boolean(device.mac && known.macAddress?.toUpperCase() === device.mac.toUpperCase()));
  }

  startScan(scan: DiscoveryScan): void {
    this.scanSetup.set(false); this.lastScan.set(scan); void this.run();
  }

  async run(): Promise<void> {
    if (this.scanning()) return;
    const scan = this.lastScan();
    if (!scan) { this.scanSetup.set(true); return; }
    this.scanning.set(true); this.searched.set(true); this.error.set('');
    this.selected.set(null); this.results.set([]);
    try {
      await this.loadInventory();
      this.results.set(await firstValueFrom(this.api.discover(scan.identifier, scan.subnet)));
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.scanning.set(false); }
  }

  selectDevice(device: DiscoveredDevice): void {
    if (this.inventoryLoading() || this.inventoryError()) return;
    this.selected.set(device); this.error.set('');
  }

  onEnrolled(device: Device): void {
    this.known.update(devices => [device, ...devices]);
    this.selected.set(null);
    this.notifications.success(`${device.hostname} added to known devices.`);
  }

  private message(error: any): string {
    const message = error?.error?.message || error?.message || 'Request failed';
    return Array.isArray(message) ? message.join(', ') : message;
  }
}
