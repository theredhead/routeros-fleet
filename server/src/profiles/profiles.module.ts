import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetProfileEntity } from '../entities/fleet-profile.entity';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({ imports: [TypeOrmModule.forFeature([FleetProfileEntity])], controllers: [ProfilesController], providers: [ProfilesService] })
export class ProfilesModule {}
