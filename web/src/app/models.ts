export interface Customer {
  id: string; name: string; contactName?: string; contactEmail?: string; plan?: string;
}
export interface Device {
  id: string; customerId: string; hostname: string; mgmtIp: string;
  model?: string; routerosVersion?: string; status: string; lastSeenAt?: string;
  customer?: Customer;
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
