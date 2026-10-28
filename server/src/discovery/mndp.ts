import * as dgram from 'node:dgram';
import * as os from 'node:os';

export interface Neighbor {
  ip: string;
  mac?: string;
  hostname?: string;
  model?: string;
  routerosVersion?: string;
  isRouterOs: boolean;
  source: 'mndp';
}

/** MNDP uses a four-byte header followed by big-endian type/length/value fields. */
export function parseNeighbor(packet: Buffer, address: string): Neighbor | undefined {
  if (packet.length < 8) return;
  const fields = new Map<number, Buffer>();
  for (let offset = 4; offset + 4 <= packet.length;) {
    const type = packet.readUInt16BE(offset);
    const length = packet.readUInt16BE(offset + 2);
    offset += 4;
    if (offset + length > packet.length) return;
    fields.set(type, packet.subarray(offset, offset + length));
    offset += length;
  }
  const mac = fields.get(1);
  const platform = fields.get(8)?.toString();
  if (mac?.length !== 6 || !platform) return;
  const ip = fields.get(17);
  return {
    ip: ip?.length === 4 ? [...ip].join('.') : address,
    mac: [...mac].map(byte => byte.toString(16).padStart(2, '0')).join(':').toUpperCase(),
    hostname: fields.get(5)?.toString(),
    routerosVersion: fields.get(7)?.toString(),
    model: fields.get(12)?.toString(),
    isRouterOs: /mikrotik/i.test(platform),
    source: 'mndp',
  };
}

/** Listen on the LAN; no credentials, ARP flushing, or elevated privileges needed. */
export function discoverNeighbors(durationMs = 5000): Promise<Neighbor[]> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const neighbors = new Map<string, Neighbor>();
    const timer = setTimeout(() => {
      socket.close();
      resolve([...neighbors.values()]);
    }, durationMs);
    socket.on('error', error => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
    socket.on('message', (packet, remote) => {
      const neighbor = parseNeighbor(packet, remote.address);
      if (neighbor) neighbors.set(`${neighbor.mac}/${neighbor.ip}`, neighbor);
    });
    socket.bind(5678, '0.0.0.0', () => {
      socket.setBroadcast(true);
      const broadcasts = new Set(['255.255.255.255']);
      for (const entries of Object.values(os.networkInterfaces())) {
        for (const entry of entries || []) {
          if (entry.family !== 'IPv4' || entry.internal) continue;
          const ip = entry.address.split('.').map(Number);
          const mask = entry.netmask.split('.').map(Number);
          broadcasts.add(ip.map((byte, i) => byte | (255 ^ mask[i])).join('.'));
        }
      }
      for (const address of broadcasts) socket.send(Buffer.alloc(4), 5678, address, () => {});
    });
  });
}
