import { NotificationsService } from '../../core/notifications.service';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { AppFormsService } from '../../forms/app-forms.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { UISurface } from '@theredhead/lucid-foundation';
import { UIButton, UIDropdownList, UIProgress } from '@theredhead/lucid-kit';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import { CONFIGURATION_SECTIONS, DeviceConfiguration, FleetProfile, emptyConfiguration, equalSetting, validateConfiguration } from '@fleet/configuration';
import { ApiService } from '../../core/api.service';
import { ConfigurationNodeComponent } from './configuration-node.component';
import { ProfileWorkspaceService } from './profile-workspace.service';

@Component({
  selector: 'app-profile-editor',
  imports: [HelpPopoverComponent, UISurface, UIButton, UIDropdownList, UIProgress, UIForm, ConfigurationNodeComponent],
  templateUrl: './profile-editor.component.html',
})
export class ProfileEditorComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly forms = inject(AppFormsService);
  private readonly api = inject(ApiService);
  private readonly dialogs = inject(CommonDialogService);
  private readonly router = inject(Router);
  private readonly workspace = inject(ProfileWorkspaceService);
  private generation = 0;
  readonly selected = signal<FleetProfile | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly configuration = signal<DeviceConfiguration>(emptyConfiguration());
  readonly metadata = signal<FormEngine>(this.metadataFor('', '', false));
  readonly sectionKey = signal('identity');
  readonly sectionOptions = CONFIGURATION_SECTIONS.map(section => ({value: section.key, label: section.sectionTitle}));
  readonly section = computed(() => CONFIGURATION_SECTIONS.find(section => section.key === this.sectionKey())!);
  readonly sectionSettings = computed(() => this.configuration()[this.section().key].settings);
  readonly issues = computed(() => validateConfiguration(this.configuration()));
  readonly dirty = computed(() => {
    const selected = this.selected(); const values = this.metadata().values();
    return Boolean(selected && (!equalSetting(selected.configuration, this.configuration()) || selected.name !== values['name'] || (selected.description || '') !== values['description']));
  });
  constructor() {
    inject(LiveUpdatesService).watch(['profiles'], () => this.refreshSelected(), () => this.loading() || this.saving());
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(params => void this.load(params.get('id')));
    inject(DestroyRef).onDestroy(() => this.generation++);
  }
  private async refreshSelected(): Promise<void> {
    const selected = this.selected();
    if (!selected || selected.id === 'new' || selected.id.startsWith('temp:')) return;
    try {
      const latest = await firstValueFrom(this.api.getFleetProfile(selected.id));
      if (this.selected()?.id !== selected.id || latest.revision === this.selected()?.revision) return;
      if (this.dirty()) this.notice.set('This profile changed elsewhere. Your unsaved changes are preserved.');
      else this.open(latest);
    } catch { this.notice.set('This profile may have changed or been deleted. Your edits are preserved.'); }
  }
  private metadataFor(name: string, description: string, builtin: boolean): FormEngine {
    return this.forms.engine('profile', {
      name: {defaultValue: name, config: {disabled: builtin}},
      description: {defaultValue: description},
    });
  }

  private open(profile: FleetProfile): void {
    this.selected.set(structuredClone(profile)); this.configuration.set(structuredClone(profile.configuration));
    this.metadata.set(this.metadataFor(profile.name, profile.description || '', Boolean(profile.builtinKey)));
    this.error.set('');
  }
  private async load(id: string | null): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(''); this.selected.set(null);
    try {
      const profile = !id ? {id: 'new', name: '', description: '', configuration: emptyConfiguration()}
        : id.startsWith('temp:') ? this.workspace.temporaryProfiles().find(profile => profile.id === id)
        : await firstValueFrom(this.api.getFleetProfile(id));
      if (generation !== this.generation) return;
      if (!profile) throw new Error('This temporary profile is no longer in memory.');
      this.open(profile);
    } catch (error) { if (generation === this.generation) this.error.set(this.message(error)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  async canLeave(): Promise<boolean> {
    if (this.saving()) return false;
    return !this.dirty() || await this.dialogs.confirm({title: 'Discard profile changes?', message: 'Your unsaved changes will be lost.', confirmLabel: 'Discard changes'});
  }
  back(): void { void this.router.navigateByUrl('/profiles'); }
  setSection(value: unknown): void {
    const key = this.section().key;
    this.configuration.update(configuration => ({...configuration, [key]: {...configuration[key], settings: value}}));
  }
  async discard(): Promise<void> { if (this.selected() && await this.canLeave()) this.open(this.selected()!); }
  async save(): Promise<void> {
    const selected = this.selected();
    if (!selected || this.saving() || !this.metadata().valid() || this.issues().length) return;
    this.saving.set(true); this.error.set('');
    let saved = false;
    const name = String(this.metadata().values()['name']).trim();
    const description = String(this.metadata().values()['description'] || '');
    try {
      const profile = selected.id === 'new' || selected.id.startsWith('temp:')
        ? await firstValueFrom(this.api.createFleetProfile(name, description, this.configuration()))
        : await firstValueFrom(this.api.updateFleetProfile({...selected, name, description, configuration: this.configuration()}));
      this.workspace.temporaryProfiles.update(profiles => profiles.filter(profile => profile.id !== selected.id));
      this.open(profile); this.notifications.success(`${profile.name} saved.`); saved = true;
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.saving.set(false); }
    if (saved) this.back();
  }
  updateTemporary(): void {
    const selected = this.selected();
    if (!selected?.id.startsWith('temp:') || !this.metadata().valid() || this.issues().length) return;
    const profile = {...selected, name: String(this.metadata().values()['name']).trim(), description: String(this.metadata().values()['description'] || ''), configuration: structuredClone(this.configuration()), composition: null};
    this.workspace.temporaryProfiles.update(profiles => profiles.map(existing => existing.id === profile.id ? profile : existing));
    this.open(profile); this.notifications.info('Temporary changes kept in memory.');
  }
  async remove(): Promise<void> {
    const profile = this.selected();
    if (!profile || profile.builtinKey || this.saving()) return;
    if (!await this.dialogs.confirm({title: `Delete ${profile.name}?`, message: 'This removes this profile. Source profiles remain unchanged.', variant: 'danger'})) return;
    this.saving.set(true); this.error.set(''); let removed = false;
    try {
      if (profile.id.startsWith('temp:')) this.workspace.temporaryProfiles.update(profiles => profiles.filter(existing => existing.id !== profile.id));
      else await firstValueFrom(this.api.deleteFleetProfile(profile));
      this.selected.set(null); this.notifications.success(`${profile.name} deleted.`); removed = true;
    } catch (error) { this.error.set(this.message(error)); }
    finally { this.saving.set(false); }
    if (removed) this.back();
  }
  private message(error: any): string { const message = error?.error?.message || error?.message || 'Request failed'; return Array.isArray(message) ? message.join(', ') : message; }
}
