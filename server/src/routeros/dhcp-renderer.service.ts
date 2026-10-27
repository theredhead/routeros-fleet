import { Injectable } from '@nestjs/common';
import { ConfigProfile } from '../entities/config-profile.entity';
import { DesiredItem } from './reconcile.service';
import { Creds, RouterOsClientService } from './router-os-client.service';

export interface DhcpDesired {
  menus: {
    pool: DesiredItem[];
    dhcpServer: DesiredItem[];
    network: DesiredItem[];
  };
}

/**
 * Maps the declarative DHCP desired-state onto the three RouterOS records that make a
 * server work. We drive these explicitly (not the interactive /ip/dhcp-server/setup) so
 * every call is idempotent and individually convergent.
 */
@Injectable()
export class DhcpRendererService {
  constructor(private client: RouterOsClientService) {}

  render(p: ConfigProfile): DhcpDesired {
    const poolName = p.poolName || 'dhcp_pool';
    const ranges = `${p.poolStart}-${p.poolEnd}`;
    return {
      menus: {
        // /ip/pool — the address pool (keyed by name)
        pool: [{ key: poolName, props: { name: poolName, ranges } }],
        // /ip/dhcp-server — ties interface -> pool (keyed by interface)
        dhcpServer: [
          { key: p.dhcpInterface, props: { interface: p.dhcpInterface, 'address-pool': poolName } },
        ],
        // /ip/dhcp-server/network — what clients receive (keyed by subnet address)
        network: [
          {
            key: p.subnetCidr,
            props: { address: p.subnetCidr, gateway: p.gatewayIp, 'dns-server': p.dnsServer },
          },
        ],
      },
    };
  }

  /** Best-effort read of the current DHCP setup, to prefill the editor. */
  async readCurrent(creds: Creds): Promise<any> {
    const [pools, servers, networks] = await Promise.all([
      this.client.list(creds, 'ip/pool'),
      this.client.list(creds, 'ip/dhcp-server'),
      this.client.list(creds, 'ip/dhcp-server/network'),
    ]);
    const server = servers[0];
    if (!server) {
      return { raw: { pools, servers, networks }, summary: null };
    }
    const poolName = server['address-pool'];
    const pool = pools.find((p) => p.name === poolName);
    const net = networks[0];
    return {
      raw: { pools, servers, networks },
      summary: {
        dhcpInterface: server.interface ?? null,
        addressPool: poolName ?? null,
        ranges: pool?.ranges ?? null,
        subnetCidr: net?.address ?? null,
        gatewayIp: net?.gateway ?? null,
        dnsServer: net?.['dns-server'] ?? null,
      },
    };
  }
}
