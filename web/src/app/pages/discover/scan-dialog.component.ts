import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import { UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter } from '@theredhead/lucid-kit';
import { AppFormsService } from '../../forms/app-forms.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';

export interface DiscoveryScan { identifier: string; subnet?: string; }

@Component({
  selector: 'app-scan-dialog',
  imports: [UIForm, UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter, HelpPopoverComponent],
  templateUrl: './scan-dialog.component.html',
})
export class ScanDialogComponent implements OnInit {
  private readonly forms = inject(AppFormsService);
  readonly previous = input<DiscoveryScan | null>(null);
  readonly dismissed = output<void>();
  readonly scan = output<DiscoveryScan>();
  form!: FormEngine;

  ngOnInit(): void {
    const previous = this.previous();
    this.form = this.forms.engine('discovery', previous ? {
      query: {defaultValue: previous.identifier === 'auto' ? '' : previous.identifier},
      subnet: {defaultValue: previous.subnet || ''},
    } : {});
  }
  submit(): void {
    if (!this.form.valid()) return;
    const values = this.form.values();
    this.scan.emit({identifier: String(values['query'] || '').trim() || 'auto', subnet: String(values['subnet'] || '').trim() || undefined});
  }
}
