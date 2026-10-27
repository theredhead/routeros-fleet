import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { DeviceCredential } from '../entities/device-credential.entity';
import { ConfigProfile } from '../entities/config-profile.entity';
import { RouterOsModule } from '../routeros/routeros.module';
import { ConfigProfilesService } from './config-profiles.service';
import { ConfigProfilesController } from './config-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceCredential, ConfigProfile]), RouterOsModule],
  controllers: [ConfigProfilesController],
  providers: [ConfigProfilesService],
  exports: [ConfigProfilesService],
})
export class ConfigProfilesModule {}
