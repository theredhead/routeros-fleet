export interface ActionableIssue {
  code: string;
  message: string;
  instructions: string;
  details?: string[];
  severity: 'error' | 'warning';
}

export const CREDENTIAL_STORAGE_ISSUE: ActionableIssue = {
  code: 'CREDENTIAL_STORAGE_NOT_CONFIGURED',
  message: 'Credential storage is not configured. Device enrollment is unavailable.',
  instructions: 'On the API server, generate a key once with openssl rand -hex 32. Set ENCRYPTION_KEY to that 64-character hexadecimal value in server/.env, then restart the API and retry enrollment. Keep this key secure and backed up: it decrypts stored credentials and device backups. If data already exists, restore the original key instead of generating a replacement.',
  severity: 'warning',
};
