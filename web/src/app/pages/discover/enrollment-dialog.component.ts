import { EnrollmentCommunicationService } from './enrollment-communication.service';
import { CommunicationMethodsComponent } from '../../shared/communication-methods/communication-methods.component';
import { DisclosableComponent } from '../../shared/disclosable/disclosable.component';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, ViewEncapsulation, OnInit, computed, effect, untracked, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UICheckbox, UIInput, UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter } from '@theredhead/lucid-kit';
import { ApiService } from '../../core/api.service';
import { Device, DiscoveredDevice } from '../../models';

@Component({
  selector: 'app-enrollment-dialog',
  providers: [EnrollmentCommunicationService],
  imports: [CommunicationMethodsComponent, DisclosableComponent, UICheckbox, UIInput, HelpPopoverComponent, UIButton, UIDialog, UIDialogHeader, UIDialogBody, UIDialogFooter],
  templateUrl: './enrollment-dialog.component.html',
  styleUrl: './enrollment-dialog.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class EnrollmentDialogComponent implements OnInit {
  readonly communication = inject(EnrollmentCommunicationService);
  private readonly api = inject(ApiService);
  readonly device = input.required<DiscoveredDevice>();
  readonly enrolled = output<Device>();
  readonly dismissed = output<void>();
  readonly username = signal('admin');
  readonly password = signal('');
  readonly trustSshHostKey = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly instructions = signal('');
  readonly details = signal<string[]>([]);
  readonly errorSeverity = signal<'error' | 'warning'>('error');
  readonly ready = computed(() => this.communication.valid() && !this.communication.checking() && (!this.communication.sshEnabled() || this.trustSshHostKey() && Boolean(this.communication.fingerprint())));
  constructor() { effect(() => { this.communication.fingerprint(); untracked(() => this.trustSshHostKey.set(false)); }); }
  ngOnInit(): void { void this.communication.initialize(this.device().ip); }
  async enroll(): Promise<void> {
    if (this.saving() || !this.username().trim() || !this.ready()) return;
    this.saving.set(true); this.error.set(''); this.instructions.set(''); this.details.set([]);
    const device = this.device();
    try {
      const saved = await firstValueFrom(this.api.enrollDevice({
        hostname: device.hostname || device.ip, mgmtIp: device.ip, macAddress: device.mac,
        communication: this.communication.policy(this.trustSshHostKey()),
        model: device.model, routerosVersion: device.routerosVersion,
        username: this.username().trim(), password: this.password(),
      }));
      this.password.set('');
      this.enrolled.emit(saved);
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Enrollment failed';
      this.error.set(Array.isArray(message) ? message.join(', ') : message);
      this.details.set(Array.isArray(error?.error?.details) ? error.error.details.filter((detail: unknown): detail is string => typeof detail === 'string') : []);
      this.instructions.set(error?.error?.instructions || 'Check the device address, RouterOS login and API connectivity, then retry enrollment.');
      this.errorSeverity.set(error?.error?.severity === 'warning' ? 'warning' : 'error');
    } finally { this.saving.set(false); }
  }
}
