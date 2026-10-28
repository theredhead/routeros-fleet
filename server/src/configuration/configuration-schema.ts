import type { DeviceConfiguration } from './device-configuration';

export interface ScalarDefinition {
  kind: 'string' | 'number' | 'boolean';
  label?: string;
  description?: string;
  options?: readonly string[];
  minLength?: number;
  min?: number;
  max?: number;
}
export interface ObjectDefinition {
  kind: 'object'; label?: string; fields: Record<string, SettingDefinition>; required?: string[];
}
export interface ArrayDefinition {
  kind: 'array'; label?: string; item: SettingDefinition;
  /** Named objects merge by these fields. Primitive lists remain atomic ordered values. */
  keyFields?: string[];
}
export interface UnionDefinition {
  kind: 'union'; label?: string; discriminator: string; variants: Record<string, ObjectDefinition>;
}
export type SettingDefinition = ScalarDefinition | ObjectDefinition | ArrayDefinition | UnionDefinition;
const text = (description?: string, allowEmpty = false): ScalarDefinition => ({ kind: 'string', minLength: allowEmpty ? 0 : 1, ...(description ? { description } : {}) });
const secret = (): ScalarDefinition => text('Secure-storage reference only. Do not enter a password or private key.');
const bool = (): ScalarDefinition => ({ kind: 'boolean' });
const number = (min = 0, max?: number): ScalarDefinition => ({ kind: 'number', min, ...(max !== undefined ? { max } : {}) });
const choice = (...options: string[]): ScalarDefinition => ({ kind: 'string', options });
const object = (fields: Record<string, SettingDefinition>, required: string[] = []): ObjectDefinition => ({ kind: 'object', fields, required });
const array = (item: SettingDefinition, ...keyFields: string[]): ArrayDefinition => ({ kind: 'array', item, ...(keyFields.length ? { keyFields } : {}) });
const strings = () => array(text());
const union = (discriminator: string, variants: Record<string, ObjectDefinition>): UnionDefinition => ({ kind: 'union', discriminator, variants });
const port = () => number(1, 65535);
const vlan = () => number(1, 4094);
const named = (fields: Record<string, SettingDefinition>, required: string[] = []) =>
  array(object({ name: text(), ...fields }, ['name', ...required]), 'name');
const match = () => object({
  protocol: text(), sourceAddress: text(), destinationAddress: text(), sourcePorts: text(), destinationPorts: text(),
  sourceAddressList: text(), destinationAddressList: text(), inInterface: text(), outInterface: text(),
  inInterfaceList: text(), outInterfaceList: text(), connectionStates: strings(),
});
const ordered = (fields: Record<string, SettingDefinition>, required: string[]) => array(object({
  key: text('Stable rule identifier within this configuration.'), order: number(), enabled: bool(), comment: text(undefined, true), ...fields,
}, ['key', 'order', ...required]), 'key');
const filterAction = union('type', {
  accept: object({}), drop: object({}), 'fasttrack-connection': object({}),
  reject: object({ rejectWith: text() }), jump: object({ targetChain: text() }, ['targetChain']), log: object({ prefix: text(undefined, true) }),
});
const natAction = union('type', {
  accept: object({}), masquerade: object({}), 'src-nat': object({ toAddresses: text(), toPorts: text() }),
  'dst-nat': object({ toAddresses: text(), toPorts: text() }), redirect: object({ toPorts: text() }),
});

export interface ConfigurationSection {
  key: keyof DeviceConfiguration;
  sectionTitle: string;
  sectionContentSummary: string;
  definition: ObjectDefinition;
}

