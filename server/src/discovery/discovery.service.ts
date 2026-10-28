import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { discoverNeighbors } from './mndp';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export interface DiscoveredDevice {
  ip: string;
  mac?: string;
  isRouterOs: boolean;
  hostname?: string;
}

/**
 * Network discovery service.
 * - auto → MNDP announcements on local LAN interfaces.
 * - MAC input → MNDP first, then populate and inspect the ARP table.
 * - IP input    → probe that single address for RouterOS.
 * - CIDR input → bounded HTTP/HTTPS probing, independent of ICMP.
 */
@Injectable()
export class DiscoveryService {
  private readonly log = new Logger(DiscoveryService.name);

  // ─── Public entry point ────────────────────────────────────────────────

  async discover(identifier: string, subnet?: string, concurrency = 64): Promise<DiscoveredDevice[]> {
    const id = identifier.trim().toLowerCase();

    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 128) {
      throw new BadRequestException('Concurrency must be an integer from 1 to 128.');
    }
    if (id === 'auto') {
      try { return await discoverNeighbors(); }
      catch (error) { throw new BadRequestException(`LAN discovery failed: ${error.message}`); }
    }
    if (this.isMac(id)) return this.discoverByMac(id, subnet);
    if (this.isCidr(id)) return this.discoverByCidr(id, concurrency);
    if (net.isIP(id)) return this.probeSingle(id);

