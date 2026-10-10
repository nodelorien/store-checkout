type RandomSource = Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string };

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * RFC 4122 v4 identifier. `crypto.randomUUID` only exists in secure contexts, so fall back to
 * `getRandomValues` (available everywhere the app runs).
 */
export function createUuid(source: RandomSource = globalThis.crypto): string {
  if (typeof source.randomUUID === 'function') {
    return source.randomUUID();
  }

  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, toHex);

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
