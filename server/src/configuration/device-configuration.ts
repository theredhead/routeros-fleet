/** Application desired state, independent of RouterOS transport and record IDs.
 * Omitted properties are unmanaged. An explicit empty collection clears that collection.
 * Secrets are references to secure storage, never plaintext configuration values.
 */
export type IPAddress = string;
export type CIDR = string;
export type MACAddress = string;
export type Duration = string;
export type SecretReference = string;
/** Profiles may configure individual fields inside collection entries as well as objects.
 * Collection identity requirements are enforced by the shared runtime schema.
 */
export type PartialConfiguration<T> = T extends (infer Item)[] ? PartialConfiguration<Item>[] : T extends object ? {
  [Key in keyof T]?: PartialConfiguration<T[Key]>;
} : T;
export interface DeviceConfigurationGroup<TTitle extends string, TSettings> {
  sectionTitle: TTitle;
  sectionContentSummary: string;
  settings: PartialConfiguration<TSettings>;
}

export interface DeviceConfiguration {
  identity: DeviceConfigurationGroup<'Identity', IdentitySettings>;
  interfaces: DeviceConfigurationGroup<'Ethernet and interfaces', InterfaceSettings>;
  lan: DeviceConfigurationGroup<'LAN and VLANs', LanSettings>;
  networking: DeviceConfigurationGroup<'IP networking', NetworkingSettings>;
  dhcp: DeviceConfigurationGroup<'DHCP', DhcpSettings>;
  firewall: DeviceConfigurationGroup<'Firewall', FirewallSettings>;
  vpn: DeviceConfigurationGroup<'VPN', VpnSettings>;
  wifi: DeviceConfigurationGroup<'Wi-Fi', WifiSettings>;
  traffic: DeviceConfigurationGroup<'Traffic management', TrafficSettings>;
  management: DeviceConfigurationGroup<'Management access', ManagementSettings>;
  monitoring: DeviceConfigurationGroup<'Monitoring', MonitoringSettings>;
}

export interface IdentitySettings {
  hostname?: string;
  location?: {
    description?: string;
    contactName?: string;
    contactEmail?: string;
  };
  time?: {
    timezone?: string;
    automaticTimezone?: boolean;
    ntp?: {
      enabled?: boolean;
      servers?: string[];
    };
  };
}

export interface InterfaceSettings {
  ethernet?: {
    name: string;
    enabled?: boolean;
    comment?: string;
    mtu?: number;
    autoNegotiation?: boolean;
    advertisedLinkModes?: string[];
    poe?: {
      mode?: 'off' | 'auto' | 'forced-on';
      priority?: number;
    };
  }[];
}

export interface LanSettings {
  bridges?: {
    name: string;
    enabled?: boolean;
    vlanFiltering?: boolean;
    protocol?: 'none' | 'stp' | 'rstp' | 'mstp';
    mtu?: number;
    ports?: {
      interfaceName: string;
      enabled?: boolean;
      pvid?: number;
      ingressFiltering?: boolean;
      frameTypes?: 'all' | 'tagged-only' | 'untagged-only';
    }[];
    vlans?: {
      vlanIds: number[];
      taggedInterfaces?: string[];
      untaggedInterfaces?: string[];
    }[];
  }[];
  vlanInterfaces?: {
    name: string;
    parentInterface: string;
    vlanId: number;
    enabled?: boolean;
    mtu?: number;
  }[];
  interfaceLists?: {
    name: string;
    members: string[];
  }[];
}

export interface NetworkingSettings {
  addresses?: {
    address: CIDR;
    interfaceName: string;
    enabled?: boolean;
    comment?: string;
  }[];
  dns?: {
    servers?: IPAddress[];
    allowRemoteRequests?: boolean;
    cacheSizeKiB?: number;
    staticRecords?: {
      name: string;
      address: IPAddress;
      ttl?: Duration;
    }[];
  };
  routes?: {
    destination: CIDR;
    gateway: string;
    routingTable?: string;
    distance?: number;
    enabled?: boolean;
    comment?: string;
  }[];
  dhcpClients?: {
    interfaceName: string;
    enabled?: boolean;
    usePeerDns?: boolean;
    usePeerNtp?: boolean;
    addDefaultRoute?: boolean;
    defaultRouteDistance?: number;
  }[];
  ipv6?: {
    enabled?: boolean;
    forward?: boolean;
    acceptRouterAdvertisements?: boolean;
  };
}

export interface DhcpSettings {
  pools?: {
    name: string;
    ranges: {
      start: IPAddress;
      end: IPAddress;
    }[];
  }[];
  servers?: {
    name: string;
    interfaceName: string;
    addressPool: string;
    enabled?: boolean;
    leaseTime?: Duration;
    authoritative?: boolean;
  }[];
  networks?: {
    subnet: CIDR;
    gateway?: IPAddress;
    dnsServers?: IPAddress[];
    ntpServers?: IPAddress[];
    domain?: string;
    optionNames?: string[];
  }[];
  reservations?: {
    name: string;
    address: IPAddress;
    macAddress?: MACAddress;
    clientId?: string;
    serverName?: string;
    comment?: string;
  }[];
  options?: {
    name: string;
    code: number;
    value: string;
  }[];
}

export interface TrafficMatch {
  protocol?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  sourcePorts?: string;
  destinationPorts?: string;
  sourceAddressList?: string;
  destinationAddressList?: string;
  inInterface?: string;
  outInterface?: string;
  inInterfaceList?: string;
  outInterfaceList?: string;
  connectionStates?: string[];
}

