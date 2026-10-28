import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { AppFormsService } from '../../forms/app-forms.service';
import { Component, OnChanges, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import type { ConfigurationConflict } from '@fleet/configuration';

@Component({
  selector: 'app-conflict-choice', imports: [UIForm, HelpPopoverComponent],
  templateUrl: './conflict-choice.component.html',
})
export class ConflictChoiceComponent implements OnChanges {
  private readonly forms = inject(AppFormsService);
  readonly conflict = input.required<ConfigurationConflict>();
  readonly chosen = output<string>();
  readonly engine = signal<FormEngine | null>(null);
  private signature = '';
  constructor() {
    effect(() => {
      const selected = this.engine()?.values()['source'];
      untracked(() => {
        if (typeof selected === 'string' && selected && selected !== this.conflict().selectedSourceId) this.chosen.emit(selected);
      });
    });
  }
  ngOnChanges(): void {
    const conflict = this.conflict();
    const signature = JSON.stringify([conflict.path, conflict.candidates]);
    if (this.signature === signature && this.engine()?.values()['source'] === (conflict.selectedSourceId || '')) return;
    this.signature = signature;
    this.engine.set(this.forms.engine('conflict', {source: {
      defaultValue: conflict.selectedSourceId || '',
      options: conflict.candidates.map(candidate => ({value: candidate.sourceId, label: `${candidate.sourceName}: ${JSON.stringify(candidate.value)}`})),
    }}));
  }
}
