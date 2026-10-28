import { TransportFailure } from '../transport-error';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'ssh2';
import { CommunicationMethod, CommunicationProbe } from '../communication-types';
import { RouterCredentials, RouterRecord, TransportSession, TransportStrategy, transportTimeout } from '../transport-strategy';
export function routerString(value: unknown): string {
  return '"' + [...Buffer.from(String(value))].map(byte => '\\' + byte.toString(16).padStart(2, '0')).join('') + '"';
}
const fingerprint = (key: Buffer) => 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
export class SshStrategy implements TransportStrategy {
  readonly id = 'ssh' as const;
  async probe(host: string, method: CommunicationMethod): Promise<CommunicationProbe> {
    return new Promise(resolve => {
      const client = new Client();
      let observed: string | undefined;
      const finish = () => {client.destroy(); resolve({id: this.id, port: method.port, status: observed ? 'available' : 'unavailable', message: observed ? 'SSH handshake succeeded. Review this host-key fingerprint before logging in.' : 'SSH handshake did not respond.', sshHostKeyFingerprint: observed});};
      client.on('error', finish).on('close', finish);
      client.connect({host, port: method.port, username: '', readyTimeout: Math.min(transportTimeout(), 3000),
        hostVerifier: key => {observed = fingerprint(key as Buffer); return false;}, authHandler: () => false});
    });
  }
  async connect(credentials: RouterCredentials, method: CommunicationMethod): Promise<TransportSession> {
    if (!credentials.communication?.sshHostKeyFingerprint) throw new TransportFailure('host-key');
    const client = new Client();
    let hostKeyMatches = false;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {client.destroy(); reject(new Error('SSH login timed out'));}, transportTimeout());
      client.once('ready', () => {clearTimeout(timer); resolve();}).on('error', () => {clearTimeout(timer); client.destroy(); reject(new TransportFailure(hostKeyMatches ? 'authentication' : 'host-key'));});
      client.once('close', () => {clearTimeout(timer); reject(new Error('SSH connection closed'));});
      client.connect({host: credentials.host, port: method.port, username: credentials.username, password: credentials.password, readyTimeout: transportTimeout(),
        hostVerifier: key => {hostKeyMatches = fingerprint(key as Buffer) === credentials.communication?.sshHostKeyFingerprint; return hostKeyMatches;}});
    });
    const execute = (script: string): Promise<string> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {client.destroy(); reject(new Error('SSH command timed out'));}, transportTimeout());
      const marker = `fleet_completed_${randomUUID().replaceAll("-", "")}`;
      client.exec(`:do { ${script}; :put "${marker}" } on-error={ :error "Fleet command failed" }`, (error, stream) => {
        if (error) {clearTimeout(timer); reject(new Error('SSH command failed')); return;}
        let stdout = ''; let stderr = '';
        stream.on('data', data => { stdout += data.toString(); if (Buffer.byteLength(stdout) > 1024 * 1024) {stream.close(); clearTimeout(timer); reject(new Error('Oversized SSH response'));} });
        stream.stderr.on('data', data => {stderr += data.toString(); if (stderr.length > 8192) stream.close();});
        stream.on('error', () => {clearTimeout(timer); reject(new Error('SSH command failed'));});
        stream.on('close', (code: number) => {clearTimeout(timer); if (code || stderr.trim() || !stdout.trimEnd().endsWith(marker) || /^(failure:|syntax error|bad command name|expected end of command)/im.test(stdout)) reject(new Error('RouterOS SSH command was rejected')); else resolve(stdout.trimEnd().slice(0, -marker.length).trim());});
      });
    });
    return {execute, close: () => client.destroy(), command: async (path: string, parameters: RouterRecord = {}) => {
      if (!/^\/[a-zA-Z0-9/_-]+$/.test(path) || Object.keys(parameters).some(key => !/^[a-zA-Z0-9._-]+$/.test(key))) throw new Error('Invalid RouterOS command');
      const args = Object.entries(parameters).map(([key, value]) => `${key === ".id" ? "numbers" : key}=${routerString(value)}`).join(' ');
      if (path.endsWith('/print')) {
        const output = await execute(`:put [:serialize to=json [${path} ${args} as-value]]`);
        const parsed: unknown = JSON.parse(output);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid SSH response');
        return Array.isArray(parsed) ? parsed : [parsed as RouterRecord];
      }
      const output = await execute(`:put [${path} ${args}]`);
      return output ? [{ret: output}] : [];
    }};
  }
}
