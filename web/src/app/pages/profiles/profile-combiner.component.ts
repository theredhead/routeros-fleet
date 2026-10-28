import { AppFormsService } from '../../forms/app-forms.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UIForm } from '@theredhead/lucid-forms';
import { UIButton, UICheckbox, UITableView, UITextColumn } from '@theredhead/lucid-kit';
import { ArrayDatasource } from '@theredhead/lucid-foundation';
import { combineProfiles, CombineProfilesRequest, ConflictStrategy, DeviceConfiguration, FleetProfile, settingLabel } from '@fleet/configuration';
import { ApiService } from '../../core/api.service';
import { ConflictChoiceComponent } from './conflict-choice.component';

@Component({
  selector: 'app-profile-combiner',
  imports: [HelpPopoverComponent, UIForm, UIButton, UICheckbox, UITableView, UITextColumn, ConflictChoiceComponent],
  templateUrl: './profile-combiner.component.html',
})
export class ProfileCombinerComponent implements OnChanges {
  private readonly api = inject(ApiService);
  readonly profiles = input<FleetProfile[]>([]);
  readonly temporaryProfiles = input<FleetProfile[]>([]);
  readonly busy = output<boolean>();
  readonly saved = output<FleetProfile>();
  readonly temporary = output<FleetProfile>();
  readonly selectedIds = signal<string[]>([]);
  readonly resolutions = signal<Record<string, string>>({});
  readonly saving = signal(false);
  readonly error = signal('');
  readonly allSources = computed(() => [...this.profiles(), ...this.temporaryProfiles()]);
  readonly orderedSources = computed(() => this.selectedIds().map(id => this.allSources().find(source => source.id === id)).filter((source): source is FleetProfile => Boolean(source)));
  readonly parameters = inject(AppFormsService).engine('combination');
  readonly strategy = computed(() => this.parameters.values()['strategy'] as ConflictStrategy);
  readonly combination = computed(() => this.orderedSources().length >= 2 ? combineProfiles(this.orderedSources(), this.strategy(), this.resolutions()) : null);
  readonly previewRows = computed(() => {
    const configuration = this.combination()?.configuration;
    const rows: {field: string; value: string}[] = [];
    const visit = (value: unknown, path: string) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value)) visit(child, `${path} › ${settingLabel(key)}`);
      } else rows.push({field: path, value: this.format(value)});
    };
    if (configuration) for (const group of Object.values(configuration)) visit(group.settings, group.sectionTitle);
    return rows;
  });
  readonly previewData = computed(() => new ArrayDatasource(this.previewRows()));
  ngOnChanges(): void {
    this.resolutions.set({});
    const available = new Set(this.allSources().map(source => source.id));
    this.selectedIds.update(ids => ids.filter(id => available.has(id)));
  }
  toggle(id: string, checked: boolean): void {
    if (this.saving()) return;
    if (checked && this.selectedIds().length >= 30) { this.error.set('Select at most 30 profiles in one combination.'); return; }
    this.selectedIds.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
    this.resolutions.set({}); this.error.set('');
  }
  move(index: number, direction: number): void {
    if (this.saving()) return;
    this.selectedIds.update(ids => { const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  choose(path: string, source: string): void { this.resolutions.update(choices => ({...choices, [path]: source})); }
  format(value: unknown): string { return typeof value === 'string' ? value : JSON.stringify(value); }
  winnerName(conflict: {selectedSourceId?: string; candidates: {sourceId: string; sourceName: string}[]}): string {
    return `${conflict.candidates.find(candidate => candidate.sourceId === conflict.selectedSourceId)?.sourceName} wins`;
  }
  keepTemporary(): void {
    const result = this.combination();
    if (!result?.configuration || !this.parameters.valid()) return;
    this.temporary.emit({id: `temp:${crypto.randomUUID()}`, name: String(this.parameters.values()['name']).trim(), description: String(this.parameters.values()['description'] || ''), configuration: structuredClone(result.configuration), composition: result.composition});
  }
  async save(): Promise<void> {
    if (this.saving() || !this.combination()?.configuration || !this.parameters.valid()) return;
    this.saving.set(true); this.busy.emit(true); this.error.set('');
    const request: CombineProfilesRequest = {
      sourceIds: this.selectedIds(), strategy: this.strategy(), resolutions: this.resolutions(),
      expectedRevisions: Object.fromEntries(this.orderedSources().filter(source => source.revision !== undefined).map(source => [source.id, source.revision!])),
      temporarySources: this.orderedSources().filter(source => source.id.startsWith('temp:')),
      saveAs: {name: String(this.parameters.values()['name']).trim(), description: String(this.parameters.values()['description'] || '')},
    };
    let savedProfile: FleetProfile | undefined;
    try {
      const result = await firstValueFrom(this.api.combineFleetProfiles(request));
      savedProfile = result.savedProfile;
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Could not save combination';
      this.error.set(Array.isArray(message) ? message.join(', ') : message);
    } finally { this.saving.set(false); this.busy.emit(false); }
    if (savedProfile) this.saved.emit(savedProfile);
  }
}
