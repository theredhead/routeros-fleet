import { FleetEventsService } from '../events/fleet-events.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import * as os from 'node:os';
import { FleetProfileEntity, AuditLog, ConfigProfile, Customer, Device, DeviceCredential, Job } from '../entities';

import { seedRequiredProfiles } from '../profiles/profile-defaults';

const INVENTORY = [
  { entity: FleetProfileEntity, label: 'Profiles' },
  { entity: Customer, label: 'Customers' },
  { entity: Device, label: 'Devices' },
  { entity: DeviceCredential, label: 'Stored credentials' },
  { entity: ConfigProfile, label: 'Configuration profiles' },
  { entity: Job, label: 'Jobs' },
  { entity: AuditLog, label: 'Audit entries' },
];

@Injectable()
export class DevelopmentService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService, @Optional() private readonly events?: FleetEventsService) {}

  private get resetEnabled(): boolean {
    return this.config.get('NODE_ENV', 'development') !== 'production' &&
      String(this.config.get('DEVELOPMENT_TOOLS_ENABLED', 'true')) === 'true';
  }

  private async inventory(manager: EntityManager) {
    const rows: { label: string; count: number }[] = [];
    for (const { entity, label } of INVENTORY) {
      rows.push({ label, count: await manager.getRepository(entity).count() });
    }
    return rows;
  }

  async diagnostics() {
    const options = this.db.options as { database?: string; host?: string; port?: number; schema?: string; synchronize?: boolean };
    const interfaces = Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
      (entries || []).filter(entry => !entry.internal && entry.family === 'IPv4').map(entry => ({
        name, address: entry.address, subnet: entry.cidr, mac: entry.mac,
      })),
    );
    return {
      checkedAt: new Date().toISOString(),
      environment: this.config.get('NODE_ENV', 'development'),
      resetEnabled: this.resetEnabled,
      runtime: { node: process.version, platform: process.platform, uptimeSeconds: Math.floor(process.uptime()) },
      database: {
        name: options.database, host: options.host, port: options.port, schema: options.schema || 'public',
        synchronize: Boolean(options.synchronize),
      },
      credentialsConfigured: /^[0-9a-f]{64}$/i.test(this.config.get('ENCRYPTION_KEY', '')),
      inventory: await this.inventory(this.db.manager),
      activeJobs: await this.db.getRepository(Job).countBy({ status: In(['queued', 'running']) }),
      interfaces,
    };
  }

  async reset(confirmation: string) {
    if (!this.resetEnabled) throw new ForbiddenException('Database reset is disabled in this environment.');
    if (confirmation !== 'RESET DATABASE') throw new BadRequestException('Type RESET DATABASE to confirm.');
    const removed = await this.db.transaction(async manager => {
      // Lock before checking jobs and counting rows. Either all app tables are reset or none are.
      // Use metadata names only; request input never becomes a SQL identifier.
      const tables = INVENTORY.map(({ entity }) => {
        const metadata = this.db.getMetadata(entity);
        return [metadata.schema || 'public', metadata.tableName]
          .map(part => this.db.driver.escape(part)).join('.');
      }).join(', ');
      await manager.query("SET LOCAL lock_timeout = '5s'");
      await manager.query(`LOCK TABLE ${tables} IN ACCESS EXCLUSIVE MODE`);
      const active = await manager.getRepository(Job).countBy({ status: In(['queued', 'running']) });
      if (active) throw new ConflictException('Wait for queued or running jobs to finish before resetting.');
      const counts = await this.inventory(manager);
      // No CASCADE: an unexpected dependency must fail and roll back, not erase another table.
      await manager.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY`);
      await seedRequiredProfiles(manager);
      return counts;
    });
    this.events?.publish(['customers', 'devices', 'profiles', 'configuration', 'jobs']);
    return { resetAt: new Date().toISOString(), removed };
  }
}
