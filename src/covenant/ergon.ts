/**
 * Ergon-like daily Moore δ on a compact PoW target.
 * target_d = floor(genesisTarget * 99918^d / 100000^d)
 *
 * WLDF v2 (17 bytes):
 *   WLDF | ver=2 | dayIndex u32 LE | target u32 LE | locktime u32 LE
 */
import { mooreAfterDays } from '../lib/moore.js';
import { MOORE_DAY_SECONDS, MOORE_NUM, MOORE_DEN } from '../params/consensus.js';
import { WLDF_LOKAD } from './wldf.js';

export const WLDF_VERSION_ERGON = 2;

/** Dogfood window: targets precomputed for days 0..ERGON_MAX_DAYS inclusive. */
export const ERGON_MAX_DAYS = 4;

/**
 * Genesis compact target: bin2num(hash[0:4]) ∈ [0, 2^31) must be < target.
 * 2^24 ⇒ ~1/128 success among non-negative heads (cheap dogfood).
 */
export const ERGON_GENESIS_TARGET = 2 ** 24;

export interface ErgonParams {
  genesisUnix: number;
  daySeconds: number;
  genesisTarget: number;
}

export interface ErgonState {
  locktime: number;
  days: number;
  target: number;
}

export function buildErgonTargetTable(
  genesisTarget: number = ERGON_GENESIS_TARGET,
  maxDays: number = ERGON_MAX_DAYS,
): Buffer {
  const table = Buffer.alloc((maxDays + 1) * 4);
  for (let d = 0; d <= maxDays; d++) {
    const t = Number(mooreAfterDays(d, BigInt(genesisTarget)));
    if (!Number.isInteger(t) || t < 0 || t >= 0x80000000) {
      throw new Error(`Ergon target out of Script range at day ${d}: ${t}`);
    }
    table.writeUInt32LE(t, d * 4);
  }
  return table;
}

export function computeErgonState(
  locktime: number,
  params: ErgonParams,
): ErgonState {
  if (locktime < params.genesisUnix) {
    throw new Error(
      `locktime ${locktime} < genesisUnix ${params.genesisUnix}`,
    );
  }
  const days = Math.floor(
    (locktime - params.genesisUnix) / params.daySeconds,
  );
  if (days > ERGON_MAX_DAYS) {
    throw new Error(
      `days ${days} exceeds Ergon dogfood window ${ERGON_MAX_DAYS}`,
    );
  }
  const target = Number(
    mooreAfterDays(days, BigInt(params.genesisTarget)),
  );
  return { locktime, days, target };
}

function u32Le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
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

/** WLDF v2 push (17 bytes). */
export function wldfErgonPushdata(state: ErgonState): Uint8Array {
  const out = new Uint8Array(17);
  out.set(WLDF_LOKAD, 0);
  out[4] = WLDF_VERSION_ERGON;
  out.set(u32Le(state.days), 5);
  out.set(u32Le(state.target), 9);
  out.set(u32Le(state.locktime), 13);
  return out;
}

/** Script-faithful LE bin2num of hash[0:4]; null if negative (MSB set). */
export function hashHeadScriptNum(hash: Uint8Array): number | null {
  if (hash.length < 4) return null;
  if ((hash[3]! & 0x80) !== 0) return null;
  return (
    hash[0]! +
    hash[1]! * 256 +
    hash[2]! * 65536 +
    hash[3]! * 16777216
  );
}

export function meetsErgonTarget(hash: Uint8Array, target: number): boolean {
  const v = hashHeadScriptNum(hash);
  return v !== null && v < target;
}

export const ERGON_DAY_SECONDS_DEFAULT = MOORE_DAY_SECONDS;

export { MOORE_NUM, MOORE_DEN };
