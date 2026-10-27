import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { DeviceCredential } from '../entities/device-credential.entity';
import { ConfigProfile } from '../entities/config-profile.entity';
import { Job } from '../entities/job.entity';
import { CryptoService } from '../common/crypto.service';
import { Creds, RouterOsClientService } from './router-os-client.service';
import { ReconcileService } from './reconcile.service';
import { DhcpRendererService } from './dhcp-renderer.service';
import { AuditService } from './audit.service';

// The three menus a DHCP server touches, with the field that identifies each record.
const MENUS: [string, string][] = [
  ['pool', 'ip/pool'],
  ['dhcpServer', 'ip/dhcp-server'],
  ['network', 'ip/dhcp-server/network'],
];
const KEYFIELD: Record<string, string> = { pool: 'name', dhcpServer: 'interface', network: 'address' };

function errMsg(e: any): string {
  return e?.response?.data ? JSON.stringify(e.response.data) : e?.message || String(e);
}

@Injectable()
export class DhcpConfigJobService {
  constructor(
    @InjectRepository(Device) private devices: Repository<Device>,
    @InjectRepository(DeviceCredential) private creds: Repository<DeviceCredential>,
    @InjectRepository(ConfigProfile) private profiles: Repository<ConfigProfile>,
    @InjectRepository(Job) private jobs: Repository<Job>,
    private client: RouterOsClientService,
    private reconcile: ReconcileService,
    private renderer: DhcpRendererService,
    private crypto: CryptoService,
    private audit: AuditService,
  ) {}

  private async credsFor(device: Device): Promise<Creds | null> {
    const cred = await this.creds.findOne({ where: { deviceId: device.id } });
    if (!cred) return null;
    return { host: device.mgmtIp, username: cred.username, password: this.crypto.decrypt(cred.passwordEncrypted) };
  }

  private async loadInputs(deviceId: string): Promise<{ device: Device; profile: ConfigProfile }> {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    const profile = await this.profiles.findOne({ where: { deviceId } });
    if (!profile || !profile.dhcpEnabled) {
      throw new BadRequestException('No DHCP config profile is enabled for this device');
    }
    return { device, profile };
  }

  /** Read-only: compute the exact ops that apply() would run, without touching the device. */
  async dryRun(deviceId: string): Promise<{ plan: any; backup: any }> {
    const { device, profile } = await this.loadInputs(deviceId);
    const creds = await this.credsFor(device);
    if (!creds) throw new BadRequestException('Device has no stored credential');

    const resource = await this.client.systemResource(creds); // connectivity precheck
    const desired = this.renderer.render(profile);
    const plan: any = {};
    const backup: any = {};
    for (const [name, menu] of MENUS) {
      const actual = await this.client.list(creds, menu);
      backup[name] = actual;
      plan[name] = this.reconcile.converge(menu, desired.menus[name as keyof typeof desired.menus], actual, KEYFIELD[name]);
    }
    return { plan, backup };
  }

  /** Create a queued job and run it in the background. Returns immediately with the job id. */
  async apply(deviceId: string): Promise<Job> {
    const { device, profile } = await this.loadInputs(deviceId);
    const job = await this.jobs.save(
      this.jobs.create({ deviceId, type: 'config', status: 'queued', dryRun: false }),
    );
    setImmediate(() => this.runApply(job.id, device, profile).catch((e) => {
      // last-resort guard so a crash never leaves a job stuck in "running"
      this.jobs.findOne({ where: { id: job.id } }).then((j) => {
        if (j && j.status === 'running') { j.status = 'failed'; j.error = errMsg(e); j.finishedAt = new Date(); return this.jobs.save(j); }
      });
    }));
    return job;
  }

  private async runApply(jobId: string, device: Device, profile: ConfigProfile): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    job.status = 'running';
    job.startedAt = new Date();
    await this.jobs.save(job);

