import { Injectable, computed, inject, signal } from '@angular/core';
import { CommunicationSettingsService } from '../../core/communication-settings.service';
import { CommunicationDraft } from '../../core/communication-draft';
import { CommunicationProbe, DeviceCommunication } from '../../core/communication.models';
@Injectable()
export class EnrollmentCommunicationService {
  private readonly settings = inject(CommunicationSettingsService);
  readonly draft = signal<CommunicationDraft | null>(null);
  readonly probes = signal<CommunicationProbe[]>([]);
  readonly checking = signal(false);
  readonly error = signal('');
  readonly valid = computed(() => Boolean(this.draft()?.valid()));
  readonly sshEnabled = computed(() => Boolean(this.draft()?.methods().some(method => method.id === 'ssh' && method.enabled)));
  readonly fingerprint = computed(() => {
    const method = this.draft()?.methods().find(method => method.id === 'ssh' && method.enabled);
    return method ? this.probes().find(probe => probe.id === 'ssh' && probe.port === method.port)?.sshHostKeyFingerprint : undefined;
  });
  async initialize(host: string): Promise<void> {
    this.checking.set(true); this.error.set('');
    try { const settings = await this.settings.load(); this.draft.set(this.settings.draft(settings.methods.filter(method => method.enabled))); }
    catch { this.error.set('Could not load the enabled communication methods. Check API availability and retry.'); }
    finally { this.checking.set(false); }
    if (this.draft()) await this.probe(host);
  }
  async probe(host: string): Promise<void> {
    if (this.checking() || !this.valid()) return;
    this.checking.set(true); this.error.set('');
    try { this.probes.set(await this.settings.probe(host, {methods: this.draft()!.methods()})); }
    catch { this.error.set('Connection checks failed. Check API availability, review the selected methods and ports, then retry.'); }
    finally { this.checking.set(false); }
  }
  policy(trustSsh: boolean): DeviceCommunication {
    return {methods: this.draft()!.methods(), sshHostKeyFingerprint: trustSsh ? this.fingerprint() : undefined};
  }
}