/** Single runtime schema shared by server validation, combination, and the Lucid Forms editor. */
export const CONFIGURATION_SECTIONS: readonly ConfigurationSection[] = [
  { key: 'identity', sectionTitle: 'Identity', sectionContentSummary: 'Device name, location/contact information, timezone, NTP', definition: object({
    hostname: text(), location: object({ description: text(undefined, true), contactName: text(undefined, true), contactEmail: text(undefined, true) }),
    time: object({ timezone: text(), automaticTimezone: bool(), ntp: object({ enabled: bool(), servers: strings() }) }),
  }) },
  { key: 'interfaces', sectionTitle: 'Ethernet and interfaces', sectionContentSummary: 'Enable/disable ports, interface names, MTU, link settings', definition: object({
    ethernet: named({ enabled: bool(), comment: text(undefined, true), mtu: number(68, 65535), autoNegotiation: bool(), advertisedLinkModes: strings(), poe: object({ mode: choice('off', 'auto', 'forced-on'), priority: number(1, 99) }) }),
  }) },
  { key: 'lan', sectionTitle: 'LAN and VLANs', sectionContentSummary: 'Bridges, VLAN membership, tagging, interface lists', definition: object({
    bridges: named({ enabled: bool(), vlanFiltering: bool(), protocol: choice('none', 'stp', 'rstp', 'mstp'), mtu: number(68, 65535),
      ports: array(object({ interfaceName: text(), enabled: bool(), pvid: vlan(), ingressFiltering: bool(), frameTypes: choice('all', 'tagged-only', 'untagged-only') }, ['interfaceName']), 'interfaceName'),
      vlans: array(object({ vlanIds: array(vlan()), taggedInterfaces: strings(), untaggedInterfaces: strings() }, ['vlanIds']), 'vlanIds'),
    }),
    vlanInterfaces: named({ parentInterface: text(), vlanId: vlan(), enabled: bool(), mtu: number(68, 65535) }, ['parentInterface', 'vlanId']),
    interfaceLists: named({ members: strings() }, ['members']),
  }) },
  { key: 'networking', sectionTitle: 'IP networking', sectionContentSummary: 'IPv4/IPv6 addresses, DNS, gateways, routes', definition: object({
    addresses: array(object({ address: text(), interfaceName: text(), enabled: bool(), comment: text(undefined, true) }, ['address', 'interfaceName']), 'address', 'interfaceName'),
    dns: object({ servers: strings(), allowRemoteRequests: bool(), cacheSizeKiB: number(), staticRecords: named({ address: text(), ttl: text() }, ['address']) }),
    routes: array(object({ destination: text(), gateway: text(), routingTable: text(), distance: number(1, 255), enabled: bool(), comment: text(undefined, true) }, ['destination', 'gateway']), 'destination', 'routingTable'),
    dhcpClients: array(object({ interfaceName: text(), enabled: bool(), usePeerDns: bool(), usePeerNtp: bool(), addDefaultRoute: bool(), defaultRouteDistance: number(1, 255) }, ['interfaceName']), 'interfaceName'),
    ipv6: object({ enabled: bool(), forward: bool(), acceptRouterAdvertisements: bool() }),
  }) },
  { key: 'dhcp', sectionTitle: 'DHCP', sectionContentSummary: 'Servers, address pools, lease times, reservations, client options', definition: object({
    pools: named({ ranges: array(object({ start: text(), end: text() }, ['start', 'end']), 'start', 'end') }, ['ranges']),
    servers: named({ interfaceName: text(), addressPool: text(), enabled: bool(), leaseTime: text(), authoritative: bool() }, ['interfaceName', 'addressPool']),
    networks: array(object({ subnet: text(), gateway: text(), dnsServers: strings(), ntpServers: strings(), domain: text(), optionNames: strings() }, ['subnet']), 'subnet'),
    reservations: named({ address: text(), macAddress: text(), clientId: text(), serverName: text(), comment: text(undefined, true) }, ['address']),
    options: named({ code: number(1, 254), value: text() }, ['code', 'value']),
  }) },
  { key: 'firewall', sectionTitle: 'Firewall', sectionContentSummary: 'Filtering, NAT, port forwarding, address lists', definition: object({
    filterRules: ordered({ chain: text(), match: match(), action: filterAction }, ['chain', 'match', 'action']),
    natRules: ordered({ chain: text(), match: match(), action: natAction }, ['chain', 'match', 'action']),
    addressLists: named({ entries: array(object({ address: text(), timeout: text(), comment: text(undefined, true) }, ['address']), 'address') }, ['entries']),
  }) },
  { key: 'vpn', sectionTitle: 'VPN', sectionContentSummary: 'WireGuard, IPsec and other supported tunnels', definition: object({
    wireguard: named({ enabled: bool(), listenPort: port(), mtu: number(68, 65535), privateKey: secret(),
      peers: named({ publicKey: text(), presharedKey: secret(), allowedAddresses: strings(), endpoint: object({ host: text(), port: port() }, ['host', 'port']), persistentKeepaliveSeconds: number(0, 65535) }, ['publicKey', 'allowedAddresses']),
    }, ['privateKey']),
    ipsec: object({
      peers: named({ remoteAddress: text(), localAddress: text(), exchangeMode: choice('ike1', 'ike2'), authentication: union('type', { 'pre-shared-key': object({ secret: secret() }, ['secret']), certificate: object({ certificateName: text() }, ['certificateName']) }) }, ['remoteAddress', 'authentication']),
      policies: named({ peerName: text(), sourceSubnet: text(), destinationSubnet: text(), tunnel: bool(), proposalName: text() }, ['peerName', 'sourceSubnet', 'destinationSubnet']),
      proposals: named({ encryptionAlgorithms: strings(), authenticationAlgorithms: strings(), pfsGroup: text(), lifetime: text() }),
    }),
  }) },
  { key: 'wifi', sectionTitle: 'Wi-Fi', sectionContentSummary: 'SSIDs, security, channels, transmit power, guest networks—on compatible hardware', definition: object({
    radios: array(object({ interfaceName: text(), enabled: bool(), mode: choice('access-point', 'station'), ssid: text(), country: text(),
      channel: object({ band: text(), frequenciesMHz: array(number(1, 100000)), width: text(), transmitPowerDbm: number(-30, 60) }),
      security: union('mode', { open: object({}), 'wpa2-personal': object({ passphrase: secret() }, ['passphrase']), 'wpa3-personal': object({ passphrase: secret() }, ['passphrase']), 'wpa2-wpa3-personal': object({ passphrase: secret() }, ['passphrase']), enterprise: object({ radiusServerNames: strings() }, ['radiusServerNames']) }),
      network: object({ bridgeName: text(), vlanId: vlan(), clientIsolation: bool() }),
    }, ['interfaceName']), 'interfaceName'),
  }) },
  { key: 'traffic', sectionTitle: 'Traffic management', sectionContentSummary: 'Bandwidth limits, queues, prioritisation', definition: object({
    simpleQueues: named({ targets: strings(), enabled: bool(), uploadLimitBps: number(), downloadLimitBps: number(), guaranteedUploadBps: number(), guaranteedDownloadBps: number(), priority: number(1, 8), parent: text() }, ['targets']),
    queueTrees: named({ parent: text(), packetMark: text(), maxLimitBps: number(), guaranteedRateBps: number(), priority: number(1, 8), queueType: text() }, ['parent', 'packetMark']),
    markingRules: ordered({ chain: text(), match: match(), markType: choice('packet', 'connection', 'routing'), markName: text(), passthrough: bool() }, ['chain', 'match', 'markType', 'markName']),
  }) },
  { key: 'management', sectionTitle: 'Management access', sectionContentSummary: 'Users, permissions, SSH/API/WebFig services, certificates', definition: object({
    users: array(object({ username: text(), groupName: text(), enabled: bool(), allowedAddresses: strings(), password: secret(), sshPublicKeys: strings() }, ['username', 'groupName']), 'username'),
    groups: named({ policies: strings() }, ['policies']),
    services: named({ enabled: bool(), port: port(), allowedAddresses: strings(), certificateName: text() }),
    certificates: named({ certificate: secret(), privateKey: secret(), trusted: bool() }, ['certificate']),
    neighborDiscovery: object({ interfaceList: text() }, ['interfaceList']), macAccess: object({ winboxInterfaceList: text(), telnetInterfaceList: text() }),
  }) },
  { key: 'monitoring', sectionTitle: 'Monitoring', sectionContentSummary: 'Logging, remote syslog, SNMP, traffic and health statistics', definition: object({
    logging: object({
      actions: named({ target: choice('memory', 'disk', 'remote'), remoteHost: text(), remotePort: port(), fileName: text(), retainedFiles: number() }, ['target']),
      rules: array(object({ topics: strings(), actionName: text(), prefix: text(undefined, true), enabled: bool() }, ['topics', 'actionName']), 'topics', 'actionName'),
    }),
    snmp: object({ enabled: bool(), contact: text(undefined, true), location: text(undefined, true), communities: named({ allowedAddresses: strings(), security: choice('none', 'authenticated', 'private'), authenticationSecret: secret(), encryptionSecret: secret() }) }),
    trafficFlow: object({ enabled: bool(), interfaces: strings(), collectors: array(object({ address: text(), port: port(), version: choice('5', '9', 'ipfix') }, ['address', 'port', 'version']), 'address', 'port') }),
    watchdog: object({ enabled: bool(), watchAddress: text(), pingTimeout: text() }),
  }) },
];

