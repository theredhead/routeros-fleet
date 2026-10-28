import { CommunicationMethod, CommunicationProbe, DeviceCommunication, StrategyId } from './communication-types';
export interface RouterCredentials { host: string; username: string; password: string; communication?: DeviceCommunication; }
export type RouterRecord = Record<string, unknown>;
export interface TransportSession {
  command(path: string, parameters?: RouterRecord): Promise<RouterRecord[]>;
  execute(script: string): Promise<string>;
  close(): void;
}
export interface TransportStrategy {
  readonly id: StrategyId;
  probe(host: string, method: CommunicationMethod): Promise<CommunicationProbe>;
  connect(credentials: RouterCredentials, method: CommunicationMethod): Promise<TransportSession>;
}
export const TRANSPORT_STRATEGIES = Symbol('TRANSPORT_STRATEGIES');
export function transportTimeout(): number {
  const timeout = Number(process.env.ROUTEROS_TIMEOUT_MS || 15000);
  return Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 2147483647 ? timeout : 15000;
}
