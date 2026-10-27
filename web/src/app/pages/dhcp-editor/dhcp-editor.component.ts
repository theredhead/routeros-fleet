import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ConfigProfile, Device, Job } from '../../models';

const IP = /^(\d{1,3}\.){3}\d{1,3}$/;

@Component({
  selector: 'app-dhcp-editor',
  imports: [CommonModule, ReactiveFormsModule],
  template: '\n    <div class="page-head">\n      <h1>DHCP configuration</h1>\n      @if (device(); as d) {\n        <span class="sub">{{ d.hostname }} · {{ d.mgmtIp }} · RouterOS {{ d.routerosVersion || \'?\' }}</span>\n      } @else { <span class="sub">loading device…</span> }\n    </div>\n\n    @if (error(); as e) { <div class="banner err">{{ e }}</div> }\n\n    <div class="grid2">\n      <!-- Desired state form -->\n      <div class="card">\n        <h2>Desired state</h2>\n        <form [formGroup]="form" (ngSubmit)="saveProfile()">\n          <div class="row">\n            <label>DHCP enabled</label>\n            <input type="checkbox" formControlName="dhcpEnabled" style="width:auto">\n          </div>\n          <div class="row"><label>Interface</label><input formControlName="dhcpInterface" placeholder="bridge1"></div>\n          <div class="row"><label>Subnet (CIDR)</label><input formControlName="subnetCidr" placeholder="192.168.1.0/24"></div>\n          <div class="row"><label>Gateway</label><input formControlName="gatewayIp" placeholder="192.168.1.1"></div>\n          <div class="row"><label>DNS server</label><input formControlName="dnsServer" placeholder="192.168.1.1"></div>\n          <div class="row"><label>Pool name</label><input formControlName="poolName"></div>\n          <div class="row"><label>Pool start</label><input formControlName="poolStart" placeholder="192.168.1.2"></div>\n          <div class="row"><label>Pool end</label><input formControlName="poolEnd" placeholder="192.168.1.254"></div>\n          <div class="row">\n            <label>Prune unmanaged records on apply</label>\n            <input type="checkbox" formControlName="prune" style="width:auto">\n          </div>\n\n          <div class="actions">\n            <button type="button" (click)="loadCurrent()" [disabled]="busy()">Load from device</button>\n            <button type="submit" [disabled]="!form.valid || busy()">Save desired state</button>\n          </div>\n        </form>\n      </div>\n\n      <!-- Operations -->\n      <div class="card">\n        <h2>Apply</h2>\n        <p class="sub">Dry-run shows the exact RouterOS calls without touching the device. Apply executes them with a connectivity check and automatic rollback on failure.</p>\n        <div class="actions">\n          <button (click)="dryRun()" [disabled]="busy()">Dry-run</button>\n          <button class="primary" (click)="apply()" [disabled]="busy()">Apply to device</button>\n        </div>\n\n        @if (job(); as j) {\n          <div class="banner" [class.ok]="j.status===\'succeeded\'" [class.err]="j.status===\'failed\' || j.status===\'rolled_back\'">\n            Job: <b>{{ j.status }}</b> · step {{ j.step || \'—\' }} @if (j.error) { · {{ j.error }} }\n          </div>\n        }\n\n        @if (plan(); as p) {\n          <h3>Dry-run plan</h3>\n          @for (m of menus; track m) {\n            <div class="menu-block">\n              <div class="menu-name">{{ m }}</div>\n              @if (p[m].ops.length === 0) {\n                <div class="op none">no changes</div>\n              } @else {\n                @for (op of p[m].ops; track $index) {\n                  <div class="op" [class.add]="op.action===\'add\'" [class.update]="op.action===\'update\'" [class.remove]="op.action===\'remove\'">\n                    <b>{{ op.action }}</b>\n                    @if (op.action === \'add\') { {{ fmt(op.props) }} }\n                    @if (op.action === \'update\') { id={{ op.id }} → {{ fmt(op.props) }} }\n                    @if (op.action === \'remove\') { id={{ op.id }} }\n                  </div>\n                }\n              }\n              @if (p[m].removed.length > 0) {\n                <div class="sub" style="margin-top:6px">{{ p[m].removed.length }} unmanaged record(s) present — pruned only if “prune” is on.</div>\n              }\n            </div>\n          }\n        }\n      </div>\n    </div>\n',
})
export class DhcpEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly id = this.route.snapshot.paramMap.get('id')!;
  readonly menus = ['pool', 'dhcpServer', 'network'];

  device = signal<Device | null>(null);
  current = signal<any>(null);
  plan = signal<any>(null);
  job = signal<Job | null>(null);
  busy = signal(false);
  error = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    dhcpEnabled: [true, { nonNullable: true }],
    dhcpInterface: ['', Validators.required],
    subnetCidr: ['', Validators.required],
    gatewayIp: ['', [Validators.required, Validators.pattern(IP)]],
    dnsServer: [''],
    poolName: ['dhcp_pool', { nonNullable: true }],
    poolStart: ['', [Validators.required, Validators.pattern(IP)]],
    poolEnd: ['', [Validators.required, Validators.pattern(IP)]],
    prune: [false, { nonNullable: true }],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getDevice(this.id).subscribe({
      next: (d) => {
        this.device.set(d);
        this.api.getProfile(this.id).subscribe(
          (p) => this.prefill(p),
          () => {}, // no profile yet — start blank
        );
      },
      error: (e) => this.error.set(this.msg(e)),
    });
  }

  private prefill(p: ConfigProfile): void {
    this.form.patchValue({
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
        this.form.patchValue(patch);
      },
      error: (e) => this.error.set(this.msg(e)),
    });
  }

  saveProfile(): void {
    if (!this.form.valid) return;
    this.api.saveProfile(this.id, this.form.value).subscribe({
      next: () => {},
      error: (e) => this.error.set('Save failed: ' + this.msg(e)),
    });
  }

  dryRun(): void {
    this.busy.set(true); this.plan.set(null); this.error.set(null);
    // persist desired state first so the run reflects the form
    this.api.saveProfile(this.id, this.form.value).subscribe({
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
    this.busy.set(true); this.plan.set(null); this.error.set(null);
    this.api.saveProfile(this.id, this.form.value).subscribe({
      next: () => {
        this.api.applyDhcp(this.id).subscribe({
          next: (job) => { this.job.set(job); this.poll(job.id); },
          error: (e) => { this.error.set('Apply failed: ' + this.msg(e)); this.busy.set(false); },
        });
      },
      error: (e) => { this.error.set('Save failed: ' + this.msg(e)); this.busy.set(false); },
    });
  }

  private poll(jobId: string, tries = 0): void {
    if (tries > 80) { this.busy.set(false); return; }
    setTimeout(() => {
      this.api.getJob(jobId).subscribe({
        next: (j) => {
          this.job.set(j);
          const done = ['succeeded', 'failed', 'rolled_back'].includes(j.status);
          if (!done) this.poll(jobId, tries + 1); else this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
    }, 1500);
  }

  fmt(props: Record<string, any>): string {
    return Object.entries(props).map(([k, v]) => `${k}=${v}`).join(' ');
  }

  private msg(e: any): string {
    const m = e?.error?.message ?? e?.message ?? String(e);
    return Array.isArray(m) ? m.join(', ') : m;
  }
}
