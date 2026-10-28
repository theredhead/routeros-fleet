import { LiveUpdatesService } from '../core/live-updates.service';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { FormEngine, FormFieldDefinition, FormSchema } from '@theredhead/lucid-forms';
import { APP_FORMS } from './form-catalog';
import { schemaError } from '../../../../server/src/forms/form-schema-validation';

interface SavedForm { id: string; schema: FormSchema; revision: number; }

@Injectable({providedIn: 'root'})
export class AppFormsService {
  private readonly http = inject(HttpClient);
  private readonly saved = signal<Record<string, SavedForm>>({});
  readonly loadError = signal('');
  readonly definitions = APP_FORMS;

  constructor() { inject(LiveUpdatesService).watch(['forms'], () => this.load()); }

  revision(id: string): number { return this.saved()[id]?.revision || 0; }

  async load(): Promise<void> {
    try {
      const rows = await firstValueFrom(this.http.get<SavedForm[]>('/api/development/forms').pipe(timeout(5000)));
      const valid = rows.filter(row => !this.validate(row.id, row.schema));
      this.saved.set(Object.fromEntries(rows.map(row => [row.id, row])));
      this.loadError.set(valid.length === rows.length ? '' : 'Some saved forms are incompatible with this app version and were replaced with defaults.');
    } catch (error) {
      this.loadError.set(this.message(error));
    }
  }

  defaults(id: string): FormSchema {
    const definition = APP_FORMS.find(form => form.id === id);
    if (!definition) throw new Error(`Unknown app form: ${id}`);
    return structuredClone(definition.schema);
  }

  schema(id: string): FormSchema {
    const saved = this.saved()[id]?.schema;
    return structuredClone(saved && !this.validate(id, saved) ? saved : this.defaults(id));
  }
  customized(id: string): boolean { return Boolean(this.saved()[id]); }

  prepared(id: string, schema: FormSchema): FormSchema {
    const defaults = this.defaults(id).groups.flatMap(group => group.fields);
    return {...schema, groups: schema.groups.map(group => ({...group, fields: group.fields.map(field => {
      const base = defaults.find(candidate => candidate.id === field.id);
      let value = field.defaultValue;
      if (base?.component === 'checkbox' && typeof value === 'string' && ['true', 'false'].includes(value)) value = value === 'true';
      if (base?.config?.['type'] === 'number' && typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) value = Number(value);
      return {...field, defaultValue: value};
    })}))};
  }

  engine(id: string, runtime: Record<string, Partial<FormFieldDefinition>> = {}): FormEngine {
    const original = this.defaults(id).groups.flatMap(group => group.fields);
    const schema = this.prepared(id, this.schema(id));
    return new FormEngine({...schema, groups: schema.groups.map(group => ({...group, fields: group.fields.map(field => {
      const base = original.find(candidate => candidate.id === field.id);
      const binding = runtime[field.id];
      return {...field, ...binding,
        config: {...field.config, ...binding?.config},
        validation: [...new Map([...(field.validation || []), ...(base?.validation || []), ...(binding?.validation || [])].map(rule => [JSON.stringify(rule), rule])).values()],
      };
    })}))});
  }

  validate(id: string, schema: FormSchema): string | undefined {
    const structural = schemaError(schema, id);
    if (structural) return structural;
    const definition = APP_FORMS.find(form => form.id === id);
    if (!definition) return 'Unknown application form.';
    const baseline = definition.schema.groups.flatMap(group => group.fields);
    const fields = schema.groups.flatMap(group => group.fields);
    for (const field of baseline) {
      const candidate = fields.find(item => item.id === field.id);
      if (!candidate) return `Keep the application field “${field.id}”.`;
      if (field.component === 'checkbox' && candidate.defaultValue != null && ![true, false, 'true', 'false'].includes(candidate.defaultValue as any)) return `Use true or false for the default of “${field.id}”.`;
      if (candidate.component !== field.component) return `Keep the component type for “${field.id}”.`;
      if (field.options && id !== 'conflict' && JSON.stringify(candidate.options?.map(option => option.value).sort()) !== JSON.stringify(field.options.map(option => option.value).sort())) return `Keep the option values for “${field.id}”. Labels can be changed.`;
    }
    if (fields.some(field => !baseline.some(item => item.id === field.id) && !['flair:richtext', 'flair:image', 'flair:media'].includes(field.component))) return 'Additional data fields need application support. You can add display-only fields.';
    return undefined;
  }

  async save(id: string, schema: FormSchema, revision = this.revision(id)): Promise<void> {
    const error = this.validate(id, schema);
    if (error) throw new Error(error);
    const row = await firstValueFrom(this.http.put<SavedForm>(`/api/development/forms/${encodeURIComponent(id)}`, {schema: this.prepared(id, schema), revision}));
    this.saved.update(rows => ({...rows, [id]: row}));
  }

  async restore(id: string, revision = this.revision(id)): Promise<void> {
    const row = this.saved()[id];
    if (row || revision) await firstValueFrom(this.http.delete(`/api/development/forms/${encodeURIComponent(id)}/${revision}`));
    this.saved.update(rows => { const next = {...rows}; delete next[id]; return next; });
  }

  message(error: any): string {
    const message = error?.error?.message || error?.message || 'Request failed.';
    return Array.isArray(message) ? message.join(', ') : message;
  }
}