    try {
      const creds = await this.credsFor(device);
      if (!creds) throw new Error('Device has no stored credential');

      // 1) Pre-flight connectivity check.
      let resource: any;
      try {
        resource = await this.client.systemResource(creds);
      } catch (e) {
        job.status = 'failed'; job.step = 'precheck'; job.error = 'Device unreachable: ' + errMsg(e);
        job.finishedAt = new Date(); await this.jobs.save(job); return;
      }

      // 2) Snapshot current state (backup) + compute the plan.
      const desired = this.renderer.render(profile);
      const plan: any = {};
      const backup: any = {};
      for (const [name, menu] of MENUS) {
        const actual = await this.client.list(creds, menu);
        backup[name] = actual;
        plan[name] = this.reconcile.converge(menu, desired.menus[name as keyof typeof desired.menus], actual, KEYFIELD[name]);
      }
      job.plan = plan; job.backup = backup; await this.jobs.save(job);

      // 3) Apply ops, tracking exactly what changed so we can roll back.
      const changes: any = {};
      for (const [name] of MENUS) changes[name] = { added: [], updated: [], removed: [] };
      const applied: any = {};
      for (const [name, menu] of MENUS) {
        applied[name] = [];
        for (const op of plan[name].ops) {
          if (op.action === 'add') {
            const res = await this.client.add(creds, menu, [op.props]);
            const id = res?.[0]?.id;
            changes[name].added.push({ id, props: op.props });
            await this.audit.record({ deviceId: device.id, customerId: device.customerId, action: 'dhcp.add', entityType: menu, after: res });
            applied[name].push(op);
          } else if (op.action === 'update') {
            const before = backup[name].find((o) => String(o.id) === String(op.id));
            await this.client.set(creds, menu, op.id, op.props);
            changes[name].updated.push({ id: op.id, before });
            await this.audit.record({ deviceId: device.id, customerId: device.customerId, action: 'dhcp.update', entityType: menu, entityId: op.id, before, after: op.props });
            applied[name].push(op);
          } else if (op.action === 'remove') {
            const before = backup[name].find((o) => String(o.id) === String(op.id));
            await this.client.remove(creds, menu, op.id);
            changes[name].removed.push(before);
            await this.audit.record({ deviceId: device.id, customerId: device.customerId, action: 'dhcp.remove', entityType: menu, entityId: op.id, before });
            applied[name].push(op);
          }
        }

        // 4) Optional prune of unmanaged records.
        if (profile.prune) {
          for (const rec of plan[name].removed) {
            await this.client.remove(creds, menu, String(rec.id));
            changes[name].removed.push(rec);
            await this.audit.record({ deviceId: device.id, customerId: device.customerId, action: 'dhcp.prune', entityType: menu, entityId: String(rec.id), before: rec });
            applied[name].push({ action: 'prune', id: rec.id });
          }
        }
      }

      // 5) Post-apply connectivity check. If we locked ourselves out, roll back.
      let ok = false;
      try { await this.client.systemResource(creds); ok = true; } catch { ok = false; }

      if (!ok) {
        await this.rollback(creds, changes);
        job.status = 'rolled_back';
        job.step = 'postcheck-rollback';
        job.result = { applied, note: 'Post-apply connectivity lost; rolled back to pre-apply snapshot' };
      } else {
        job.status = 'succeeded';
        job.step = 'done';
        job.result = { applied, deviceVersion: resource?.version };
      }

      // Record liveness + version on the device.
      device.lastSeenAt = new Date();
      if (resource?.version) device.routerosVersion = resource.version;
      device.status = 'online';
      await this.devices.save(device);
    } catch (e) {
      job.status = 'failed';
      job.error = errMsg(e);
    }

    job.finishedAt = new Date();
    await this.jobs.save(job);
  }

  /** Best-effort restore of the pre-apply snapshot. */
  private async rollback(creds: Creds, changes: any): Promise<void> {
    for (const [name, menu] of MENUS) {
      const c = changes[name];
      // remove anything we added
      for (const a of c.added) { if (a.id) { try { await this.client.remove(creds, menu, String(a.id)); } catch {} } }
      // reset anything we updated back to its prior props
      for (const u of c.updated) { if (u.before) { try { await this.client.set(creds, menu, String(u.id), this.reconcile.writableProps(u.before)); } catch {} } }
      // re-add anything we removed/pruned
      for (const r of c.removed) { if (r && r.id !== undefined) { try { await this.client.add(creds, menu, [this.reconcile.writableProps(r)]); } catch {} } }
    }
  }
}
