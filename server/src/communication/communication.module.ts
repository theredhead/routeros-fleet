import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationSettingsEntity } from './communication-settings.entity';
import { CommunicationSettingsService } from './communication-settings.service';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';
import { TRANSPORT_STRATEGIES } from './transport-strategy';
import { RestStrategy } from './strategies/rest.strategy';
import { ApiStrategy } from './strategies/api.strategy';
import { SshStrategy } from './strategies/ssh.strategy';
@Module({
  imports: [TypeOrmModule.forFeature([CommunicationSettingsEntity])],
  providers: [CommunicationSettingsService, CommunicationService, {provide: TRANSPORT_STRATEGIES, useFactory: () => [new RestStrategy('https-rest'), new SshStrategy(), new ApiStrategy('api-tls'), new RestStrategy('http-rest'), new ApiStrategy('api')]}],
  controllers: [CommunicationController], exports: [CommunicationService, CommunicationSettingsService],
})
export class CommunicationModule {}
