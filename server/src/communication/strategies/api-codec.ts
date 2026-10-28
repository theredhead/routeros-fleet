/** RouterOS API length-prefixed words; decoding waits for complete fragmented frames. */
export function encodeWord(word: string): Buffer {
  const body = Buffer.from(word);
  const length = body.length;
  let prefix: Buffer;
  if (length < 0x80) prefix = Buffer.from([length]);
  else if (length < 0x4000) { prefix = Buffer.alloc(2); prefix.writeUInt16BE(length | 0x8000); }
  else if (length < 0x200000) { prefix = Buffer.alloc(3); prefix.writeUIntBE(length | 0xc00000, 0, 3); }
  else { prefix = Buffer.alloc(4); prefix.writeUInt32BE((length | 0xe0000000) >>> 0); }
  return Buffer.concat([prefix, body]);
}
export function decodeWord(buffer: Buffer): {word: string; bytes: number} | undefined {
  if (!buffer.length) return;
  const first = buffer[0];
  const prefixLength = first < 0x80 ? 1 : first < 0xc0 ? 2 : first < 0xe0 ? 3 : first < 0xf0 ? 4 : first === 0xf0 ? 5 : 0;
  if (!prefixLength) throw new Error('Invalid API frame');
  if (buffer.length < prefixLength) return;
  const length = prefixLength === 5 ? buffer.readUInt32BE(1) : buffer.readUIntBE(0, prefixLength) & [0, 0x7f, 0x3fff, 0x1fffff, 0xfffffff][prefixLength];
  if (length > 1024 * 1024) throw new Error('Oversized API word');
  if (buffer.length < prefixLength + length) return;
  return {word: buffer.subarray(prefixLength, prefixLength + length).toString('utf8'), bytes: prefixLength + length};
}
