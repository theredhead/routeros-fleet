import { DataSource } from 'typeorm';
import { DeviceCredential } from '../entities/device-credential.entity';
import { ActionableIssue } from '../common/actionable-issue';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '../common/crypto.service';
import { CREDENTIAL_STORAGE_ISSUE } from '../common/actionable-issue';
import { ConfigurationCheck } from './configuration-check';

@Injectable()
export class EncryptionConfigurationCheck implements ConfigurationCheck {
  readonly name = 'encryption';
  constructor(private readonly crypto: CryptoService, private readonly database: DataSource) {}
  async check(): Promise<ActionableIssue[]> {
    if (!this.crypto.isConfigured()) return [CREDENTIAL_STORAGE_ISSUE];
    const credentials = await this.database.getRepository(DeviceCredential).find({select: {passwordEncrypted: true}});
    try { for (const credential of credentials) this.crypto.decrypt(credential.passwordEncrypted); }
    catch {
      return [{code: 'STORED_CREDENTIALS_UNREADABLE', severity: 'error', message: 'Stored device credentials cannot be decrypted.', instructions: 'Restore the original ENCRYPTION_KEY used to store these credentials and restart the API. If the key is correct, investigate credential-record corruption and restore affected records from a database backup. Generating a replacement key will not recover existing credentials or backups.'}];
    }
    return [];
  }
}
