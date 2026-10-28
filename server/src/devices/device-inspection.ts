import { CommunicationService } from '../communication/communication.service';
import { RouterCredentials } from '../communication/transport-strategy';

export const INSPECTION_MENUS = [
  'system/identity', 'system/resource', 'system/routerboard', 'system/license', 'system/package', 'system/clock', 'system/health',
  'interface', 'interface/ethernet', 'interface/bridge', 'interface/bridge/port', 'interface/bridge/vlan', 'interface/vlan',
  'interface/bonding', 'interface/list', 'interface/list/member', 'interface/wireless', 'interface/wifi', 'interface/wireguard', 'interface/wireguard/peers',
  'ip/address', 'ipv6/address', 'ip/neighbor', 'ip/arp', 'ip/route', 'ipv6/route', 'routing/table',
  'ip/dns', 'ip/dns/static', 'ip/pool', 'ip/dhcp-server', 'ip/dhcp-server/network', 'ip/dhcp-server/lease', 'ip/dhcp-client',
  'ip/firewall/filter', 'ip/firewall/nat', 'ip/firewall/mangle', 'ip/firewall/raw', 'ip/firewall/address-list',
  'ipv6/firewall/filter', 'ipv6/firewall/address-list', 'ip/service', 'ip/settings', 'ipv6/settings', 'system/ntp/client', 'queue/simple', 'queue/tree',
] as const;

/** Router output and historical records may contain sensitive properties. Never expose those in diagnostics. */
export function redactDeviceData(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redactDeviceData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    /encrypted|password|passphrase|secret|privatekey|presharedkey|token|community|^source$|^onevent$/i.test(key.replace(/[^a-z]/gi, '')) ? '[redacted]' : redactDeviceData(child),
  ]));
}
export async function inspectRouter(communication: CommunicationService, credentials: RouterCredentials) {
  const selected = await communication.select(credentials);
  const deadline = Date.now() + 20000;
  const menus: Record<string, unknown> = {};
  let bytes = 0;
  try {
    for (const menu of INSPECTION_MENUS) {
      if (Date.now() >= deadline || bytes > 8 * 1024 * 1024) { menus[menu] = {status: 'skipped', message: 'Snapshot time or size limit reached.'}; continue; }
      try {
        const data = redactDeviceData(await selected.session.command(`/${menu}/print`));
        bytes += Buffer.byteLength(JSON.stringify(data));
        menus[menu] = bytes <= 8 * 1024 * 1024 ? {status: 'available', data} : {status: 'skipped', message: 'Snapshot size limit reached.'};
      } catch { menus[menu] = {status: 'unavailable', message: 'This menu is unsupported, not permitted, or the router connection failed.'}; }
    }
    return {strategy: selected.communication.selectedStrategy, resource: redactDeviceData(selected.resource), menus};
  } finally { selected.session.close(); }
}
