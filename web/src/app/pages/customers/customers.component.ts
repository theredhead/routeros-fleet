import { NotificationsService } from '../../core/notifications.service';
import { OverviewFilterComponent } from '../../filters/overview-filter.component';
import { emptyFilter, filterRows } from '../../filters/overview-filter';
import type { FilterExpression } from '@theredhead/lucid-kit';
import { ObjectActionsComponent } from '../../shared/object-actions.component';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { OverviewStateComponent } from '../../shared/overview-state.component';
import { CustomerDialogComponent } from './customer-dialog.component';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArrayDatasource, UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UITableView, UITextColumn, UITemplateColumn } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { Customer } from '../../models';

@Component({
  selector: 'app-customers',
  host: {class: 'overview-page'},
  imports: [OverviewFilterComponent, ObjectActionsComponent, HelpPopoverComponent, OverviewStateComponent, CustomerDialogComponent, UISurface, UIButton, UITableView, UITextColumn, UITemplateColumn],
  templateUrl: './customers.component.html',
})
export class CustomersComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly dialogs = inject(CommonDialogService);
  readonly editing = signal<Customer | null>(null);
  readonly removing = signal<string | null>(null);
  readonly filter = signal<FilterExpression>(emptyFilter());
  private readonly api = inject(ApiService);
  readonly customers = signal<Customer[]>([]);
  readonly visible = computed(() => filterRows(this.customers(), 'customers', this.filter()));
  readonly datasource = computed(() => new ArrayDatasource(this.visible()));
  readonly adding = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  constructor() {
    inject(LiveUpdatesService).watch(['customers'], () => this.load(), () => this.loading());
    void this.load();
  }

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try { this.customers.set(await firstValueFrom(this.api.listCustomers())); }
    catch (error: any) {
      const message = error?.error?.message || error?.message || 'Request failed.';
      this.error.set(Array.isArray(message) ? message.join(', ') : message);
    } finally { this.loading.set(false); }
  }

  async remove(customer: Customer): Promise<void> {
    if (this.removing()) return;
    this.removing.set(customer.id);
    try {
      if (!await this.dialogs.confirm({
        title: `Delete ${customer.name}?`,
        message: 'This permanently deletes the customer. Their devices stay enrolled and become unassigned.',
        confirmLabel: 'Delete customer', variant: 'danger',
      })) return;
      await firstValueFrom(this.api.deleteCustomer(customer.id));
      this.notifications.success(`${customer.name} deleted.`);
      await this.load();
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Request failed.';
      this.notifications.error('Couldn’t delete this customer.', message);
    } finally { this.removing.set(null); }
  }

  onSaved(customer: Customer): void {
    const edited = Boolean(this.editing());
    this.adding.set(false); this.editing.set(null);
    this.notifications.success(`${customer.name} ${edited ? 'saved' : 'added'}.`);
    void this.load();
  }
}
