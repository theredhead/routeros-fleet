import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActionableIssue } from '../common/actionable-issue';
import { ConfigurationCheck } from './configuration-check';

@Injectable()
export class EnvironmentConfigurationCheck implements ConfigurationCheck {
  readonly name = 'environment';
  constructor(private readonly config: ConfigService) {}
  check(): ActionableIssue[] {
    const issues: ActionableIssue[] = [];
    const invalid = (setting: string, requirement: string) => issues.push({
      code: `INVALID_${setting}`, severity: 'error', message: `${setting} is not configured correctly.`,
      instructions: `Set ${setting} ${requirement} in the API server environment, then restart the API.`,
    });
    for (const [setting, fallback, maximum] of [['PORT', '3000', 65535], ['DB_PORT', '5432', 65535], ['ROUTEROS_TIMEOUT_MS', '15000', 2147483647]] as const) {
      const value = String(this.config.get(setting, fallback));
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) invalid(setting, `to a whole number between 1 and ${maximum}`);
    }
    for (const [setting, fallback] of [['DB_SYNCHRONIZE', 'true'], ['DEVELOPMENT_TOOLS_ENABLED', 'true']] as const) {
      if (!['true', 'false'].includes(String(this.config.get(setting, fallback)))) invalid(setting, 'to exactly true or false');
    }
    for (const [setting, fallback] of [['DB_HOST', 'localhost'], ['DB_USERNAME', 'fleet'], ['DB_DATABASE', 'fleet']] as const) {
      if (!String(this.config.get(setting, fallback)).trim()) invalid(setting, 'to a nonempty value');
    }
    const origins = String(this.config.get('CORS_ORIGIN', 'http://localhost:4200')).split(',').map(origin => origin.trim());
    if (origins.some(origin => {
      try { const url = new URL(origin); return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin; }
      catch { return true; }
    })) invalid('CORS_ORIGIN', 'to a comma-separated list of HTTP or HTTPS origins, without paths or trailing slashes');
    if (this.config.get('NODE_ENV', 'development') === 'production' && String(this.config.get('DB_SYNCHRONIZE', 'true')) === 'true') {
      issues.push({code: 'PRODUCTION_SCHEMA_SYNCHRONIZATION', severity: 'warning', message: 'Automatic database schema synchronization is enabled in production.', instructions: 'Provision the schema through reviewed database migrations, set DB_SYNCHRONIZE=false, and restart the API.'});
    }
    return issues;
  }
}
