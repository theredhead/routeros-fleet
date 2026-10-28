import { Injectable } from '@nestjs/common';
import { CommunicationService } from '../communication/communication.service';
import { RouterCredentials, RouterRecord, TransportSession } from '../communication/transport-strategy';
import { captureInitialBackup } from '../communication/initial-backup';
export type Creds = RouterCredentials;
@Injectable()
export class RouterOsClientService {
  constructor(private readonly communication: CommunicationService) {}
  private async use<T>(credentials: Creds, operation: (session: TransportSession) => Promise<T>): Promise<T> {
    const selected = await this.communication.select(credentials);
    try { return await operation(selected.session); } finally { selected.session.close(); }
  }
  async verifyLogin(credentials: Creds) {
    const selected = await this.communication.select(credentials);
    try { return {version: String(selected.resource.version).slice(0, 100), model: typeof selected.resource['board-name'] === 'string' ? selected.resource['board-name'].slice(0, 100) : undefined, communication: selected.communication}; }
    finally { selected.session.close(); }
  }
  captureInitialBackup(credentials: Creds): Promise<Buffer> { return this.use(credentials, session => captureInitialBackup(session)); }
  async list(credentials: Creds, menu: string): Promise<RouterRecord[]> {
    const rows = await this.use(credentials, session => session.command(`/${menu}/print`));
    return rows.map(row => ({...row, id: row['.id'] ?? row.id}));
  }
  async add(credentials: Creds, menu: string, items: RouterRecord[]): Promise<RouterRecord[]> {
    return this.use(credentials, async session => {
      const rows: RouterRecord[] = [];
      for (const item of items) {
        const added = await session.command(`/${menu}/add`, item);
        rows.push(...added.map(row => ({...row, id: row.ret ?? row['.id'] ?? row.id})));
      }
      return rows;
    });
  }
  set(credentials: Creds, menu: string, id: string, properties: RouterRecord) { return this.use(credentials, session => session.command(`/${menu}/set`, {'.id': id, ...properties})); }
  async remove(credentials: Creds, menu: string, id: string): Promise<void> { await this.use(credentials, session => session.command(`/${menu}/remove`, {'.id': id})); }
  async systemResource(credentials: Creds): Promise<RouterRecord> { return this.use(credentials, async session => (await session.command('/system/resource/print'))[0]); }
}
