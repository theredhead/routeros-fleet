import { describeTransportFailure, TransportFailure } from './transport-error';
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { CommunicationSettingsService } from './communication-settings.service';
import { DeviceCommunication, STRATEGY_LABELS } from './communication-types';
import { RouterCredentials, RouterRecord, TRANSPORT_STRATEGIES, TransportSession, TransportStrategy } from './transport-strategy';

@Injectable()
export class CommunicationService {
  constructor(private readonly settings: CommunicationSettingsService, @Inject(TRANSPORT_STRATEGIES) private readonly strategies: TransportStrategy[]) {}
  async probe(host: string, communication?: DeviceCommunication) {
    const resolved = await this.settings.resolve(communication);
    const results = await Promise.allSettled(resolved.methods.map(method => Promise.resolve().then(() => this.strategies.find(strategy => strategy.id === method.id)!.probe(host, method))));
    return results.map((result, index) => result.status === 'fulfilled' ? result.value : {id: resolved.methods[index].id, port: resolved.methods[index].port, status: 'unavailable' as const, message: 'This protocol check could not complete. Review the method and port, then retry.'});
  }
  async select(credentials: RouterCredentials): Promise<{session: TransportSession; resource: RouterRecord; communication: DeviceCommunication}> {
    const communication = await this.settings.resolve(credentials.communication);
    const attempts: string[] = [];
    for (const method of communication.methods) {
      let session: TransportSession | undefined;
      try {
        session = await this.strategies.find(strategy => strategy.id === method.id)!.connect({...credentials, communication}, method);
        const rows = await session.command('/system/resource/print');
        const resource = rows[0];
        if (typeof resource?.version !== 'string' || !resource.version.trim()) throw new TransportFailure('protocol');
        return {session, resource, communication: {...communication, selectedStrategy: method.id}};
      } catch (error) {
        session?.close();
        attempts.push(`${STRATEGY_LABELS[method.id]} on port ${method.port}: ${describeTransportFailure(error)}`);
      }
    }
    throw new BadGatewayException({code: 'COMMUNICATION_FAILED', severity: 'error', message: 'None of the selected communication methods could log in to RouterOS.',
      details: attempts, instructions: 'Review the pre-login checks, credentials, service permissions, ports and trust settings. No configuration commands were sent.'});
  }
}
