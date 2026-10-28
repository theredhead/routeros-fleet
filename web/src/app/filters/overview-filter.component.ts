import { DisclosableComponent } from '../shared/disclosable/disclosable.component';
import { NotificationsService } from '../core/notifications.service';
import { Component, OnChanges, SimpleChanges, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import { UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter, UIDropdownList, UIFilter, UIIcon, UIIcons, UITooltip, FilterExpression } from '@theredhead/lucid-kit';
import { OVERVIEW_FIELDS, OverviewKey, filterError } from '@fleet/filters';
import { AppFormsService } from '../forms/app-forms.service';
import { LiveUpdatesService } from '../core/live-updates.service';
import { SavedFilter, SavedFiltersService } from './saved-filters.service';
import { emptyFilter } from './overview-filter';

@Component({
  selector: 'app-overview-filter',
  imports: [DisclosableComponent, UIButton, UIDropdownList, UIFilter, UIIcon, UITooltip, UIForm, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter],
  templateUrl: './overview-filter.component.html',
})
export class OverviewFilterComponent implements OnChanges {
  private readonly notifications = inject(NotificationsService);
  private readonly api = inject(SavedFiltersService);
  private readonly forms = inject(AppFormsService);
  private readonly dialogs = inject(CommonDialogService);
  private readonly builder = viewChild(UIFilter);
  readonly view = input.required<OverviewKey>();
  readonly data = input<readonly any[]>([]);
  readonly value = model<FilterExpression>(emptyFilter());
  readonly fields = computed(() => OVERVIEW_FIELDS[this.view()]);
  readonly saved = signal<SavedFilter[]>([]);
  readonly selectedId = signal('');
  readonly loaded = signal<SavedFilter | null>(null);
  readonly busy = signal(false);
  readonly naming = signal(false);
  readonly managing = signal(false);
  readonly bookmark = UIIcons.Lucide.Account.Bookmark;
  readonly clearIcon = UIIcons.Lucide.Math.X;
  readonly managerLabel = computed(() => this.error() ? 'Saved filters unavailable. Open for details.' : this.loaded() ? `Saved filters: ${this.loaded()!.name}` : 'Saved filters');
  readonly error = signal('');
  readonly options = computed(() => [{value: '', label: 'Saved filters'}, ...this.saved().map(filter => ({value: filter.id, label: filter.name}))]);
  readonly trash = UIIcons.Lucide.Files.Trash2;
  nameForm: FormEngine | null = null;
  replacing(): boolean { return Boolean(this.loaded() && String(this.nameForm?.values()['name'] || '').trim() === this.loaded()!.name); }

  constructor() { inject(LiveUpdatesService).watch(['filters'], () => this.reload(), () => this.busy()); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['view']) { this.builder()?.simpleQuery.set(''); this.builder()?.mode.set('simple'); this.selectedId.set(''); this.loaded.set(null); this.saved.set([]); this.error.set(''); void this.reload(); }
  }
  changed(expression: FilterExpression): void {
    if (JSON.stringify(expression) !== JSON.stringify(this.value())) this.value.set(structuredClone(expression));
  }
  private apply(expression: FilterExpression): void {
    const simple = expression.rules.length === 0 || (expression.junction === 'and' && expression.rules.length === 1 && expression.rules[0].field === '__any__' && expression.rules[0].operator === 'contains');
    this.builder()?.mode.set(simple ? 'simple' : 'advanced');
    if (simple) this.builder()?.simpleQuery.set(expression.rules[0]?.value || '');
    this.value.set(structuredClone(expression));
    this.builder()?.value.set(structuredClone(expression));
  }
  clear(): void { this.apply(emptyFilter()); this.selectedId.set(''); this.loaded.set(null); }
  async reload(): Promise<void> {
    const view = this.view();
    try {
      const filters = await this.api.list(view);
      if (this.view() !== view) return;
      this.saved.set(filters); this.error.set('');
      if (this.selectedId() && !filters.some(filter => filter.id === this.selectedId())) this.selectedId.set('');
      if (this.loaded() && !filters.some(filter => filter.id === this.loaded()!.id)) { this.loaded.set(null); this.notifications.info('Saved filter deleted. The current table filter is preserved.'); }
    } catch (error) { if (this.view() === view) this.error.set(this.api.message(error)); }
  }
  async load(): Promise<void> {
    if (this.busy() || !this.selectedId()) return;
    this.busy.set(true); this.error.set('');
    try {
      const filter = await this.api.get(this.selectedId());
      const error = filterError(this.view(), filter.expression);
      if (filter.view !== this.view() || error) throw new Error(error || 'This filter belongs to another overview.');
      this.loaded.set(filter); this.apply(filter.expression); this.notifications.info(`Loaded ${filter.name}.`); this.managing.set(false);
    } catch (error) { this.error.set(this.api.message(error)); }
    finally { this.busy.set(false); }
  }
  openManager(): void { this.managing.set(true); void this.reload(); }
  closeManager(): void { if (!this.busy()) this.managing.set(false); }
  beginSave(): void {
    this.managing.set(false);
    this.error.set('');
    this.nameForm = this.forms.engine('saved-filter', {name: {defaultValue: this.loaded()?.name || ''}});
    this.naming.set(true);
  }
  cancelSave(): void { if (!this.busy()) { this.naming.set(false); this.managing.set(true); } }
  async save(): Promise<void> {
    if (this.busy() || !this.nameForm?.valid()) return;
    const name = String(this.nameForm.values()['name'] || '').trim();
    if (!name) return;
    const validation = filterError(this.view(), this.value());
    if (validation) { this.error.set(validation); return; }
    this.busy.set(true); this.error.set('');
    try {
      const saved = await this.api.save(this.view(), name, this.value(), this.replacing() ? this.loaded()! : undefined);
      this.loaded.set(saved); this.selectedId.set(saved.id); this.naming.set(false);
      this.notifications.success(`Saved ${saved.name}.`); await this.reload();
    } catch (error) { this.error.set(this.api.message(error)); }
    finally { this.busy.set(false); }
  }
  async remove(): Promise<void> {
    if (this.busy()) return;
    const filter = this.saved().find(filter => filter.id === this.selectedId());
    if (!filter) return;
    this.busy.set(true); this.error.set('');
    try {
      if (!await this.dialogs.confirm({title: `Delete filter ${filter.name}?`, message: 'This deletes the saved filter. The current table filter and records stay unchanged.', confirmLabel: 'Delete filter', variant: 'danger'})) return;
      await this.api.remove(filter); this.selectedId.set('');
      if (this.loaded()?.id === filter.id) this.loaded.set(null);
      this.notifications.success('Saved filter deleted.'); await this.reload();
    } catch (error) { this.error.set(this.api.message(error)); }
    finally { this.busy.set(false); }
  }
}
