import { ConfigurationIssuesComponent } from '../../shared/configuration-issues/configuration-issues.component';
import { ConfigurationIntegrityService } from '../../core/configuration-integrity.service';
import { OverviewFilterComponent } from '../../filters/overview-filter.component';
import { emptyFilter, filterRows } from '../../filters/overview-filter';
import type { FilterExpression } from '@theredhead/lucid-kit';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { RefreshButtonComponent } from '../../shared/refresh-button.component';
import { OverviewStateComponent } from '../../shared/overview-state.component';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArrayDatasource, UISurface } from '@theredhead/lucid-foundation';
import { UITableView, UITextColumn } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { ActionableIssue, ServerHealth } from '../../models';

@Component({
  selector: 'app-dashboard',
  host: {class: 'overview-page'},
  imports: [ConfigurationIssuesComponent, OverviewFilterComponent, RefreshButtonComponent, OverviewStateComponent, UISurface, UITableView, UITextColumn],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly filter = signal<FilterExpression>(emptyFilter());
  private readonly api = inject(ApiService);
  private readonly integrity = inject(ConfigurationIntegrityService);
  readonly health = signal<ServerHealth | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly configurationIssues = signal<ActionableIssue[]>([]);
  readonly datasource = computed(() => {
    const health = this.health();
    const rows = health ? [
      { label: 'API server', value: health.status === 'ok' ? 'Online' : 'Degraded' },
      { label: 'Database', value: health.database === 'connected' ? 'Connected' : 'Unavailable' },
      { label: 'Server uptime', value: `${Math.floor(health.uptime)} seconds` },
      { label: 'Last checked', value: new Date(health.checkedAt).toLocaleString() },
    ] : [];
    return new ArrayDatasource(filterRows(rows, 'dashboard', this.filter()));
  });
  constructor() {
    inject(LiveUpdatesService).watch(['diagnostics'], () => this.refresh(), () => this.loading());
    void this.refresh();
  }
  async refresh(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(''); this.health.set(null);
    try {
      await Promise.all([
        this.integrity.check().then(issues => this.configurationIssues.set(issues)),
        firstValueFrom(this.api.serverHealth()).then(health => this.health.set(health)).catch(error => {
          this.error.set(error?.error?.status === 'degraded' ? 'API server is online, but the database is unavailable.' : 'Cannot reach the API server.');
        }),
      ]);
    } finally { this.loading.set(false); }
  }
}
