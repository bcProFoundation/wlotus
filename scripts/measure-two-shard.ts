#!/usr/bin/env tsx
/**
 * Compile the two-shard (C+M) prototype, report per-shard budgets, and
 * GATE on every consensus-critical invariant (exit 1 on violation).
 *
 * Limits: P2SH redeem ≤520B, eCash MAX_OPS_PER_SCRIPT = 201 (opcode > OP_16).
 * Gates: no executed OP_MUL (0x95), no 0xc0–0xcd executed anywhere
 * (introspection is BCH-only — undefined on eCash), exactly one executed
 * CODESEPARATOR per redeem (the miner cuts scriptCode at index 0), uniform
 * 60B heads with 10 state bytes at offset 50 (both shards stateful),
 * cross-state body stability (only the 10 state bytes change), ratcheting
 * P2SH addresses, eMPP lengths matching the covenant literals
 * (0x11/0x32/0x47), and the ALP numBatons 0x02 encoding proven by diff
 * against the live 0x01 template.
 * Does not broadcast.
 */
import { ALP_STANDARD, alpMint, toHex } from 'ecash-lib';
import {
  createTwoShardPair,
  TWOSHARD_HEAD_LEN,
  TWOSHARD_STATE_OFF,
  type TwoShardShardParams,
} from '../src/covenant/twoShardScript.js';
import {
  deriveTwoShardState,
  expectedTwoShardMintOpReturnScript,
  wldfTwoShardPushdata,
} from '../src/covenant/twoShard.js';

const MAX_OPS = 201;
const MAX_REDEEM = 520;
const OP_MUL = 0x95;
const OP_CODESEPARATOR = 0xab;

const failures: string[] = [];
function gate(cond: boolean, msg: string): void {
  if (!cond) failures.push(msg);
}

/** Walk opcodes, skipping push data. */
function scanOps(
  script: Buffer,
  onOp: (op: number) => void,
): void {
  let i = 0;
  while (i < script.length) {
    const op = script[i]!;
    if (op > 0 && op < 0x4c) i += 1 + op;
    else if (op === 0x4c) i += 2 + script[i + 1]!;
    else if (op === 0x4d) i += 3 + (script[i + 1]! | (script[i + 2]! << 8));
    else {
      onOp(op);
      i += 1;
    }
  }
}

function countOps(script: Buffer): number {
  let ops = 0;
  scanOps(script, op => {
    if (op > 0x60) ops++;
  });
  return ops;
}

function countExecuted(script: Buffer, want: number): number {
  let n = 0;
  scanOps(script, op => {
    if (op === want) n++;
  });
  return n;
}

