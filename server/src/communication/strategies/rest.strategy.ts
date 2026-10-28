import axios from 'axios';
import * as https from 'node:https';
import { CommunicationMethod, CommunicationProbe, StrategyId } from '../communication-types';
import { RouterCredentials, RouterRecord, TransportSession, TransportStrategy, transportTimeout } from '../transport-strategy';
export class RestStrategy implements TransportStrategy {
  constructor(readonly id: Extract<StrategyId, 'https-rest' | 'http-rest'>) {}
  private client(host: string, method: CommunicationMethod, credentials?: RouterCredentials) {
    return axios.create({baseURL: `${this.id === 'https-rest' ? 'https' : 'http'}://${host.includes(':') ? `[${host}]` : host}:${method.port}/rest`,
      auth: credentials ? {username: credentials.username, password: credentials.password} : undefined,
      httpsAgent: new https.Agent({rejectUnauthorized: !method.acceptSelfSignedCertificates}), proxy: false, maxRedirects: 0,
      timeout: credentials ? transportTimeout() : Math.min(transportTimeout(), 3000), maxContentLength: 1024 * 1024,
    });
  }
  async probe(host: string, method: CommunicationMethod): Promise<CommunicationProbe> {
    const result: CommunicationProbe = {id: this.id, port: method.port, status: 'unavailable', message: 'REST endpoint did not respond.'};
    try {
      const response = await this.client(host, method).get('/system/resource', {validateStatus: () => true});
      const json = String(response.headers['content-type']).includes('application/json');
      const basic = /basic/i.test(String(response.headers['www-authenticate'] || ''));
      const router = response.data && (typeof response.data.version === 'string' || Array.isArray(response.data) && response.data.some(row => typeof row?.version === 'string'));
      return {...result, status: router ? 'available' : 'unconfirmed', message: router ? 'RouterOS resource endpoint responded without login.' : json && basic && response.status === 401 ? 'An authentication challenge was received; RouterOS login and permissions remain unverified.' : 'Web endpoint responded; RouterOS access is unconfirmed.'};
    } catch (error) {
      const certificate = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(error.code));
      return {...result, status: certificate ? 'certificate-untrusted' : 'unavailable', message: certificate ? 'TLS certificate was not trusted. Review the certificate setting before login.' : result.message};
    }
  }
  async connect(credentials: RouterCredentials, method: CommunicationMethod): Promise<TransportSession> {
    const client = this.client(credentials.host, method, credentials);
    const command = async (path: string, parameters: RouterRecord = {}): Promise<RouterRecord[]> => {
      const response = await client.post(path, parameters);
      if (response.data === '' || response.status === 204) return [];
      if (typeof response.data !== 'object' || response.data === null) throw new Error('Invalid REST response');
      return Array.isArray(response.data) ? response.data : [response.data];
    };
    return {command, execute: async script => {
      const rows = await command('/execute', {script, 'as-string': ''});
      if (typeof rows[0]?.ret !== 'string') throw new Error('Invalid RouterOS script response');
      return rows[0].ret.trim();
    }, close: () => { client.defaults.httpsAgent.destroy(); }};
  }
}
