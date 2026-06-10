import pako from 'pako';

const COMPRESSION_THRESHOLD = 512; // bytes

export function compress(data: string): Buffer {
  const input = Buffer.from(data, 'utf8');
  if (input.length < COMPRESSION_THRESHOLD) {
    // Prefix with 0x00 = not compressed
    return Buffer.concat([Buffer.from([0x00]), input]);
  }
  const compressed = pako.deflate(input);
  // Prefix with 0x01 = compressed
  return Buffer.concat([Buffer.from([0x01]), Buffer.from(compressed)]);
}

export function decompress(data: Buffer): string {
  const flag = data[0];
  const payload = data.slice(1);
  if (flag === 0x01) {
    const decompressed = pako.inflate(payload);
    return Buffer.from(decompressed).toString('utf8');
  }
  return payload.toString('utf8');
}

export function shouldCompress(data: string): boolean {
  return Buffer.byteLength(data, 'utf8') >= COMPRESSION_THRESHOLD;
}