    throw new BadRequestException(
      'Unrecognised identifier. Provide a MAC (AA:BB:CC:DD:EE:FF), an IP (192.168.1.1), or a CIDR (192.168.1.0/24).',
    );
  }

  // ─── MAC discovery ─────────────────────────────────────────────────────

  private async discoverByMac(mac: string, subnet?: string): Promise<DiscoveredDevice[]> {
    const target = mac.replace(/[:-]/g, '');
    const neighbors = await discoverNeighbors();
    const found = neighbors.filter(device => device.mac?.replace(/:/g, '').toLowerCase() === target);
    if (found.length) return found;
    const scanRange = subnet || (await this.localSubnet());
    if (!scanRange) throw new BadRequestException('Could not determine local subnet. Pass a "subnet" field (e.g. 192.168.1.0/24).');

    const liveIps = await this.pingSweep(scanRange, 64);
    this.log.debug(`MAC discovery: ${liveIps.length} live hosts in ${scanRange}`);
    const arpTable = await this.readArpTable();

    const matches: DiscoveredDevice[] = [];
    for (const ip of arpTable.keys()) {
      const entryMac = arpTable.get(ip)?.split(':').map(octet => octet.padStart(2, '0')).join('').toLowerCase();
      if (entryMac === target) {
        const probe = await this.probeRouterOs(ip);
        matches.push({ ip, mac: this.formatMac(target), isRouterOs: probe.isRouterOs, hostname: probe.hostname });
      }
    }
    return matches;
  }

  // ─── CIDR discovery ────────────────────────────────────────────────────

  private async discoverByCidr(cidr: string, concurrency: number): Promise<DiscoveredDevice[]> {
    const ips = this.expandCidr(cidr);
    const results: DiscoveredDevice[] = [];
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, ips.length) }, async () => {
      while (index < ips.length) {
        const ip = ips[index++];
        const probe = await this.probeRouterOs(ip);
        if (probe.isRouterOs) results.push({ ip, ...probe });
      }
    }));
    results.sort((a, b) => this.ipToInt(a.ip) - this.ipToInt(b.ip));
    return results;
  }

  // ─── Single IP probe ───────────────────────────────────────────────────

  private async probeSingle(ip: string): Promise<DiscoveredDevice[]> {
    const probe = await this.probeRouterOs(ip);
    return [{ ip, ...probe }];
  }

  // ─── RouterOS probe (unauthenticated) ──────────────────────────────────
  //
  // RouterOS REST API returns 401 with a JSON body for unauthenticated requests.
  // A non-RouterOS host will either refuse the connection, return a different
  // status, or not speak TLS at all.

  private async probeRouterOs(ip: string): Promise<{ isRouterOs: boolean; hostname?: string }> {
    const host = net.isIP(ip) === 6 ? `[${ip}]` : ip;
    const probes = await Promise.all(['https', 'http'].map(async protocol => {
      try {
        const response = await this.httpGet(`${protocol}://${host}/rest/system/resource`, 1200);
        let body: any;
        try { body = JSON.parse(response.body); } catch { this.log.debug(`Discovery received a non-JSON ${protocol} response from ${ip}; checking RouterOS signatures.`); }
        const resource = Array.isArray(body) ? body[0] : body;
        if (response.status === 200 && resource?.['board-name'] && resource?.version) return true;
        if (/mikrotik|routeros|basic realm="routeros"/i.test(response.body + response.auth)) return true;
        const home = await this.httpGet(`${protocol}://${host}/`, 1200);
        return /mikrotik|routeros|webfig/i.test(home.body);
      } catch { return false; }
    }));
    return { isRouterOs: probes.some(Boolean) };
  }

  private httpGet(url: string, timeoutMs: number): Promise<{ status: number; body: string; auth: string }> {
    return new Promise((resolve, reject) => {
      const transport = url.startsWith('https:') ? https : http;
      const req = transport.get(url, { rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; if (data.length > 65536) req.destroy(new Error('Response too large')); });
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data, auth: String(res.headers['www-authenticate'] || '') }));
      });
      const timer = setTimeout(() => req.destroy(new Error('timeout')), timeoutMs);
      req.on('close', () => clearTimeout(timer));
      req.on('error', (e) => reject(e));
    });
  }

  // ─── Ping sweep ────────────────────────────────────────────────────────

  private async pingSweep(cidr: string, concurrency: number): Promise<string[]> {
    const ips = this.expandCidr(cidr);
    const live: string[] = [];
    let idx = 0;

    await new Promise<void>((resolve) => {
      if (ips.length === 0) return resolve();
      let remaining = ips.length;
      const done = () => { if (--remaining === 0) resolve(); };

      const worker = async () => {
        while (idx < ips.length) {
          const i = idx++;
          if (await this.ping(ips[i])) live.push(ips[i]);
          done();
        }
      };

      const n = Math.min(concurrency, ips.length);
      void Promise.all(Array.from({ length: n }, () => worker())).then(() => resolve());
    });

    return live.sort((a, b) => this.ipToInt(a) - this.ipToInt(b));
  }

  private ping(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
      // macOS: no -W flag. Linux: -W 1 (1s). Windows: -w 1000 (1s ms).
      const args = process.platform === 'win32'
        ? ['-n', '1', '-w', '1000', ip]
        : process.platform === 'darwin'
          ? ['-c', '1', '-t', '1', ip]   // -t 1 = 1s timeout on macOS
          : ['-c', '1', '-W', '1', ip];   // Linux: -W 1 = 1s

      exec(`ping ${args.join(' ')}`, { timeout: 3000 }, (error) => resolve(!error));
    });
  }

  private expandCidr(cidr: string): string[] {
    const [base, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    if (!net.isIPv4(base) || !/^\d+$/.test(prefixStr || '') || prefix < 22 || prefix > 32) {
      throw new BadRequestException('Use a valid IPv4 CIDR between /22 and /32 (at most 1024 addresses).');
    }

    const baseInt = this.ipToInt(base);
    const hostBits = 32 - prefix;
    const total = 2 ** hostBits;
    const network = baseInt & (~((2 ** hostBits) - 1)) >>> 0;

    // Skip network address (first) and broadcast (last) for /31 and larger.
    const start = prefix >= 31 ? network : network + 1;
    const end = prefix >= 31 ? network + total - 1 : network + total - 2;

    const ips: string[] = [];
    for (let i = start; i <= end && i < network + total; i++) {
      ips.push(this.intToIp(i >>> 0));
    }
    return ips;
  }

  // ─── ARP helpers (macOS / Linux) ───────────────────────────────────────

  private async readArpTable(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      let out: string;
      if (process.platform === 'darwin') {
        out = (await execAsync('arp -a')).stdout;
        // format: host (ip) at mac on en0 ifscope [flags]
        for (const line of out.split('\n')) {
          const m = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)/i);
          if (m) map.set(m[1], m[2].toLowerCase());
        }
      } else {
        out = (await execAsync('ip neigh show')).stdout;
        // format: IP  dev eno1  lladdr AA:BB:CC:DD:EE:FF  REACHABLE
        for (const line of out.split('\n')) {
          const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+dev\s+\S+\s+lladdr\s+([0-9a-f:]+)/i);
          if (m) map.set(m[1], m[2].toLowerCase());
        }
      }
    } catch { this.log.warn('Could not read the local neighbor table; MAC lookup results may be incomplete.'); }
    return map;
  }

  // ─── Misc helpers ──────────────────────────────────────────────────────

  private async localSubnet(): Promise<string | undefined> {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      if (name === 'lo' || name === 'lo0') continue;
      for (const info of ifaces[name] || []) {
        if (info.family === 'IPv4' && !info.internal) {
          return `${info.address}/${this.netmaskToPrefix(info.netmask)}`;
        }
      }
    }
    return undefined;
  }

  private isMac(s: string): boolean {
    const clean = s.replace(/[:-]/g, '');
    return /^[0-9a-f]{12}$/.test(clean);
  }

  private isCidr(s: string): boolean {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(s);
  }

  private formatMac(raw: string): string {
    return raw.replace(/([0-9a-f]{2})(?=[0-9a-f])/g, '$1:').toUpperCase();
  }

  private netmaskToPrefix(mask: string): number {
    const n = mask.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
    return (n.toString(2).match(/1/g) || []).length;
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  }

  private intToIp(n: number): string {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
  }
}
