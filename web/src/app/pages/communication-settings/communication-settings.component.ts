import { CommonDialogService } from '@theredhead/lucid-blocks';
import { CommunicationSettings } from '../../core/communication.models';
import { Component, computed, inject, signal } from '@angular/core';
import { UISurface } from '@theredhead/lucid-foundation';
import { UIButton } from '@theredhead/lucid-kit';
import { CommunicationSettingsService } from '../../core/communication-settings.service';
import { CommunicationDraft } from '../../core/communication-draft';
import { CommunicationMethodsComponent } from '../../shared/communication-methods/communication-methods.component';
import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { NotificationsService } from '../../core/notifications.service';
import { LiveUpdatesService } from '../../core/live-updates.service';
@Component({
  selector: 'app-communication-settings',
  imports: [UISurface, UIButton, CommunicationMethodsComponent, DisclosableComponent, HelpPopoverComponent],
  templateUrl: './communication-settings.component.html',
  styleUrl: './communication-settings.component.scss',
})
export class CommunicationSettingsComponent {
  private readonly dialogs = inject(CommonDialogService);
  private readonly service = inject(CommunicationSettingsService);
  private readonly notifications = inject(NotificationsService);
  readonly draft = signal<CommunicationDraft | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  private revision = 0;
  private readonly saved = signal('');
  readonly dirty = computed(() => Boolean(this.draft() && JSON.stringify(this.draft()!.methods()) !== this.saved()));
  constructor() {
    inject(LiveUpdatesService).watch(['diagnostics'], () => this.refresh(), () => this.busy());
    void this.load();
  }
  private open(settings: CommunicationSettings): void {
    this.revision = settings.revision; this.saved.set(JSON.stringify(settings.methods)); this.draft.set(this.service.draft(settings.methods)); this.notice.set('');
  }
  private async refresh(): Promise<void> {
    try {
      const settings = await this.service.load();
      if (settings.revision === this.revision) return;
      if (this.dirty()) this.notice.set('Communication settings changed elsewhere. Your draft is preserved; saving still checks the original revision.');
      else this.open(settings);
    } catch { this.error.set('Could not refresh communication settings. Your draft is preserved. Retry when the API is available.'); }
  }
  async canLeave(): Promise<boolean> {
    if (this.busy()) return false;
    return !this.dirty() || await this.dialogs.confirm({title: 'Discard communication changes?', message: 'Your unsaved communication settings will be lost.', confirmLabel: 'Discard changes'});
  }
  async reload(): Promise<void> { if (await this.canLeave()) await this.load(); }
  async load(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { this.open(await this.service.load()); }
    catch { this.error.set('Could not load communication settings. Check API availability and retry.'); }
    finally { this.busy.set(false); }
  }
  cancel(): void { if (!this.busy() && this.draft()) {this.draft.set(this.service.draft(JSON.parse(this.saved()))); this.notice.set('');} }
  async save(): Promise<void> {
    const draft = this.draft(); if (!draft?.valid() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {const settings = await this.service.save({methods: draft.methods(), revision: this.revision}); this.revision = settings.revision; this.saved.set(JSON.stringify(settings.methods)); this.notice.set(''); this.notifications.success('Communication settings saved.');}
    catch (error: unknown) {this.error.set((error as {error?: {message?: string}})?.error?.message || 'Could not save communication settings.');}
    finally {this.busy.set(false);}
  }
}