// A profile is a partial desired-state contribution, not a deployable-device validation.
// Only collection identity fields are mandatory. Other item fields can come from another profile.
function configurePartialSchema(definition: SettingDefinition): void {
  if (definition.kind === 'object') {
    definition.required = [];
    Object.values(definition.fields).forEach(configurePartialSchema);
  } else if (definition.kind === 'array') {
    const originalRequired = definition.item.kind === 'object' ? definition.item.required || [] : [];
    configurePartialSchema(definition.item);
    if (definition.item.kind === 'object') definition.item.required = (definition.keyFields || []).filter(key => originalRequired.includes(key));
  } else if (definition.kind === 'union') Object.values(definition.variants).forEach(configurePartialSchema);
}
CONFIGURATION_SECTIONS.forEach(section => configurePartialSchema(section.definition));

// Service names are a finite set even though other named collections accept any name.
const management = CONFIGURATION_SECTIONS.find(section => section.key === 'management')!;
((management.definition.fields['services'] as ArrayDefinition).item as ObjectDefinition).fields['name'] = choice('ssh', 'winbox', 'www', 'www-ssl', 'api', 'api-ssl', 'ftp', 'telnet');

export function settingLabel(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase()).replace(/\bDns\b/g, 'DNS').replace(/\bNtp\b/g, 'NTP').replace(/\bSsid\b/g, 'SSID').replace(/\bMtu\b/g, 'MTU').replace(/\bPoe\b/g, 'PoE').replace(/\bIpsec\b/g, 'IPsec').replace(/Ki B/g, 'KiB').replace(/\bBps\b/g, 'bps');
}
export function emptyConfiguration(): DeviceConfiguration {
  return Object.fromEntries(CONFIGURATION_SECTIONS.map(section => [section.key, {
    sectionTitle: section.sectionTitle, sectionContentSummary: section.sectionContentSummary, settings: {},
  }])) as unknown as DeviceConfiguration;
}
export function defaultSetting(definition: SettingDefinition): unknown {
  if (definition.kind === 'boolean') return false;
  if (definition.kind === 'number') return definition.min ?? 0;
  if (definition.kind === 'string') return definition.options?.[0] ?? '';
  if (definition.kind === 'array') return [];
  if (definition.kind === 'union') {
    const variant = Object.keys(definition.variants)[0];
    return { [definition.discriminator]: variant, ...defaultSetting(definition.variants[variant]) as object };
  }
  if (definition.kind === 'object') return Object.fromEntries((definition.required || []).map(key => [key, defaultSetting(definition.fields[key])]));
  throw new Error('Unsupported setting definition.');
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function itemIdentity(value: unknown, fields: string[]): string {
  const record = value as Record<string, unknown>;
  return fields.map(field => `${field}=${JSON.stringify(Array.isArray(record[field]) ? [...record[field] as unknown[]].sort() : record[field] ?? (field === 'routingTable' ? 'main' : ''))}`).join(', ');
}

export interface ConfigurationIssue { path: string; message: string }
export function validateConfiguration(value: unknown): ConfigurationIssue[] {
  const issues: ConfigurationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  const visit = (definition: SettingDefinition, item: unknown, path: string): void => {
    if (definition.kind === 'union') {
      if (!isRecord(item) || typeof item[definition.discriminator] !== 'string' || !Object.hasOwn(definition.variants, String(item[definition.discriminator]))) { fail(path, 'Choose a valid variant.'); return; }
      const { [definition.discriminator]: tag, ...fields } = item;
      visit(definition.variants[String(tag)], fields, path); return;
    }
    if (definition.kind === 'object') {
      if (!isRecord(item)) { fail(path, 'Expected an object.'); return; }
      for (const key of Object.keys(item)) {
        if (!Object.hasOwn(definition.fields, key)) fail(`${path}.${key}`, 'Unknown setting.');
        else visit(definition.fields[key], item[key], `${path}.${key}`);
      }
      for (const key of definition.required || []) {
        if (!Object.hasOwn(item, key)) fail(`${path}.${key}`, 'Required when this item is configured.');
      }
      return;
    }
    if (definition.kind === 'array') {
      if (!Array.isArray(item)) { fail(path, 'Expected a list.'); return; }
      const seen = new Set<string>();
      item.forEach((entry, index) => {
        visit(definition.item, entry, `${path}[${index + 1}]`);
        if (definition.keyFields && isRecord(entry)) {
          const identity = itemIdentity(entry, definition.keyFields);
          if (seen.has(identity)) fail(`${path}[${index + 1}]`, 'Duplicate entry identity.');
          seen.add(identity);
          for (const field of definition.keyFields) if (Array.isArray(entry[field]) && !(entry[field] as unknown[]).length) fail(`${path}[${index + 1}].${field}`, 'Identity list cannot be empty.');
        }
      }); return;
    }
    if (typeof item !== definition.kind) { fail(path, `Expected ${definition.kind}.`); return; }
    if (definition.kind === 'number' && (!Number.isFinite(item) || !Number.isInteger(item) || definition.min !== undefined && Number(item) < definition.min || definition.max !== undefined && Number(item) > definition.max)) fail(path, `Enter an integer${definition.min !== undefined ? ` ≥ ${definition.min}` : ''}${definition.max !== undefined ? ` and ≤ ${definition.max}` : ''}.`);
    if (definition.kind === 'string' && definition.minLength && typeof item === 'string' && item.trim().length < definition.minLength) fail(path, 'Enter a value or leave this setting unmanaged.');
    if (definition.options && !definition.options.includes(String(item))) fail(path, 'Choose a valid option.');
  };
  if (!isRecord(value)) return [{ path: 'configuration', message: 'Expected a configuration object.' }];
  for (const key of Object.keys(value)) if (!CONFIGURATION_SECTIONS.some(section => section.key === key)) fail(key, 'Unknown configuration section.');
  for (const section of CONFIGURATION_SECTIONS) {
    const group = value[section.key];
    if (group === undefined) continue;
    if (!isRecord(group) || !isRecord(group['settings'])) { fail(section.key, 'Expected a group with a settings object.'); continue; }
    for (const key of Object.keys(group)) if (!['sectionTitle', 'sectionContentSummary', 'settings'].includes(key)) fail(`${section.key}.${key}`, 'Unknown group property.');
    visit(section.definition, group['settings'], section.key);
  }
  return issues;
}
export function normalizeConfiguration(value: unknown): DeviceConfiguration {
  const issues = validateConfiguration(value);
  if (issues.length) throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  const configuration = emptyConfiguration();
  for (const section of CONFIGURATION_SECTIONS) {
    const group = (value as Record<string, { settings: unknown }>)[section.key];
    if (group) (configuration[section.key] as { settings: unknown }).settings = structuredClone(group.settings);
  }
  return configuration;
}
