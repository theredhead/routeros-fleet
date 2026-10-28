import { randomUUID } from 'node:crypto';
import { TransportSession } from './transport-strategy';
/** Snapshot uses one authenticated transport throughout; failed writes are never replayed. */
export async function captureInitialBackup(session: TransportSession): Promise<Buffer> {
  const filename = `fleet-initial-${randomUUID()}.backup`;
  try {
    await session.command('/system/backup/save', {name: filename, 'dont-encrypt': 'yes'});
    const size = Number(await session.execute(`:put [/file get "${filename}" size]`));
    if (!Number.isSafeInteger(size) || size <= 0 || size > 16 * 1024 * 1024) throw new Error('Invalid or oversized initial backup');
    const chunks: Buffer[] = [];
    for (let offset = 0; offset < size; offset += 16384) {
      const length = Math.min(16384, size - offset);
      const hex = await session.execute(`:local part [/file read file="${filename}" offset=${offset} chunk-size=${length} as-value]; :put [:convert ($part->"data") from=raw to=hex]`);
      if (!/^[0-9a-f]+$/i.test(hex) || hex.length !== length * 2) throw new Error('Incomplete initial backup');
      chunks.push(Buffer.from(hex, 'hex'));
    }
    return Buffer.concat(chunks);
  } finally {
    await session.execute(`/file remove [find where name="${filename}"]; :put "removed"`);
  }
}
