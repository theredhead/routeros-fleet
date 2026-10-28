import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { CommunicationSettingsService } from './communication-settings.service';
import { DEFAULT_METHODS } from './communication.models';
import { LiveUpdatesService } from './live-updates.service';

describe('CommunicationSettingsService', () => {
  it('loads global settings, probes without credentials and preserves form values while reordering', async () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: LiveUpdatesService, useValue: {watch: () => {}}}]});
    const service = TestBed.inject(CommunicationSettingsService), http = TestBed.inject(HttpTestingController);
    const loading = service.load(); http.expectOne('/api/communication/settings').flush({methods: DEFAULT_METHODS, revision: 0});
    const settings = await loading;
    const draft = service.draft(settings.methods);
    draft.update({id: 'https-rest', changes: {port: 8443}});
    draft.move({id: 'https-rest', offset: 2});
    expect(draft.methods().slice(0, 3).map(method => method.id)).toEqual(['ssh', 'api-tls', 'https-rest']);
    draft.move({id: 'https-rest', offset: -1});
    expect(draft.methods()[1].id).toBe('https-rest');
    expect(draft.methods()[1].port).toBe(8443);
    const probing = service.probe('192.0.2.1', {methods: draft.methods()});
    const probe = http.expectOne('/api/communication/probe');
    expect(probe.request.body.username).toBeUndefined(); expect(probe.request.body.password).toBeUndefined();
    probe.flush([]); await probing; http.verify();
  });
});
