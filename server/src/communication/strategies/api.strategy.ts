import { TransportFailure } from '../transport-error';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { CommunicationMethod, CommunicationProbe, StrategyId } from '../communication-types';
import { RouterCredentials, TransportStrategy, transportTimeout } from '../transport-strategy';
import { ApiSession } from './api-session';
export class ApiStrategy implements TransportStrategy {
  constructor(readonly id: Extract<StrategyId, 'api-tls' | 'api'>) {}
  private async open(host: string, method: CommunicationMethod, timeout: number): Promise<ApiSession> {
    return new Promise((resolve, reject) => {
      const secure = this.id === 'api-tls';
      const socket = secure ? tls.connect({host, port: method.port, rejectUnauthorized: !method.acceptSelfSignedCertificates, servername: net.isIP(host) ? undefined : host}) : net.connect({host, port: method.port});
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('Native API connection timed out')); }, timeout);
      socket.once('error', error => {clearTimeout(timer); reject(error);});
      socket.once(secure ? 'secureConnect' : 'connect', () => {clearTimeout(timer); resolve(new ApiSession(socket, timeout));});
    });
  }
  async probe(host: string, method: CommunicationMethod): Promise<CommunicationProbe> {
    let session: ApiSession | undefined;
    try {
      session = await this.open(host, method, Math.min(transportTimeout(), 3000));
      const challenge = await session.command('/login');
      return {id: this.id, port: method.port, status: challenge.some(row => typeof row.ret === 'string') ? 'available' : 'unconfirmed', message: 'Native API protocol responded without credentials. Login and backup access remain unverified.'};
    } catch (error) {
      const certificate = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(error.code));
      return {id: this.id, port: method.port, status: certificate ? 'certificate-untrusted' : 'unavailable', message: certificate ? 'TLS certificate was not trusted.' : 'Native API protocol did not respond.'};
    } finally { session?.close(); }
  }
  async connect(credentials: RouterCredentials, method: CommunicationMethod): Promise<ApiSession> {
    const session = await this.open(credentials.host, method, transportTimeout());
    try { await session.command('/login', {name: credentials.username, password: credentials.password}); return session; }
    catch { session.close(); throw new TransportFailure('authentication'); }
  }
}
