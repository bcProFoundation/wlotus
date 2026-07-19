/**
 * eMPP WLDF (White Lotus DiFficulty) pushdata — Agora-style announcement
 * beside ALP MINT. Consensus D is derived from nLockTime in the redeem;
 * WLDF must match that derivation byte-exact.
 *
 * Layout (15 bytes):
 *   WLDF (4) | ver u8 | zeroBits u16 LE | extraBits u32 LE | locktime u32 LE
 */

export const WLDF_LOKAD = new TextEncoder().encode('WLDF');
export const WLDF_VERSION = 1;

/** Dogfood: +1 bit / day so Moore fine-grain is observable. Prod ≈ 845d. */
export const TEST_MOORE_SECONDS_PER_EXTRA_BIT = 86_400;

/** Cap matches WlotusPowRemintMoore.spedn: bits ≤ base + 8. */
export const MOORE_MAX_EXTRA_BITS = 8;

export interface MooreBitsParams {
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
}

export interface MooreBitsState {
  locktime: number;
  extraBits: number;
  bits: number;
}

export function computeMooreBits(
  locktime: number,
  params: MooreBitsParams,
): MooreBitsState {
  if (locktime < params.genesisUnix) {
    throw new Error(
      `locktime ${locktime} < genesisUnix ${params.genesisUnix}`,
    );
  }
  const elapsed = locktime - params.genesisUnix;
  const extraBits = Math.floor(elapsed / params.secondsPerExtraBit);
  if (extraBits > MOORE_MAX_EXTRA_BITS) {
    throw new Error(
      `extraBits ${extraBits} exceeds cap ${MOORE_MAX_EXTRA_BITS}`,
    );
  }
  const bits = params.baseZeroBits + extraBits;
  return { locktime, extraBits, bits };
}

function u16Le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new Error(`u16 out of range: ${n}`);
  }
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32Le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    // Script bin2num treats MSB of last byte as sign — keep < 2^31.
    throw new Error(`u32 Script-safe out of range: ${n}`);
  }
  const v = n >>> 0;
  return new Uint8Array([
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ]);
}

/** Build the 15-byte WLDF EMPP push (must match Spedn covenant). */
export function wldfPushdata(state: MooreBitsState): Uint8Array {
  const out = new Uint8Array(15);
  out.set(WLDF_LOKAD, 0);
  out[4] = WLDF_VERSION;
  out.set(u16Le(state.bits), 5);
  out.set(u32Le(state.extraBits), 7);
  out.set(u32Le(state.locktime), 11);
  return out;
}

/**
 * True iff hash256 has `bits` leading zero bits (MSB-first within each byte).
 * Matches WlotusPowRemintMoore.spedn remBits checks.
 */
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
