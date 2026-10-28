import type { DeviceCommunication } from './core/communication.models';
export interface Customer {
  id: string; name: string; contactName?: string; contactEmail?: string; plan?: string;
}
export interface Device {
  id: string; customerId?: string; macAddress?: string; hostname: string; mgmtIp: string;
  model?: string; routerosVersion?: string; status: string; lastSeenAt?: string;
  customer?: Customer;
  communication?: DeviceCommunication;
  initialBackup?: {capturedAt: string; size: number; sha256: string; format: 'routeros-backup'};
}
export interface ConfigProfile {
  id: string; deviceId: string; dhcpEnabled: boolean;
  dhcpInterface?: string; subnetCidr?: string; gatewayIp?: string; dnsServer?: string;
  poolName?: string; poolStart?: string; poolEnd?: string; prune: boolean;
}
export interface Job {
  id: string; deviceId: string; type: string; status: string; step?: string;
  dryRun: boolean; plan?: any; result?: any; error?: string;
  createdAt: string; startedAt?: string; finishedAt?: string;
}

export interface DiscoveredDevice {
  ip: string;
  mac?: string;
  hostname?: string;
  model?: string;
  routerosVersion?: string;
  isRouterOs: boolean;
}

export interface DevelopmentDiagnostics {
  checkedAt: string;
  environment: string;
  resetEnabled: boolean;
  runtime: { node: string; platform: string; uptimeSeconds: number };
  database: { name: string; host: string; port: number; schema: string; synchronize: boolean };
  credentialsConfigured: boolean;
  inventory: { label: string; count: number }[];
  activeJobs: number;
  interfaces: { name: string; address: string; subnet: string; mac: string }[];
}
export interface DatabaseResetResult {
  resetAt: string;
  removed: { label: string; count: number }[];
}

export interface ActionableIssue {
  code: string; message: string; instructions: string; details?: string[]; severity: 'error' | 'warning';
}

export interface ServerHealth {
  status: string;
  database: string;
  uptime: number;
  checkedAt: string;
}

export interface DeviceDetailsSnapshot {
  checkedAt: string; device: Device;
  jobs: {records: Job[]; total: number; limit: number};
  audit: {records: unknown[]; total: number; limit: number};
}
