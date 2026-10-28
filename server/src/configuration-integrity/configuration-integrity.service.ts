import { Inject, Injectable } from '@nestjs/common';
import { ActionableIssue } from '../common/actionable-issue';
import { CONFIGURATION_CHECKS, ConfigurationCheck } from './configuration-check';

@Injectable()
export class ConfigurationIntegrityService {
  constructor(@Inject(CONFIGURATION_CHECKS) private readonly checks: ConfigurationCheck[]) {}
  async check(): Promise<ActionableIssue[]> {
    const results = await Promise.allSettled(this.checks.map(check => Promise.resolve().then(() => check.check())));
    return results.flatMap((result, index) => result.status === 'fulfilled' ? result.value : [{
      code: `CONFIGURATION_CHECK_FAILED_${this.checks[index].name}`, severity: 'error' as const,
      message: `The ${this.checks[index].name} configuration check could not complete.`,
      instructions: 'Inspect the API server logs, resolve the check failure, then retry the status check. Configuration readiness has not been confirmed.',
    }]);
  }
}
