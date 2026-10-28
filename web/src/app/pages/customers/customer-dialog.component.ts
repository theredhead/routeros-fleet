import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { AppFormsService } from '../../forms/app-forms.service';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import { UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { Customer } from '../../models';

@Component({
  selector: 'app-customer-dialog',
  imports: [DisclosableComponent, UIForm, UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter],
  templateUrl: './customer-dialog.component.html',
})
export class CustomerDialogComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly forms = inject(AppFormsService);
  readonly customer = input<Customer | null>(null);
  form!: FormEngine;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly dismissed = output<void>();
  readonly saved = output<Customer>();

  ngOnInit(): void {
    const customer = this.customer();
    this.form = this.forms.engine('customer', customer ? {
      name: {defaultValue: customer.name},
      contactName: {defaultValue: customer.contactName || ''},
      contactEmail: {defaultValue: customer.contactEmail || ''},
    } : {});
  }

  cancel(): void { if (!this.saving()) this.dismissed.emit(); }

  async save(): Promise<void> {
    if (this.saving() || !this.form.valid()) return;
    const values = this.form.values();
    const name = String(values['name'] || '').trim();
    if (!name) return;
    this.saving.set(true); this.error.set('');
    try {
      const contactName = String(values['contactName'] || '').trim();
      const contactEmail = String(values['contactEmail'] || '').trim();
      const existing = this.customer();
      const customer = await firstValueFrom(existing
        ? this.api.updateCustomer(existing.id, {name, contactName: contactName || null, contactEmail: contactEmail || null})
        : this.api.createCustomer({name,
          ...(contactName ? {contactName} : {}), ...(contactEmail ? {contactEmail} : {}),
        }));
      this.saved.emit(customer);
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Request failed.';
      this.error.set(Array.isArray(message) ? message.join(', ') : message);
    } finally { this.saving.set(false); }
  }
}
