export const STRATEGY_IDS = ['https-rest', 'ssh', 'api-tls', 'http-rest', 'api'] as const;
export type StrategyId = typeof STRATEGY_IDS[number];
export interface CommunicationMethod { id: StrategyId; enabled: boolean; port: number; acceptSelfSignedCertificates: boolean; }
export interface CommunicationSettings { methods: CommunicationMethod[]; revision: number; }
export interface DeviceCommunication { methods: CommunicationMethod[]; selectedStrategy?: StrategyId; sshHostKeyFingerprint?: string; }
export interface CommunicationProbe { id: StrategyId; port: number; status: 'available' | 'unavailable' | 'certificate-untrusted' | 'unconfirmed'; message: string; sshHostKeyFingerprint?: string; }
export const STRATEGY_LABELS: Record<StrategyId, string> = {'https-rest': 'HTTPS REST', ssh: 'SSH', 'api-tls': 'Native API over TLS', 'http-rest': 'HTTP REST', api: 'Native API'};
export const DEFAULT_METHODS: CommunicationMethod[] = STRATEGY_IDS.map((id, index) => ({id, enabled: index < 3, port: [443, 22, 8729, 80, 8728][index], acceptSelfSignedCertificates: false}));
