import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { ActionableIssue } from '../models';

@Injectable({providedIn: 'root'})
export class ConfigurationIntegrityService {
  private readonly http = inject(HttpClient);
  async check(): Promise<ActionableIssue[]> {
    try {
      return await firstValueFrom(this.http.get<ActionableIssue[]>('/api/configuration/issues').pipe(timeout(10000)));
    } catch {
      return [{code: 'CONFIGURATION_CHECK_UNAVAILABLE', severity: 'error', message: 'Configuration integrity could not be checked.', instructions: 'Check that the API server is running and reachable and that /api/configuration/issues is available. Restore access, then refresh the landing page status. Configuration readiness has not been confirmed.'}];
    }
  }
}
