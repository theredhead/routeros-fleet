import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationSettingsService } from '../../core/communication-settings.service';
import { CommunicationDraft } from '../../core/communication-draft';
import { DEFAULT_METHODS } from '../../core/communication.models';
import { EnrollmentCommunicationService } from './enrollment-communication.service';

describe('EnrollmentCommunicationService', () => {
  it('checks the device before login and only includes the SSH fingerprint after explicit trust', async () => {
    const fingerprint = 'SHA256:' + 'a'.repeat(43);
    const settings = {load: vi.fn().mockResolvedValue({methods: DEFAULT_METHODS}), draft: (methods: typeof DEFAULT_METHODS) => new CommunicationDraft(methods), probe: vi.fn().mockResolvedValue([{id: 'ssh', port: 22, sshHostKeyFingerprint: fingerprint}])};
    TestBed.configureTestingModule({providers: [EnrollmentCommunicationService, {provide: CommunicationSettingsService, useValue: settings}]});
    const service = TestBed.inject(EnrollmentCommunicationService);
    await service.initialize('192.0.2.1');
    expect(settings.probe.mock.calls[0][0]).toBe('192.0.2.1');
    expect(settings.probe.mock.calls[0][1].methods.map((method: {id: string}) => method.id)).toEqual(['https-rest', 'ssh', 'api-tls']);
    expect(service.policy(false).sshHostKeyFingerprint).toBeUndefined();
    expect(service.policy(true).sshHostKeyFingerprint).toBe(fingerprint);
    service.draft()!.update({id: 'ssh', changes: {port: 2222}});
    expect(service.policy(true).sshHostKeyFingerprint).toBeUndefined();
  });
});
