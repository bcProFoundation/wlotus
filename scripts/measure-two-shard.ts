#!/usr/bin/env tsx
/**
 * Compile the two-shard (C+M) prototype, report per-shard budgets, and
 * GATE on every consensus-critical invariant (exit 1 on violation).
 *
 * Limits: P2SH redeem ≤520B, eCash MAX_OPS_PER_SCRIPT = 201 (opcode > OP_16).
 * Gates: no executed OP_MUL (0x95), no 0xc0–0xcd inside Spedn bodies
 * (introspection lives only in the TS-assembled 28B prefix), exact
 * prefix templates + sibling body-hash holes, state bytes at asserted
 * offsets, cross-state body stability (C: only 10 state bytes change;
 * M: fully static), ratcheting P2SH addresses, eMPP lengths matching
 * the covenant literals (0x11/0x32/0x47), and the ALP numBatons 0x02
 * encoding proven by diff against the live 0x01 template.
 * Does not broadcast.
 */
import { ALP_STANDARD, alpMint, shaRmd160, toHex } from 'ecash-lib';
import {
  buildShardPrefix,
  createTwoShardPair,
  TWOSHARD_C_HEAD_LEN,
  TWOSHARD_C_STATE_OFF,
  TWOSHARD_M_HEAD_LEN,
  TWOSHARD_PREFIX_LEN,
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

  // --- prefix template gate (zero hole) ---
  const z = Buffer.alloc(20, 0);
  gate(
    buildShardPrefix('C', z).toString('hex') ===
      `c0009d51c7a914${'00'.repeat(20)}88`,
    'C prefix template mismatch',
  );
  gate(
    buildShardPrefix('M', z).toString('hex') ===
      `c0519d00c7a914${'00'.repeat(20)}88`,
    'M prefix template mismatch',
  );
  try {
    buildShardPrefix('C', Buffer.alloc(19, 0));
    gate(false, 'buildShardPrefix must reject non-20B holes');
  } catch {
    /* expected */
  }

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
      const bodyOps = countOps(shard.body);
      const fullOps = countOps(shard.redeem);
      const bodyMul = hasExecuted(shard.body, op => op === OP_MUL);
      const bodyIntro = hasExecuted(
        shard.body,
        op => op >= 0xc0 && op <= 0xcd,
      );
      gate(fullOps <= MAX_OPS, `${label} ${shard.id}: ${fullOps} ops > 201`);
      gate(
        shard.redeem.length <= MAX_REDEEM,
        `${label} ${shard.id}: ${shard.redeem.length}B > 520`,
      );
      gate(!bodyMul, `${label} ${shard.id}: OP_MUL in body`);
      gate(!bodyIntro, `${label} ${shard.id}: introspection in body`);
      gate(
        shard.prefix.length === TWOSHARD_PREFIX_LEN,
        `${label} ${shard.id}: prefix len`,
      );
      rows.push({
        state: label,
        shard: shard.id,
        address: shard.address,
        bodyLen: shard.body.length,
        bodyOps,
        fullLen: shard.redeem.length,
        fullOps,
        headroomOps: MAX_OPS - fullOps,
        headroomBytes: MAX_REDEEM - shard.redeem.length,
        feasible:
          fullOps <= MAX_OPS &&
          shard.redeem.length <= MAX_REDEEM &&
          !bodyMul &&
          !bodyIntro,
      });
    }
  }

  // --- cross-state + hole gates ---
  const [p0, p1] = pairs as [
    Awaited<ReturnType<typeof createTwoShardPair>>,
    Awaited<ReturnType<typeof createTwoShardPair>>,
  ];
  gate(p0.c.body[TWOSHARD_C_STATE_OFF] === 0x04, 'C state tag byte');
  gate(p0.c.body.readUInt32LE(TWOSHARD_C_STATE_OFF + 1) === 0, 'C state day0');
  gate(
    p0.c.body.readUInt32LE(TWOSHARD_C_STATE_OFF + 6) === 2 ** 24,
    'C state target0',
  );
  gate(p1.c.body.readUInt32LE(TWOSHARD_C_STATE_OFF + 1) === 1, 'C state day1');
  gate(
    p1.c.body.subarray(0, TWOSHARD_C_STATE_OFF).equals(
      p0.c.body.subarray(0, TWOSHARD_C_STATE_OFF),
    ) &&
      p1.c.body.subarray(TWOSHARD_C_HEAD_LEN).equals(
        p0.c.body.subarray(TWOSHARD_C_HEAD_LEN),
      ),
    'C bodies must differ only in the 10 state bytes',
  );
  gate(p1.m.body.equals(p0.m.body), 'M body must be static across states');
  gate(
    p0.m.body.subarray(0, TWOSHARD_M_HEAD_LEN).equals(
      p0.c.body.subarray(0, TWOSHARD_M_HEAD_LEN),
    ),
    'M head must match C head prefix (tokenId + mintAtoms)',
  );
  gate(
    p1.c.address !== p0.c.address && p1.m.address !== p0.m.address,
    'P2SH addresses must ratchet across states',
  );
  for (const [shard, sib] of [
    [p0.c, p0.m],
    [p0.m, p0.c],
  ] as const) {
    gate(
      Buffer.from(shard.prefix.subarray(7, 27)).equals(
        Buffer.from(shaRmd160(new Uint8Array(sib.body))),
      ),
      `${shard.id} prefix hole must be hash160(sibling body)`,
    );
  }

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
