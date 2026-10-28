import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { NotificationsService } from '../../core/notifications.service';
import type { OverviewKey } from '@fleet/filters';
import { OverviewFilterComponent } from '../../filters/overview-filter.component';
import { emptyFilter, filterRows } from '../../filters/overview-filter';
import type { FilterExpression } from '@theredhead/lucid-kit';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { RefreshButtonComponent } from '../../shared/refresh-button.component';
import { UIForm } from '@theredhead/lucid-forms';
import { AppFormsService } from '../../forms/app-forms.service';
import { RouterLink } from '@angular/router';
import { OverviewStateComponent } from '../../shared/overview-state.component';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArrayDatasource, UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UIDropdownList, UITableView, UITextColumn } from '@theredhead/lucid-kit';
import { ProfileWorkspaceService } from '../profiles/profile-workspace.service';
import { ApiService } from '../../core/api.service';
import { DevelopmentDiagnostics } from '../../models';

@Component({
  selector: 'app-development',
  host: {class: 'overview-page'},
  imports: [DisclosableComponent, OverviewFilterComponent, RefreshButtonComponent, UIForm, RouterLink, OverviewStateComponent, HelpPopoverComponent, UISurface, UIButton, UIDropdownList, UITableView, UITextColumn],
  templateUrl: './development.component.html',
})
export class DevelopmentComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly api = inject(ApiService);
  private readonly profileWorkspace = inject(ProfileWorkspaceService);
  readonly filter = signal<FilterExpression>(emptyFilter());
  readonly filterView = computed(() => `diagnostics-${this.view()}` as OverviewKey);
  readonly view = signal('server');
  readonly viewOptions = [{value: 'server', label: 'Server'}, {value: 'inventory', label: 'Database records'}, {value: 'interfaces', label: 'Network interfaces'}];
  readonly diagnostics = signal<DevelopmentDiagnostics | null>(null);
  readonly loading = signal(false);
  readonly resetting = signal(false);
  readonly confirming = signal(false);
  readonly resetForm = inject(AppFormsService).engine('reset', {confirmation: {defaultValue: ''}});
  readonly confirmation = computed(() => String(this.resetForm.values()['confirmation'] || ''));
  readonly error = signal('');
  readonly inventoryData = computed(() => new ArrayDatasource(filterRows(this.diagnostics()?.inventory || [], 'diagnostics-inventory', this.filter())));
  readonly interfaceData = computed(() => new ArrayDatasource(filterRows(this.diagnostics()?.interfaces || [], 'diagnostics-interfaces', this.filter())));
  readonly serverData = computed(() => {
    const info = this.diagnostics();
    const rows = info ? [
      ['Environment', info.environment], ['Node.js', info.runtime.node], ['Platform', info.runtime.platform],
      ['Uptime', `${info.runtime.uptimeSeconds} seconds`],
      ['Database', `${info.database.host}:${info.database.port}/${info.database.name}`],
      ['Schema', info.database.schema], ['Schema synchronization', info.database.synchronize ? 'Enabled' : 'Disabled'],
      ['Credential encryption key', info.credentialsConfigured ? 'Configured' : 'Not configured'],
      ['Active jobs', String(info.activeJobs)], ['Last checked', new Date(info.checkedAt).toLocaleString()],
    ] : [];
    return new ArrayDatasource(filterRows(rows.map(([label, value]) => ({ label, value })), 'diagnostics-server', this.filter()));
  });
  constructor() {
    inject(LiveUpdatesService).watch(['diagnostics'], () => this.refresh(), () => this.loading() || this.resetting());
    void this.refresh();
  }
  async refresh(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try { this.diagnostics.set(await firstValueFrom(this.api.developmentDiagnostics())); }
    catch (error) { this.error.set(this.message(error)); }
    finally { this.loading.set(false); }
  }
  setView(view: string): void { this.view.set(view); this.filter.set(emptyFilter()); }
  beginReset(): void { this.resetForm.setValue('confirmation', ''); this.confirming.set(true); }
  cancelReset(): void { this.resetForm.setValue('confirmation', ''); this.confirming.set(false); }
  async reset(): Promise<void> {
    if (this.resetting() || this.confirmation() !== 'RESET DATABASE' || !this.diagnostics()?.resetEnabled) return;
    this.resetting.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(this.api.resetDatabase(this.confirmation()));
      this.cancelReset();
      this.profileWorkspace.temporaryProfiles.set([]);
      const total = result.removed.reduce((sum, item) => sum + item.count, 0);
      this.notifications.success(`Database reset complete. Removed ${total} records.`);
      await this.refresh();
    } catch (error) { this.notifications.error('Couldn’t reset the database.', error); }
    finally { this.resetting.set(false); }
  }
  private message(error: any): string {
    const message = error?.error?.message || error?.message || 'Request failed';
    return Array.isArray(message) ? message.join(', ') : message;
  }
}
