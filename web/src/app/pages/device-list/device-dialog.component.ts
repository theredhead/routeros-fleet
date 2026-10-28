import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { NotificationsService } from '../../core/notifications.service';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormEngine, UIForm } from '@theredhead/lucid-forms';
import { UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { AppFormsService } from '../../forms/app-forms.service';
import { Customer, Device } from '../../models';

@Component({
  selector: 'app-device-dialog',
  imports: [DisclosableComponent, RouterLink, UIForm, UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter],
  templateUrl: './device-dialog.component.html',
})
export class DeviceDialogComponent implements OnInit {
  private readonly notifications = inject(NotificationsService);
  readonly testingLogin = signal(false);
  private readonly api = inject(ApiService);
  private readonly forms = inject(AppFormsService);
  readonly device = input.required<Device>();
  readonly customers = input<Customer[]>([]);
  readonly saved = output<Device>();
  readonly dismissed = output<void>();
  readonly saving = signal(false);
  readonly error = signal('');
  form!: FormEngine;

  ngOnInit(): void {
    const device = this.device();
    const customers = this.customers();
    const options = [{value: '', label: 'Unassigned'}, ...customers.map(customer => ({value: customer.id, label: customer.name}))];
    if (device.customerId && !customers.some(customer => customer.id === device.customerId)) options.push({value: device.customerId, label: device.customer?.name || 'Current customer'});
    this.form = this.forms.engine('device', {
      hostname: {defaultValue: device.hostname}, mgmtIp: {defaultValue: device.mgmtIp},
      customerId: {defaultValue: device.customerId || '', options},
      model: {defaultValue: device.model || ''}, macAddress: {defaultValue: device.macAddress || ''},
    });
  }
  async testLogin(): Promise<void> {
    if (this.testingLogin()) return;
    this.testingLogin.set(true);
    try {
      const result = await firstValueFrom(this.api.testStoredDeviceLogin(this.device().id));
      this.notifications.success(`Stored login verified · RouterOS ${result.routerosVersion}`);
    } catch (error) { this.notifications.error('Stored login failed.', this.forms.message(error)); }
    finally { this.testingLogin.set(false); }
  }
  cancel(): void { if (!this.saving()) this.dismissed.emit(); }

  async save(): Promise<void> {
    if (this.saving() || !this.form.valid()) return;
    const values = this.form.values();
    this.saving.set(true); this.error.set('');
    try {
      const saved = await firstValueFrom(this.api.updateDevice(this.device().id, {
        hostname: String(values['hostname'] || '').trim(), mgmtIp: String(values['mgmtIp'] || '').trim(),
        customerId: String(values['customerId'] || '') || null,
        model: String(values['model'] || '').trim(), macAddress: String(values['macAddress'] || '').trim() || null,
      }));
      this.saved.emit(saved);
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Request failed.';
      this.error.set(Array.isArray(message) ? message.join(', ') : message);
    } finally { this.saving.set(false); }
  }
}
