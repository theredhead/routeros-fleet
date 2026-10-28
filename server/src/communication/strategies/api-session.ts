import { Socket } from 'node:net';
import { RouterRecord, TransportSession } from '../transport-strategy';
import { decodeWord, encodeWord } from './api-codec';
export class ApiSession implements TransportSession {
  private buffer: Buffer = Buffer.alloc(0);
  private sentence: string[] = [];
  private responseBytes = 0;
  private pending?: {resolve: (rows: RouterRecord[]) => void; reject: (error: Error) => void; rows: RouterRecord[]; failure?: Error; timer: ReturnType<typeof setTimeout>};
  constructor(private readonly socket: Socket, private readonly timeout: number) {
    socket.on('data', data => {
      try {
        this.responseBytes += data.length;
        if (this.responseBytes > 16 * 1024 * 1024) throw new Error('Oversized API response');
        this.buffer = Buffer.concat([this.buffer, data]);
        if (this.buffer.length > 2 * 1024 * 1024) throw new Error('Oversized API response');
        let decoded: ReturnType<typeof decodeWord>;
        while ((decoded = decodeWord(this.buffer))) {
          this.buffer = this.buffer.subarray(decoded.bytes);
          if (decoded.word) { this.sentence.push(decoded.word); if (this.sentence.length > 4096) throw new Error('Oversized API sentence'); }
          else { this.received(this.sentence); this.sentence = []; }
        }
      } catch { this.fail(new Error('Invalid native API response')); this.close(); }
    });
    socket.on('error', () => this.fail(new Error('Native API connection failed')));
    socket.on('close', () => this.fail(new Error('Native API connection closed')));
  }
  private fail(error: Error): void {
    const pending = this.pending; this.pending = undefined;
    if (pending) { clearTimeout(pending.timer); pending.reject(error); }
  }
  private received(words: string[]): void {
    const pending = this.pending;
    if (!pending || !words.length) return;
    const row: RouterRecord = {};
    for (const word of words.slice(1)) {
      if (!word.startsWith('=')) continue;
      const separator = word.indexOf('=', 1);
      if (separator > 0) row[word.slice(1, separator)] = word.slice(separator + 1);
    }
    if (words[0] === '!trap' || words[0] === '!fatal') {
      pending.failure = new Error('Native API command was rejected');
      if (words[0] === '!fatal') { this.fail(pending.failure); this.close(); }
    } else if (words[0] === '!re') {
      if (pending.rows.length >= 20000) { this.fail(new Error('Native API response exceeded row limit')); this.close(); }
      else pending.rows.push(row);
    } else if (words[0] === '!done') {
      this.pending = undefined; clearTimeout(pending.timer);
      if (pending.failure) pending.reject(pending.failure);
      else { if (Object.keys(row).length) pending.rows.push(row); pending.resolve(pending.rows); }
    }
  }
  command(path: string, parameters: RouterRecord = {}): Promise<RouterRecord[]> {
    if (this.pending) return Promise.reject(new Error('Concurrent API commands are not supported on one session'));
    this.responseBytes = 0;
    return new Promise((resolve, reject) => {
      this.pending = {resolve, reject, rows: [], timer: setTimeout(() => { this.fail(new Error('Native API command timed out')); this.close(); }, this.timeout)};
      this.socket.write(Buffer.concat([path, ...Object.entries(parameters).map(([key, value]) => `=${key}=${String(value)}`), ''].map(encodeWord)));
    });
  }
  async execute(script: string): Promise<string> {
    const rows = await this.command('/execute', {script, 'as-string': ''});
    if (typeof rows[0]?.ret !== 'string') throw new Error('RouterOS cannot execute this script synchronously');
    return rows[0].ret.trim();
  }
  close(): void { this.socket.destroy(); }
}
