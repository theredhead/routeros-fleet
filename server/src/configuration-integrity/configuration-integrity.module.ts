import { CommunicationModule } from '../communication/communication.module';
import { CommunicationConfigurationCheck } from './communication-configuration.check';
import { Module } from '@nestjs/common';
import { CONFIGURATION_CHECKS } from './configuration-check';
import { EncryptionConfigurationCheck } from './encryption-configuration.check';
import { EnvironmentConfigurationCheck } from './environment-configuration.check';
import { DatabaseSchemaCheck } from './database-schema.check';
import { ConfigurationIntegrityController } from './configuration-integrity.controller';
import { ConfigurationIntegrityService } from './configuration-integrity.service';

@Module({
  imports: [CommunicationModule],
  controllers: [ConfigurationIntegrityController],
  providers: [CommunicationConfigurationCheck, EncryptionConfigurationCheck, EnvironmentConfigurationCheck, DatabaseSchemaCheck, {
    provide: CONFIGURATION_CHECKS,
    useFactory: (encryption: EncryptionConfigurationCheck, environment: EnvironmentConfigurationCheck, database: DatabaseSchemaCheck, communication: CommunicationConfigurationCheck) => [encryption, environment, database, communication],
    inject: [EncryptionConfigurationCheck, EnvironmentConfigurationCheck, DatabaseSchemaCheck, CommunicationConfigurationCheck],
  }, ConfigurationIntegrityService],
})
export class ConfigurationIntegrityModule {}
