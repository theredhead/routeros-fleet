import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetProfileEntity, AuditLog, ConfigProfile, Customer, Device, DeviceCredential, Job } from '../entities';
import { DevelopmentController } from './development.controller';
import { DevelopmentService } from './development.service';

@Module({
  imports: [TypeOrmModule.forFeature([FleetProfileEntity, Customer, Device, DeviceCredential, ConfigProfile, Job, AuditLog])],
  controllers: [DevelopmentController],
  providers: [DevelopmentService],
})
export class DevelopmentModule {}
