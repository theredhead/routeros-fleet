import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface Creds {
  host: string;      // management IP (or hostname) of the device
  username: string;  // least-privilege per-device REST user
  password: string;
}

/**
 * Thin client for the RouterOS JSON-RPC-over-HTTPS "REST API" (RouterOS 7.x).
 * Base path is /rest. Property names use RouterOS hyphenated form (e.g. address-pool).
 * Handles self-signed certs (rejectUnauthorized:false) and idempotent retry w/ backoff.
 */
@Injectable()
export class RouterOsClientService {
  private timeoutMs = Number(process.env.ROUTEROS_TIMEOUT_MS || 15000);

  private clientFor(creds: Creds): AxiosInstance {
    return axios.create({
      baseURL: `https://${creds.host}/rest`,
      auth: { username: creds.username, password: creds.password },
      https: { rejectUnauthorized: false },
      timeout: this.timeoutMs,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** GET /rest/<menu> -> array of records (each has an .id). */
  async list(creds: Creds, menu: string): Promise<any[]> {
    const r = await this.withRetry(() => this.clientFor(creds).get(menu));
    return Array.isArray(r.data) ? r.data : [];
  }

  /** POST /rest/<menu> with an array of objects -> created records (with .id). */
  async add(creds: Creds, menu: string, items: Record<string, any>[]): Promise<any[]> {
    const r = await this.withRetry(() => this.clientFor(creds).post(menu, items));
    return Array.isArray(r.data) ? r.data : [];
  }

  /** PUT /rest/<menu>/<id> -> full replace of that record. */
  async set(creds: Creds, menu: string, id: string, props: Record<string, any>): Promise<any> {
    const r = await this.withRetry(() => this.clientFor(creds).put(`${menu}/${id}`, props));
    return r.data;
  }

  /** DELETE /rest/<menu>/<id>. */
  async remove(creds: Creds, menu: string, id: string): Promise<void> {
    await this.withRetry(() => this.clientFor(creds).delete(`${menu}/${id}`));
  }

  /** GET /system/resource — used as a cheap connectivity/health probe. */
  async systemResource(creds: Creds): Promise<any> {
    const r = await this.withRetry(() => this.clientFor(creds).get('/system/resource'), 2);
    return r.data;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i < retries) {
          const delay = Math.min(8000, 300 * Math.pow(2, i));
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
    throw lastErr;
  }
}
