import { settingField } from '../../forms/form-catalog';
import { AppFormsService } from '../../forms/app-forms.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, OnChanges, effect, inject, input, output, signal, untracked } from '@angular/core';
import { UIButton } from '@theredhead/lucid-kit';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import { SettingDefinition, ObjectDefinition, UnionDefinition, defaultSetting, equalSetting, isRecord, settingLabel } from '@fleet/configuration';

/** Recursive typed editor. All editable scalar controls are rendered by Lucid Forms. */
@Component({
  selector: 'app-configuration-node',
  imports: [HelpPopoverComponent, UIButton, UIForm],
  templateUrl: './configuration-node.component.html',
})
export class ConfigurationNodeComponent implements OnChanges {
  readonly definition = input.required<SettingDefinition>();
  readonly schemaKey = input.required<string>();
  private readonly forms = inject(AppFormsService);
  readonly title = input.required<string>();
  readonly value = input<unknown>(undefined);
  readonly required = input(false);
  readonly valueChange = output<unknown>();
  readonly engine = signal<FormEngine | null>(null);
  private lastDefinition?: SettingDefinition;
  private lastTitle = '';

  constructor() {
    effect(() => {
      const form = this.engine();
      if (!form) return;
      const raw = form.values()['value'];
      untracked(() => {
        if (this.value() === undefined) return;
        const definition = this.definition();
        if (definition.kind === 'union') {
          const current = isRecord(this.value()) ? this.value() as Record<string, unknown> : {};
          if (typeof raw === 'string' && raw !== current[definition.discriminator] && Object.hasOwn(definition.variants, raw)) {
            this.valueChange.emit({ [definition.discriminator]: raw, ...defaultSetting(definition.variants[raw]) as object });
          }
        } else {
          const normalized = this.normalize(raw);
          if (!equalSetting(normalized, this.value())) this.valueChange.emit(normalized);
        }
      });
    });
  }

  ngOnChanges(): void {
    const definition = this.definition();
    if (definition.kind === 'object' || definition.kind === 'array' || this.value() === undefined) { this.engine.set(null); return; }
    const desired = definition.kind === 'union' ? this.property(definition.discriminator) : this.value();
    const current = this.engine();
    if (current && this.lastDefinition === definition && this.lastTitle === this.title() && equalSetting(this.normalize(current.values()['value']), desired)) return;
    const field = settingField(definition, this.title(), this.required(), desired);
    this.lastDefinition = definition; this.lastTitle = this.title();
    this.engine.set(this.forms.engine(this.schemaKey(), {value: {defaultValue: desired, validation: field.validation}}));
  }
  private normalize(raw: unknown): unknown {
    return this.definition().kind === 'number' && typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  }
  childSchemaKey(key: string): string {
    const definition = this.definition();
    const variant = definition.kind === 'union' ? `.${this.property(definition.discriminator)}` : '';
    return `${this.schemaKey()}${variant}.${key}`;
  }
  helpText(): string | undefined {
    const definition = this.definition();
    return 'description' in definition ? definition.description : undefined;
  }
  configure(): void {
    const definition = this.definition();
    let value = defaultSetting(definition);
    if (definition.kind !== 'object' && definition.kind !== 'array') {
      const field = this.forms.schema(this.schemaKey()).groups.flatMap(group => group.fields).find(field => field.id === 'value');
      if (field?.defaultValue !== undefined && field.defaultValue !== null) {
        const configured = this.forms.engine(this.schemaKey()).values()['value'];
        if (definition.kind === 'union') {
          if (typeof configured === 'string' && Object.hasOwn(definition.variants, configured)) {
            value = {[definition.discriminator]: configured, ...defaultSetting(definition.variants[configured]) as object};
          }
        } else value = configured;
      }
    }
    this.valueChange.emit(value);
  }
  property(key: string): unknown { return isRecord(this.value()) ? (this.value() as Record<string, unknown>)[key] : undefined; }
  setProperty(key: string, value: unknown): void {
    const current = isRecord(this.value()) ? {...this.value() as object} as Record<string, unknown> : {};
    if (value === undefined) delete current[key]; else current[key] = value;
    this.valueChange.emit(current);
  }
  objectFields() {
    const definition = this.definition();
    const objectDefinition = definition.kind === 'object' ? definition : definition.kind === 'union' ? definition.variants[String(this.property(definition.discriminator))] : undefined;
    return objectDefinition ? Object.entries(objectDefinition.fields).map(([key, child]) => ({key, definition: child, title: child.label || settingLabel(key), required: objectDefinition.required?.includes(key) || false})) : [];
  }
  items(): unknown[] { return Array.isArray(this.value()) ? this.value() as unknown[] : []; }
  itemDefinition(): SettingDefinition { const definition = this.definition(); if (definition.kind !== 'array') throw new Error('Expected array'); return definition.item; }
  addItem(): void { this.valueChange.emit([...this.items(), defaultSetting(this.itemDefinition())]); }
  removeItem(index: number): void { this.valueChange.emit(this.items().filter((_, itemIndex) => itemIndex !== index)); }
  setItem(index: number, value: unknown): void { this.valueChange.emit(this.items().map((item, itemIndex) => itemIndex === index ? value : item)); }
}
