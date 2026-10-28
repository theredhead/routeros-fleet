import { CommunicationModule } from '../communication/communication.module';
import { DeviceInspectionService } from './device-inspection.service';
import { Job, AuditLog } from '../entities';
import { RouterOsModule } from '../routeros/routeros.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { DeviceCredential } from '../entities/device-credential.entity';
import { Customer } from '../entities/customer.entity';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';

@Module({
  imports: [CommunicationModule, RouterOsModule, TypeOrmModule.forFeature([Device, DeviceCredential, Customer, Job, AuditLog])],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceInspectionService],
  exports: [DevicesService],
})
export class DevicesModule {}
