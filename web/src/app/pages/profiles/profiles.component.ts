import { NotificationsService } from '../../core/notifications.service';
import { OverviewFilterComponent } from '../../filters/overview-filter.component';
import { emptyFilter } from '../../filters/overview-filter';
import type { FilterExpression } from '@theredhead/lucid-kit';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { ObjectActionsComponent } from '../../shared/object-actions.component';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { OverviewStateComponent } from '../../shared/overview-state.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UITableView, UITextColumn, UITemplateColumn } from '@theredhead/lucid-kit';
import type { ProfileFilter, ProfileSummary } from '@fleet/configuration';
import { ApiService } from '../../core/api.service';
import { ProfileFetchDatasource } from './profile-fetch.datasource';

@Component({
  selector: 'app-profiles',
  host: {class: 'overview-page'},
  imports: [OverviewFilterComponent, ObjectActionsComponent, OverviewStateComponent, RouterLink, UISurface, UIButton, UITableView, UITextColumn, UITemplateColumn],
  templateUrl: './profiles.component.html',
})
export class ProfilesComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly dialogs = inject(CommonDialogService);
  private readonly router = inject(Router);
  readonly removing = signal<string | null>(null);
  private readonly api = inject(ApiService);
  private readonly changes = new Subject<void>();
  private controller?: AbortController;
  private generation = 0;
  readonly filter = signal<ProfileFilter>(emptyFilter() as ProfileFilter);
  readonly datasource = signal<ProfileFetchDatasource | null>(null);
  readonly loading = signal(false);
  readonly duplicating = signal(false);
  readonly total = signal(0);
  readonly error = signal('');
  constructor() {
    inject(LiveUpdatesService).watch(['profiles'], () => this.load(), () => this.loading() || this.duplicating() || !!this.removing());
    this.changes.pipe(debounceTime(200), takeUntilDestroyed()).subscribe(() => void this.load());
    inject(DestroyRef).onDestroy(() => { this.generation++; this.controller?.abort(); this.changes.complete(); });
    void this.load();
  }
  filterChanged(expression: FilterExpression): void {
    if (JSON.stringify(expression) === JSON.stringify(this.filter())) return;
    this.filter.set(structuredClone(expression) as ProfileFilter);
    this.changes.next();
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.controller?.abort(); this.controller = new AbortController();
    this.loading.set(true); this.error.set(''); this.datasource.set(null);
    const source = new ProfileFetchDatasource(this.filter(), this.controller.signal, message => {
      if (generation === this.generation) this.error.set(message);
    });
    try {
      const total = await source.getNumberOfItems();
      if (generation !== this.generation) return;
      this.total.set(total); this.datasource.set(source);
    } catch (error: any) {
      if (generation === this.generation && error?.name !== 'AbortError' && !this.error()) this.error.set(error?.message || 'Could not fetch profiles.');
    } finally { if (generation === this.generation) this.loading.set(false); }
  }
  edit(profile: ProfileSummary): void { void this.router.navigate(['/profiles', profile.id, 'edit']); }

  async remove(profile: ProfileSummary): Promise<void> {
    if (profile.builtinKey || this.removing() || this.duplicating()) return;
    this.removing.set(profile.id);
    try {
      if (!await this.dialogs.confirm({title: `Delete ${profile.name}?`, message: 'This permanently removes the profile. Other profiles and physical routers are unchanged.', confirmLabel: 'Delete profile', variant: 'danger'})) return;
      await firstValueFrom(this.api.deleteFleetProfile(profile));
      this.notifications.success(`${profile.name} deleted.`);
      await this.load();
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Could not delete profile.';
      this.notifications.error('Couldn’t complete the profile action.', message);
    } finally { this.removing.set(null); }
  }

  async duplicate(profile: ProfileSummary): Promise<void> {
    if (this.duplicating()) return;
    this.duplicating.set(true); this.error.set('');
    try {
      const copy = await firstValueFrom(this.api.duplicateFleetProfile(profile));
      this.notifications.success(`Created ${copy.name}.`);
      await this.load();
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Could not duplicate profile.';
      this.notifications.error('Couldn’t complete the profile action.', message);
    } finally { this.duplicating.set(false); }
  }
}
