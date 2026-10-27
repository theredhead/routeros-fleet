import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { CustomersModule } from './customers/customers.module';
import { DevicesModule } from './devices/devices.module';
import { ConfigProfilesModule } from './config-profiles/config-profiles.module';
import { JobsModule } from './jobs/jobs.module';
import { RouterOsModule } from './routeros/routeros.module';
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
    CommonModule,
    CustomersModule,
    DevicesModule,
    ConfigProfilesModule,
    JobsModule,
    RouterOsModule,
  ],
})
export class AppModule {}
