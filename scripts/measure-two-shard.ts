#!/usr/bin/env tsx
/**
 * Compile the two-shard (C+M) prototype and report per-shard budgets.
 *
 * Limits: P2SH redeem ≤520B, eCash MAX_OPS_PER_SCRIPT = 201 (opcode > OP_16).
 * Also asserts: no OP_MUL (0x95) anywhere, no 0xc0–0xcd inside Spedn bodies
 * (introspection lives only in the TS-assembled 28B prefix).
 * Does not broadcast.
 */
import {
  createTwoShardPair,
  TWOSHARD_PREFIX_LEN,
  TWOSHARD_BODY_STATE_OFF,
  type TwoShardShardParams,
} from '../src/covenant/twoShardScript.js';
import { deriveTwoShardState } from '../src/covenant/twoShard.js';

const MAX_OPS = 201;
const MAX_REDEEM = 520;
const OP_MUL = 0x95;

function countOps(script: Buffer): number {
  let ops = 0;
  let i = 0;
  while (i < script.length) {
    const op = script[i]!;
    if (op > 0x60) ops++;
    if (op > 0 && op < 0x4c) i += 1 + op;
    else if (op === 0x4c) i += 2 + script[i + 1]!;
    else if (op === 0x4d) i += 3 + (script[i + 1]! | (script[i + 2]! << 8));
    else i += 1;
  }
  return ops;
}

function hasMul(script: Buffer): boolean {
  return script.includes(OP_MUL);
}

function hasIntrospection(script: Buffer): boolean {
  for (const b of script) {
    if (b >= 0xc0 && b <= 0xcd) return true;
  }
  return false;
}

async function main(): Promise<void> {
  const tokenId =
    'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b';
  const genesisUnix = Math.floor(Date.now() / 1000) - 3600;
  const base: TwoShardShardParams = {
    tokenId,
    mintAtoms: 100n,
    genesisUnix,
    daySeconds: 86_400,
    genesisTarget: 2 ** 24,
    tipDay: 0,
    tipTarget: 2 ** 24,
  };
  const rows = [];
  for (const [label, locktime] of [
    ['genesis (k=0)', genesisUnix],
    ['day+1 (k=1)', genesisUnix + 86_400],
    ['day+3 (k=3)', genesisUnix + 3 * 86_400],
  ] as Array<[string, number]>) {
    const d = deriveTwoShardState(
      base,
      { tipDay: 0, target: 2 ** 24 },
      locktime,
    );
    const pair = await createTwoShardPair({
      ...base,
      tipDay: d.newDay,
      tipTarget: d.newTarget,
    });
    for (const shard of [pair.c, pair.m]) {
      const bodyOps = countOps(shard.body);
      const fullOps = countOps(shard.redeem);
      rows.push({
        state: label,
        shard: shard.id,
        address: shard.address,
        bodyLen: shard.body.length,
        bodyOps,
        prefixLen: shard.prefix.length,
        prefixOk: shard.prefix.length === TWOSHARD_PREFIX_LEN,
        fullLen: shard.redeem.length,
        fullOps,
        under201: fullOps <= MAX_OPS,
        under520: shard.redeem.length <= MAX_REDEEM,
        headroomOps: MAX_OPS - fullOps,
        headroomBytes: MAX_REDEEM - shard.redeem.length,
        bodyHasMul: hasMul(shard.body),
        bodyHasIntrospection: hasIntrospection(shard.body),
        stateOffOk:
          shard.body[TWOSHARD_BODY_STATE_OFF] === 0x04,
        feasible:
          fullOps <= MAX_OPS &&
          shard.redeem.length <= MAX_REDEEM &&
          !hasMul(shard.body) &&
          !hasIntrospection(shard.body),
      });
    }
  }
  console.log(JSON.stringify({ maxOps: MAX_OPS, maxRedeem: MAX_REDEEM, rows }, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
