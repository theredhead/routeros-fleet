import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommunicationSettingsService } from '../communication/communication-settings.service';
import { SaveCommunicationSettingsDto } from '../communication/communication.dto';
import { ActionableIssue } from '../common/actionable-issue';
import { ConfigurationCheck } from './configuration-check';
@Injectable()
export class CommunicationConfigurationCheck implements ConfigurationCheck {
  readonly name = 'communication';
  constructor(private readonly settings: CommunicationSettingsService) {}
  async check(): Promise<ActionableIssue[]> {
    const settings = await this.settings.get();
    if ((await validate(plainToInstance(SaveCommunicationSettingsDto, settings))).length || !settings.methods.some(method => method.enabled)) {
      return [{code: 'COMMUNICATION_SETTINGS_INVALID', severity: 'error', message: 'Communication settings are invalid or all methods are disabled.', instructions: 'Open Communication, enable at least one supported method, use valid ports, and save the settings.'}];
    }
    const issues: ActionableIssue[] = [];
    if (settings.methods.some(method => method.enabled && ['http-rest', 'api'].includes(method.id))) issues.push({code: 'UNENCRYPTED_COMMUNICATION_ENABLED', severity: 'warning', message: 'Unencrypted router communication methods are enabled.', instructions: 'HTTP REST and plain native API send credentials without encryption. In Communication, disable them unless this is intentional for your management network.'});
    if (settings.methods.some(method => method.enabled && ['https-rest', 'api-tls'].includes(method.id) && method.acceptSelfSignedCertificates)) issues.push({code: 'UNTRUSTED_CERTIFICATES_ACCEPTED', severity: 'warning', message: 'Router TLS certificate validation is disabled for an enabled method.', instructions: 'In Communication, turn off acceptance of untrusted certificates when your routers have valid trusted certificates. This option skips chain, identity and expiry validation.'});
    return issues;
  }
}
