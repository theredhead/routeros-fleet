import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { ConfigurationIntegrityService } from './configuration-integrity.service';

describe('ConfigurationIntegrityService', () => {
  it('retrieves all issues and reports inability to check as an actionable issue', async () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    const service = TestBed.inject(ConfigurationIntegrityService);
    const http = TestBed.inject(HttpTestingController);
    const issues = [{code: 'ONE', severity: 'warning', message: 'Missing setup', instructions: 'Configure it.'}];
    const checked = service.check(); http.expectOne('/api/configuration/issues').flush(issues);
    expect(await checked).toEqual(issues);
    const failed = service.check(); http.expectOne('/api/configuration/issues').flush({}, {status: 503, statusText: 'Unavailable'});
    expect((await failed)[0].code).toBe('CONFIGURATION_CHECK_UNAVAILABLE');
    http.verify();
  });
});
