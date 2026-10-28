import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Encrypts per-device credentials at rest with AES-256-GCM.
 * Format: iv:authTag:ciphertext (each base64, joined by ':').
 */
@Injectable()
export class CryptoService {
  private key(): Buffer {
    const raw = process.env.ENCRYPTION_KEY || '';
    const buf = Buffer.from(raw, 'hex');
    if (!/^[0-9a-f]{64}$/i.test(raw) || buf.length !== 32) {
      throw new Error('Credential encryption is not configured. Set a persistent 64-character hexadecimal ENCRYPTION_KEY on the server.');
    }
    return buf.subarray(0, 32);
  }

  isConfigured(): boolean {
    try { this.key(); return true; } catch { return false; }
  }

  assertConfigured(): void { this.key(); }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, enc].map((b) => b.toString('base64')).join(':');
  }

  decrypt(payload: string): string {
    const [ivB, tagB, dataB] = payload.split(':').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key(), ivB);
    decipher.setAuthTag(tagB);
    return Buffer.concat([decipher.update(dataB), decipher.final()]).toString('utf8');
  }
}
