import { NotificationsService } from '../../core/notifications.service';
import { firstValueFrom } from 'rxjs';
import { LiveUpdatesService } from '../../core/live-updates.service';
import { AppFormsService } from '../../forms/app-forms.service';
import { HelpPopoverComponent } from '../../shared/help-popover.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { UISurface } from '@theredhead/lucid-foundation';
import { UIButton } from '@theredhead/lucid-kit';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UIForm } from '@theredhead/lucid-forms';
import { ApiService } from '../../core/api.service';
import { ConfigProfile, Device, Job } from '../../models';

@Component({
  selector: 'app-dhcp-editor',
  imports: [HelpPopoverComponent, CommonModule, UIForm, UIButton, UISurface],
  templateUrl: './dhcp-editor.component.html',
})
export class DhcpEditorComponent implements OnInit {
  private readonly notifications = inject(NotificationsService);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  readonly id = this.route.snapshot.paramMap.get('id')!;
  readonly menus = ['pool', 'dhcpServer', 'network'];

  device = signal<Device | null>(null);
  current = signal<any>(null);
  plan = signal<any>(null);
  job = signal<Job | null>(null);
  busy = signal(false);
  error = signal<string | null>(null);

  readonly notice = signal('');
  readonly form = inject(AppFormsService).engine('dhcp');

  private savedValues = JSON.stringify(this.form.values());

  private patchForm(values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) this.form.setValue(key, value);
  }

  constructor() {
    inject(LiveUpdatesService).watch(['jobs'], () => this.refreshJob());
    inject(LiveUpdatesService).watch(['devices'], async () => { this.device.set(await firstValueFrom(this.api.getDevice(this.id))); });
    inject(LiveUpdatesService).watch(['configuration'], () => this.refreshConfiguration(), () => this.busy());
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getDevice(this.id).subscribe({
      next: (d) => {
        this.device.set(d);
        this.api.getProfile(this.id).subscribe(
          (p) => this.prefill(p),
          (error: unknown) => this.profileLoadFailed(error),
        );
      },
      error: (e) => this.error.set(this.msg(e)),
    });
  }

  private async refreshConfiguration(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.api.getProfile(this.id));
      if (JSON.stringify(this.form.values()) !== this.savedValues) {
        this.notice.set('Configuration changed elsewhere. Your unsaved changes are preserved.');
      } else this.prefill(profile);
    } catch (error: unknown) { this.profileLoadFailed(error); }
  }

  private profileLoadFailed(error: unknown): void {
    const status = (error as {status?: number})?.status;
    if (status === 404) {
      console.debug('This device has no saved DHCP configuration.', {deviceId: this.id});
      return;
    }
    console.warn('Could not load saved DHCP configuration.', {deviceId: this.id, status});
    this.error.set('Could not load saved DHCP configuration. Your current draft is preserved.');
  }

  private prefill(p: ConfigProfile): void {
    this.patchForm({
      dhcpEnabled: p.dhcpEnabled,
      dhcpInterface: p.dhcpInterface ?? '',
      subnetCidr: p.subnetCidr ?? '',
      gatewayIp: p.gatewayIp ?? '',
      dnsServer: p.dnsServer ?? '',
      poolName: p.poolName ?? 'dhcp_pool',
      poolStart: p.poolStart ?? '',
      poolEnd: p.poolEnd ?? '',
      prune: p.prune,
    });
    this.savedValues = JSON.stringify(this.form.values());
    this.notice.set('');
  }

  loadCurrent(): void {
    this.api.getCurrentDhcp(this.id).subscribe({
      next: (res) => {
        this.current.set(res);
        const s = res.summary;
        if (!s) return;
        const patch: any = {
          dhcpInterface: s.dhcpInterface ?? '',
          subnetCidr: s.subnetCidr ?? '',
          gatewayIp: s.gatewayIp ?? '',
          dnsServer: s.dnsServer ?? '',
          poolName: s.addressPool ?? 'dhcp_pool',
        };
        if (s.ranges) {
          const [a, b] = String(s.ranges).split('-');
          patch.poolStart = a; patch.poolEnd = b;
        }
        this.patchForm(patch);
      },
      error: (e) => this.error.set(this.msg(e)),
    });
  }

  saveProfile(): void {
    if (!this.form.valid() || this.busy()) return;
    this.api.saveProfile(this.id, this.form.values()).subscribe({
      next: profile => { this.prefill(profile); this.notifications.success('Desired configuration saved.'); },
      error: (e) => this.error.set('Save failed: ' + this.msg(e)),
    });
  }

  dryRun(): void {
    if (this.busy() || !this.form.valid()) return;
    this.busy.set(true); this.plan.set(null); this.error.set(null);
    // persist desired state first so the run reflects the form
    this.api.saveProfile(this.id, this.form.values()).subscribe({
      next: () => {
        this.api.dryRunDhcp(this.id).subscribe({
          next: (r) => { this.plan.set(r.plan); this.job.set(r.job); this.busy.set(false); },
          error: (e) => { this.error.set('Dry-run failed: ' + this.msg(e)); this.busy.set(false); },
        });
      },
      error: (e) => { this.error.set('Save failed: ' + this.msg(e)); this.busy.set(false); },
    });
  }

  apply(): void {
    if (this.busy() || !this.form.valid()) return;
    this.busy.set(true); this.plan.set(null); this.error.set(null);
    this.api.saveProfile(this.id, this.form.values()).subscribe({
      next: () => {
        this.api.applyDhcp(this.id).subscribe({
          next: (job) => { this.job.set(job); void this.refreshJob(); },
          error: (e) => { this.error.set('Apply failed: ' + this.msg(e)); this.busy.set(false); },
        });
      },
      error: (e) => { this.error.set('Save failed: ' + this.msg(e)); this.busy.set(false); },
    });
  }

  private async refreshJob(): Promise<void> {
    const job = this.job();
    if (!job) return;
    try {
      const current = await firstValueFrom(this.api.getJob(job.id));
      this.job.set(current);
      if (['succeeded', 'failed', 'rolled_back'].includes(current.status)) this.busy.set(false);
    } catch (error) { this.error.set(this.msg(error)); this.busy.set(false); }
  }

  fmt(props: Record<string, any>): string {
    return Object.entries(props).map(([k, v]) => `${k}=${v}`).join(' ');
  }

  private msg(e: any): string {
    const m = e?.error?.message ?? e?.message ?? String(e);
    return Array.isArray(m) ? m.join(', ') : m;
  }
}
