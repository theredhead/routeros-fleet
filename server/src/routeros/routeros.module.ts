import { CommunicationModule } from '../communication/communication.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { DeviceCredential } from '../entities/device-credential.entity';
import { ConfigProfile } from '../entities/config-profile.entity';
import { Job } from '../entities/job.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { RouterOsClientService } from './router-os-client.service';
import { ReconcileService } from './reconcile.service';
import { DhcpRendererService } from './dhcp-renderer.service';
import { AuditService } from './audit.service';
import { DhcpConfigJobService } from './dhcp-config-job.service';

@Module({
  imports: [CommunicationModule, TypeOrmModule.forFeature([Device, DeviceCredential, ConfigProfile, Job, AuditLog])],
  providers: [RouterOsClientService, ReconcileService, DhcpRendererService, AuditService, DhcpConfigJobService],
  exports: [RouterOsClientService, ReconcileService, DhcpRendererService, AuditService, DhcpConfigJobService],
})
export class RouterOsModule {}