export interface OrderedRule {
  key: string;
  order: number;
  enabled?: boolean;
  comment?: string;
}

export interface FirewallSettings {
  filterRules?: (OrderedRule & {
    chain: string;
    match: TrafficMatch;
    action: {
      type: 'accept' | 'drop' | 'fasttrack-connection';
    } | {
      type: 'reject';
      rejectWith?: string;
    } | {
      type: 'jump';
      targetChain: string;
    } | {
      type: 'log';
      prefix?: string;
    };
  })[];
  natRules?: (OrderedRule & {
    chain: string;
    match: TrafficMatch;
    action: {
      type: 'accept' | 'masquerade';
    } | {
      type: 'src-nat' | 'dst-nat';
      toAddresses?: string;
      toPorts?: string;
    } | {
      type: 'redirect';
      toPorts?: string;
    };
  })[];
  addressLists?: {
    name: string;
    entries: {
      address: string;
      timeout?: Duration;
      comment?: string;
    }[];
  }[];
}

export interface TrafficSettings {
  simpleQueues?: {
    name: string;
    targets: string[];
    enabled?: boolean;
    uploadLimitBps?: number;
    downloadLimitBps?: number;
    guaranteedUploadBps?: number;
    guaranteedDownloadBps?: number;
    priority?: number;
    parent?: string;
  }[];
  queueTrees?: {
    name: string;
    parent: string;
    packetMark: string;
    maxLimitBps?: number;
    guaranteedRateBps?: number;
    priority?: number;
    queueType?: string;
  }[];
  markingRules?: (OrderedRule & {
    chain: string;
    match: TrafficMatch;
    markType: 'packet' | 'connection' | 'routing';
    markName: string;
    passthrough?: boolean;
  })[];
}

export interface VpnSettings {
  wireguard?: {
    name: string;
    enabled?: boolean;
    listenPort?: number;
    mtu?: number;
    privateKey: SecretReference;
    peers?: {
      name: string;
      publicKey: string;
      presharedKey?: SecretReference;
      allowedAddresses: CIDR[];
      endpoint?: {
        host: string;
        port: number;
      };
      persistentKeepaliveSeconds?: number;
    }[];
  }[];
  ipsec?: {
    peers?: {
      name: string;
      remoteAddress: string;
      localAddress?: IPAddress;
      exchangeMode?: 'ike1' | 'ike2';
      authentication: {
        type: 'pre-shared-key';
        secret: SecretReference;
      } | {
        type: 'certificate';
        certificateName: string;
      };
    }[];
    policies?: {
      name: string;
      peerName: string;
      sourceSubnet: CIDR;
      destinationSubnet: CIDR;
      tunnel?: boolean;
      proposalName?: string;
    }[];
    proposals?: {
      name: string;
      encryptionAlgorithms?: string[];
      authenticationAlgorithms?: string[];
      pfsGroup?: string;
      lifetime?: Duration;
    }[];
  };
}

export interface WifiSettings {
  radios?: {
    interfaceName: string;
    enabled?: boolean;
    mode?: 'access-point' | 'station';
    ssid?: string;
    country?: string;
    channel?: {
      band?: string;
      frequenciesMHz?: number[];
      width?: string;
      transmitPowerDbm?: number;
    };
    security?: {
      mode: 'open';
    } | {
      mode: 'wpa2-personal' | 'wpa3-personal' | 'wpa2-wpa3-personal';
      passphrase: SecretReference;
    } | {
      mode: 'enterprise';
      radiusServerNames: string[];
    };
    network?: {
      bridgeName?: string;
      vlanId?: number;
      clientIsolation?: boolean;
    };
  }[];
}

export interface ManagementSettings {
  users?: {
    username: string;
    groupName: string;
    enabled?: boolean;
    allowedAddresses?: CIDR[];
    password?: SecretReference;
    sshPublicKeys?: string[];
  }[];
  groups?: {
    name: string;
    policies: string[];
  }[];
  services?: {
    name: 'ssh' | 'winbox' | 'www' | 'www-ssl' | 'api' | 'api-ssl' | 'ftp' | 'telnet';
    enabled?: boolean;
    port?: number;
    allowedAddresses?: CIDR[];
    certificateName?: string;
  }[];
  certificates?: {
    name: string;
    certificate: SecretReference;
    privateKey?: SecretReference;
    trusted?: boolean;
  }[];
  neighborDiscovery?: {
    interfaceList: string;
  };
  macAccess?: {
    winboxInterfaceList?: string;
    telnetInterfaceList?: string;
  };
}

export interface MonitoringSettings {
  logging?: {
    actions?: {
      name: string;
      target: 'memory' | 'disk' | 'remote';
      remoteHost?: string;
      remotePort?: number;
      fileName?: string;
      retainedFiles?: number;
    }[];
    rules?: {
      topics: string[];
      actionName: string;
      prefix?: string;
      enabled?: boolean;
    }[];
  };
  snmp?: {
    enabled?: boolean;
    contact?: string;
    location?: string;
    communities?: {
      name: string;
      allowedAddresses?: CIDR[];
      security?: 'none' | 'authenticated' | 'private';
      authenticationSecret?: SecretReference;
      encryptionSecret?: SecretReference;
    }[];
  };
  trafficFlow?: {
    enabled?: boolean;
    interfaces?: string[];
    collectors?: {
      address: IPAddress;
      port: number;
      version: '5' | '9' | 'ipfix';
    }[];
  };
  watchdog?: {
    enabled?: boolean;
    watchAddress?: IPAddress;
    pingTimeout?: Duration;
  };
}
