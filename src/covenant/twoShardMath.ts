/**
 * Two-shard (compute C + mint M) Ergon-δ state math — PURE, zero deps.
 *
 * Deliberately imports nothing (not even ecash-lib): jest cannot load
 * ecash-lib's WASM glue (pre-existing repo-wide failure — see
 * tests/mooreTipTemple.test.ts), so everything jest-coverable lives here.
 * The ecash-lib-backed OP_RETURN builder lives in twoShardOpReturn.ts.
 *
 * Canonical day-step (SUB form, exactly what the covenants compute):
 *   t ← t − floor(t·82 / 100000)
 * This is NOT `mooreStep` ((t·99918)/100000): the two differ by 1 whenever
 * (t·82) mod 100000 ≠ 0, so both sides must use THIS form. Economically
 * equivalent (same δ to <1 unit on a ~2^24 target), consensus-distinct.
 */

export const TWO_SHARD_K = 1;
export const TWO_SHARD_DAY_SECONDS_DEFAULT = 86_400;
/** Cheap dogfood target: ~1/128 success among non-negative heads. */
export const TWO_SHARD_GENESIS_TARGET_DEFAULT = 2 ** 24;

/** WLDF v3: two-shard state announcement (17 bytes, same layout as v2). */
export const WLDF_VERSION_TWOSHARD = 3;
export const WLDF_LOKAD_TWOSHARD = new TextEncoder().encode('WLDF');

/** Output order pinned by both shards: OP_RETURN, miner, C', M'. */
export const TWOSHARD_OUT_MINER = 1;
export const TWOSHARD_OUT_C = 2;
export const TWOSHARD_OUT_M = 3;

export interface TwoShardGenesis {
  genesisUnix: number;
  daySeconds: number;
  genesisTarget: number;
}

export interface TwoShardTip {
  tipDay: number;
  target: number;
}

export interface TwoShardDerived extends TwoShardTip {
  newDay: number;
  newTarget: number;
  steps: number;
  locktime: number;
}

function assertScriptSafeU32(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`${what} out of Script-safe u32 range: ${n}`);
  }
}

/** One canonical δ step: t − floor(t·82/100000). */
export function twoShardStep(t: bigint): bigint {
  if (t <= 0n) throw new Error(`twoShardStep needs positive t, got ${t}`);
  return t - (t * 82n) / 100000n;
}

export function twoShardAfterSteps(
  steps: number,
  base: bigint,
): bigint {
  if (!Number.isInteger(steps) || steps < 0 || steps > TWO_SHARD_K) {
    throw new Error(`steps must be 0..${TWO_SHARD_K}, got ${steps}`);
  }
  let x = base;
  for (let i = 0; i < steps; i++) x = twoShardStep(x);
  return x;
}

export function deriveTwoShardState(
  genesis: TwoShardGenesis,
  tip: TwoShardTip,
  locktime: number,
): TwoShardDerived {
  assertScriptSafeU32(genesis.genesisUnix, 'genesisUnix');
  assertScriptSafeU32(genesis.genesisTarget, 'genesisTarget');
  assertScriptSafeU32(locktime, 'locktime');
  if (genesis.daySeconds <= 0) throw new Error('daySeconds must be positive');
  const newDay = Math.floor(
    (locktime - genesis.genesisUnix) / genesis.daySeconds,
  );
  const steps = newDay - tip.tipDay;
  if (steps < 0) {
    throw new Error(
      `locktime ${locktime} rewinds tipDay ${tip.tipDay} (newDay ${newDay})`,
    );
  }
  if (steps > TWO_SHARD_K) {
    throw new Error(
      `stale baton: ${steps} days > K=${TWO_SHARD_K} (needs tick txs)`,
    );
  }
  const newTarget = Number(
    twoShardAfterSteps(steps, BigInt(tip.target)),
  );
  assertScriptSafeU32(newTarget, 'newTarget');
  return { tipDay: tip.tipDay, target: tip.target, newDay, newTarget, steps, locktime };
}

function u32Le(n: number): Uint8Array {
  assertScriptSafeU32(n, 'wldf field');
  const v = n >>> 0;
  return new Uint8Array([
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ]);
}

/** 17-byte WLDF v3 push: LOKAD | 0x03 | day u32 | target u32 | locktime u32. */
export function wldfTwoShardPushdata(state: {
  newDay: number;
  newTarget: number;
  locktime: number;
}): Uint8Array {
  const out = new Uint8Array(17);
  out.set(WLDF_LOKAD_TWOSHARD, 0);
  out[4] = WLDF_VERSION_TWOSHARD;
  out.set(u32Le(state.newDay), 5);
  out.set(u32Le(state.newTarget), 9);
  out.set(u32Le(state.locktime), 13);
  return out;
}