function hasExecuted(script: Buffer, pred: (op: number) => boolean): boolean {
  let hit = false;
  scanOps(script, op => {
    if (pred(op)) hit = true;
  });
  return hit;
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

  // --- eMPP / ALP encoding gates (prove covenant literals) ---
  const wldf = wldfTwoShardPushdata({
    newDay: 0,
    newTarget: 2 ** 24,
    locktime: genesisUnix,
  });
  gate(wldf.length === 0x11, `wldf len ${wldf.length} != 0x11`);
  const mint2 = Buffer.from(
    alpMint(tokenId, ALP_STANDARD, { atomsArray: [100n], numBatons: 2 }),
  );
  gate(mint2.length === 0x32, `mintSection len ${mint2.length} != 0x32`);
  const opret = expectedTwoShardMintOpReturnScript(tokenId, 100n, {
    newDay: 0,
    newTarget: 2 ** 24,
    locktime: genesisUnix,
  });
  gate(
    opret.bytecode.length === 0x47,
    `opReturn len ${opret.bytecode.length} != 0x47`,
  );
  const mint1 = Buffer.from(
    alpMint(tokenId, ALP_STANDARD, { atomsArray: [100n], numBatons: 1 }),
  );
  gate(
    mint2.length === mint1.length &&
      mint2.subarray(0, mint2.length - 1).equals(
        mint1.subarray(0, mint1.length - 1),
      ) &&
      mint1[mint1.length - 1] === 0x01 &&
      mint2[mint2.length - 1] === 0x02,
    'numBatons 1-vs-2 must differ only in trailing count byte',
  );
  gate(
    toHex(opret.bytecode).includes('64000000000002'),
    'opReturn must carry LE6(100) + 0x02 baton count',
  );

  // --- compile + budget gates at k=0 and k=1 states ---
  const rows = [];
  const pairs = [];
  for (const [label, locktime] of [
    ['genesis (k=0)', genesisUnix],
    ['day+1 (k=1)', genesisUnix + 86_400],
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
    pairs.push(pair);
    for (const shard of [pair.c, pair.m]) {
      const ops = countOps(shard.redeem);
      const bodyMul = hasExecuted(shard.redeem, op => op === OP_MUL);
      const bodyIntro = hasExecuted(
        shard.redeem,
        op => op >= 0xc0 && op <= 0xcd,
      );
      const seps = countExecuted(shard.redeem, OP_CODESEPARATOR);
      gate(ops <= MAX_OPS, `${label} ${shard.id}: ${ops} ops > 201`);
      gate(
        shard.redeem.length <= MAX_REDEEM,
        `${label} ${shard.id}: ${shard.redeem.length}B > 520`,
      );
      gate(!bodyMul, `${label} ${shard.id}: OP_MUL in redeem`);
      gate(!bodyIntro, `${label} ${shard.id}: introspection in redeem`);
      gate(seps === 1, `${label} ${shard.id}: ${seps} CODESEPARATORs != 1`);
      gate(
        shard.redeem === shard.body,
        `${label} ${shard.id}: redeem must be the Spedn body (no splice)`,
      );
      rows.push({
        state: label,
        shard: shard.id,
        address: shard.address,
        redeemLen: shard.redeem.length,
        ops,
        headroomOps: MAX_OPS - ops,
        headroomBytes: MAX_REDEEM - shard.redeem.length,
        feasible:
          ops <= MAX_OPS &&
          shard.redeem.length <= MAX_REDEEM &&
          !bodyMul &&
          !bodyIntro &&
          seps === 1,
      });
    }
  }

  // --- cross-state + head-uniformity gates ---
  const [p0, p1] = pairs as [
    Awaited<ReturnType<typeof createTwoShardPair>>,
    Awaited<ReturnType<typeof createTwoShardPair>>,
  ];
  for (const [label, pair] of [
    ['k=0', p0],
    ['k=1', p1],
  ] as const) {
    for (const shard of [pair.c, pair.m]) {
      gate(
        shard.body[TWOSHARD_STATE_OFF] === 0x04,
        `${label} ${shard.id}: state tag byte`,
      );
    }
    gate(
      p0.c.body.readUInt32LE(TWOSHARD_STATE_OFF + 1) === 0,
      'C state day0',
    );
    gate(
      p0.c.body.readUInt32LE(TWOSHARD_STATE_OFF + 6) === 2 ** 24,
      'C state target0',
    );
    gate(
      p0.m.body
        .subarray(0, TWOSHARD_HEAD_LEN)
        .equals(p0.c.body.subarray(0, TWOSHARD_HEAD_LEN)),
      `${label}: M head must equal C head (uniform 60B state)`,
    );
  }
  gate(p1.c.body.readUInt32LE(TWOSHARD_STATE_OFF + 1) === 1, 'C state day1');
  gate(
    p1.m.body.readUInt32LE(TWOSHARD_STATE_OFF + 1) === 1,
    'M state day1 (M carries tips too)',
  );
  for (const id of ['c', 'm'] as const) {
    const b0 = p0[id].body;
    const b1 = p1[id].body;
    gate(
      b1.subarray(0, TWOSHARD_STATE_OFF).equals(
        b0.subarray(0, TWOSHARD_STATE_OFF),
      ) &&
        b1.subarray(TWOSHARD_HEAD_LEN).equals(
          b0.subarray(TWOSHARD_HEAD_LEN),
        ),
      `${id.toUpperCase()} bodies must differ only in the 10 state bytes`,
    );
  }
  gate(
    p1.c.address !== p0.c.address && p1.m.address !== p0.m.address,
    'P2SH addresses must ratchet across states',
  );

  console.log(JSON.stringify({ maxOps: MAX_OPS, maxRedeem: MAX_REDEEM, rows }, null, 2));
  if (failures.length > 0) {
    console.error(`\nGATE FAILURES (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('\nALL GATES PASS');
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
