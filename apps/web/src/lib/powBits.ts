/** Pure PoW helpers (no wallet / wasm deps — safe for Jest). */

export function meetsPowBits(hash: Uint8Array, bits: number): boolean {
  if (!Number.isInteger(bits) || bits < 0) return false;
  const zeroBytes = Math.floor(bits / 8);
  const remBits = bits % 8;
  if (hash.length < zeroBytes + (remBits > 0 ? 1 : 0)) return false;
  for (let i = 0; i < zeroBytes; i++) {
    if (hash[i] !== 0) return false;
  }
  if (remBits === 0) return true;
  const next = hash[zeroBytes]!;
  const limit = 1 << (8 - remBits);
  return next < limit;
}

/** Add `stride` into LE nonce (mod 2^(8*len)). */
export function bumpNonceLe(nonce: Uint8Array, stride: number): void {
  let n = stride >>> 0;
  for (let j = 0; j < nonce.length; j++) {
    const sum = nonce[j]! + (n & 0xff);
    nonce[j] = sum & 0xff;
    n = (n >>> 8) + (sum >>> 8);
  }
}
