import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { NotificationsService } from '../../core/notifications.service';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonDialogService } from '@theredhead/lucid-blocks';
import { FormDesignerEngine, FormEngine, UIDesignerCanvas, UIFieldPalette, UIPropertyInspector, UIForm } from '@theredhead/lucid-forms';
import { UIButton, UIDropdownList, UIJsonView } from '@theredhead/lucid-kit';
import { AppFormsService } from '../../forms/app-forms.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';

@Component({
  selector: 'app-forms-designer',
  host: {class: 'overview-page'},
  imports: [DisclosableComponent, UIButton, UIDropdownList, UIJsonView, UIDesignerCanvas, UIFieldPalette, UIPropertyInspector, UIForm, HelpPopoverComponent],
  templateUrl: './forms-designer.component.html',
  styleUrl: './forms-designer.component.scss',
})
export class FormsDesignerComponent {
  private readonly notifications = inject(NotificationsService);
  readonly forms = inject(AppFormsService);
  private readonly dialogs = inject(CommonDialogService);
  readonly designer = new FormDesignerEngine();
  readonly selectedId = signal('customer');
  readonly activeId = signal('customer');
  readonly options = this.forms.definitions.map(form => ({value: form.id, label: form.label}));
  readonly activeLabel = computed(() => this.options.find(option => option.value === this.activeId())!.label);
  readonly mode = signal('design');
  readonly targetGroup = signal('');
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly error = signal('');
  private revision = 0;
  private readonly baseline = signal('');
  readonly dirty = computed(() => JSON.stringify(this.designer.schema()) !== this.baseline());
  readonly validation = computed(() => this.forms.validate(this.activeId(), this.designer.schema()));
  readonly preview = computed(() => {
    try { return this.validation() ? null : new FormEngine(this.forms.prepared(this.activeId(), this.designer.schema())); }
    catch { return null; }
  });

  constructor() {
    this.open('customer');
    inject(LiveUpdatesService).watch(['forms'], async () => {
      await this.forms.load();
      if (this.dirty()) this.notice.set('Saved forms changed. Your unsaved design is preserved; Load retrieves the latest version.');
      else if (!this.forms.loadError()) this.open(this.activeId());
    }, () => this.busy());
  }

  private open(id: string): void {
    this.revision = this.forms.revision(id);
    this.activeId.set(id); this.selectedId.set(id);
    this.designer.loadSchema(this.forms.schema(id));
    this.baseline.set(JSON.stringify(this.designer.schema()));
    this.targetGroup.set('');
  }

  async canLeave(): Promise<boolean> {
    if (this.busy()) return false;
    return !this.dirty() || await this.dialogs.confirm({title: 'Discard form changes?', message: 'Your unsaved design changes will be lost.', confirmLabel: 'Discard changes'});
  }

  async load(): Promise<void> {
    if (!await this.canLeave()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      await this.forms.load();
      if (this.forms.loadError()) return;
      this.open(this.selectedId());
    } finally { this.busy.set(false); }
  }

  async save(): Promise<void> {
    if (this.busy() || this.validation()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      await this.forms.save(this.activeId(), this.designer.schema(), this.revision);
      this.revision = this.forms.revision(this.activeId());
      this.baseline.set(JSON.stringify(this.designer.schema()));
      this.notifications.success('Form saved.');
    } catch (error) { this.error.set(this.forms.message(error)); }
    finally { this.busy.set(false); }
  }

  async restore(): Promise<void> {
    if (this.busy()) return;
    if (!await this.dialogs.confirm({title: 'Restore default form?', message: `Restore ${this.activeLabel()} to its built-in design?`, confirmLabel: 'Restore default'})) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      await this.forms.restore(this.activeId(), this.revision); this.open(this.activeId());
      this.notifications.success('Default form restored.');
    } catch (error) { this.error.set(this.forms.message(error)); }
    finally { this.busy.set(false); }
  }

  addField(component: string): void {
    const group = this.designer.groups().find(group => group.uid === this.targetGroup()) || this.designer.groups()[0];
    const id = group?.uid || this.designer.addGroup();
    this.designer.addField(id, component);
  }
}
