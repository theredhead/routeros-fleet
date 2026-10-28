import { ConfigurationIntegrityModule } from './configuration-integrity/configuration-integrity.module';
import { FiltersModule } from './filters/filters.module';
import { FleetEventsModule } from './events/fleet-events.module';
import { FormsModule } from './forms/forms.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { CustomersModule } from './customers/customers.module';
import { DevicesModule } from './devices/devices.module';
import { ConfigProfilesModule } from './config-profiles/config-profiles.module';
import { JobsModule } from './jobs/jobs.module';
import { RouterOsModule } from './routeros/routeros.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { DevelopmentModule } from './development/development.module';
import { ProfilesModule } from './profiles/profiles.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: parseInt(cfg.get('DB_PORT', '5432'), 10),
        username: cfg.get('DB_USERNAME', 'fleet'),
        password: cfg.get('DB_PASSWORD', 'fleet'),
        database: cfg.get('DB_DATABASE', 'fleet'),
        autoLoadEntities: true,
        // PoC convenience. For production switch to `migrations` + `synchronize:false`.
        synchronize: cfg.get('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
    FleetEventsModule,
    CommonModule,
    ConfigurationIntegrityModule,
    CustomersModule,
    DevicesModule,
    ConfigProfilesModule,
    JobsModule,
    RouterOsModule,
    DiscoveryModule,
    DevelopmentModule,
    FormsModule,
    FiltersModule,
    ProfilesModule,
  ],
})
export class AppModule {}
