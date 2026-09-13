#!/usr/bin/env tsx
/**
 * Static gates for the hand-assembled single-shard δ v3 (VLOTUS,
 * k==1-only) redeem.
 *
 * Limits: P2SH redeem ≤520B, eCash MAX_OPS_PER_SCRIPT = 201.
 * Gates: depth-simulator green, exactly one CODESEPARATOR, no OP_MUL,
 * no introspection opcodes (0xc0–0xcd are BCH-only), head layout
 * econ(83) | prefixHash push(33) | state push(9), state-change isolation
 * (tip day 0 vs day 1 — the k=1 pair — differ ONLY in the 8 state bytes),
 * P2SH ratchet, WLDF v4 version byte,
 * eMPP lengths (0x11/0x32/0x47), numBatons 0x01 (diffed against the
 * two-shard 0x02 template), and tx-size estimates. Does not broadcast.
 */
import { ALP_STANDARD, alpMint } from 'ecash-lib';
import {
  createSingleShardDeltaContract,
  simUdelta,
} from '../src/covenant/singleShardDeltaScript.js';
import {
  UDELTA_ECON_LEN,
  UDELTA_HEAD_LEN,
  UDELTA_PREFIX_SKIP,
  UDELTA_STATE_PUSH_LEN,
  OP,
} from '../src/covenant/singleShardDeltaMath.js';
import { wldfV4Pushdata, WLDF_VERSION_UDELTA_V3 } from '../src/covenant/singleShardDeltaMath.js';
import { expectedUdeltaMintOpReturnScript } from '../src/miner/remintSingleShard.js';

const MAX_OPS = 201;
const MAX_REDEEM = 520;

const failures: string[] = [];
function gate(cond: boolean, msg: string): void {
  if (!cond) failures.push(msg);
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
}

/** Walk opcodes, skipping push data. */
function scanOps(script: Buffer, onOp: (op: number) => void): void {
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

async function main(): Promise<void> {
  const tokenId =
    'd9004b411d4cbcd2ec16235d506efd6e266186153bd1a2b1db3a1d5118c2ca5b';
  const sim = simUdelta();
  gate(true, `depth simulator green (ops=${sim.ops} — throws otherwise)`);
  gate(sim.ops <= MAX_OPS, `ops ${sim.ops} <= ${MAX_OPS}`);

  const c0 = createSingleShardDeltaContract({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 86_400,
    genesisTarget: 2 ** 24,
    tipDay: 0,
    tipTarget: 2 ** 24,
  });
  gate(
    c0.redeem.length <= MAX_REDEEM,
    `redeem ${c0.redeem.length}B <= ${MAX_REDEEM}`,
  );

  // Executed-opcode scan of the assembled bytes (independent of the sim).
  let seps = 0;
  let mul = false;
  let intro = false;
  let staticOps = 0;
  scanOps(c0.redeem, op => {
    if (op === OP.OP_CODESEPARATOR) seps++;
    if (op === OP.OP_MUL) mul = true;
    if (op >= 0xc0 && op <= 0xcd) intro = true;
    if (op > OP.OP_16) staticOps++;
  });
  gate(seps === 1, `exactly 1 CODESEPARATOR (got ${seps})`);
  gate(!mul, 'no OP_MUL in redeem');
  gate(!intro, 'no introspection opcodes in redeem');
  gate(
    staticOps === sim.ops,
    `static op scan (${staticOps}) matches simulator (${sim.ops})`,
  );

  // Head layout: econ(83) | 0x20+prefixHash(33) | 0x08+day+target(9).
  gate(c0.redeem.length >= UDELTA_HEAD_LEN, 'redeem covers head');
  gate(
    c0.redeem[UDELTA_ECON_LEN] === 0x20,
    `prefixHash push tag 0x20 @${UDELTA_ECON_LEN}`,
  );
  const stateOff = UDELTA_ECON_LEN + UDELTA_PREFIX_SKIP;
  gate(
    c0.redeem[stateOff] === 0x08,
    `state push tag 0x08 @${stateOff}`,
  );
  gate(
    c0.redeem.readUInt32LE(stateOff + 1) === 0,
    'state day = tipDay (0)',
  );
  gate(
    c0.redeem.readUInt32LE(stateOff + 5) === 2 ** 24,
    'state target = tipTarget (2^24)',
  );
  gate(
    UDELTA_HEAD_LEN ===
      UDELTA_ECON_LEN + UDELTA_PREFIX_SKIP + UDELTA_STATE_PUSH_LEN,
    'head length identity (83+33+9)',
  );

  // State-change isolation: advance to day 1 — ONLY the 8 state bytes change.
  const stepped = 2 ** 24 - Math.floor(((2 ** 24) * 82) / 100000);
  const c1 = createSingleShardDeltaContract({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 86_400,
    genesisTarget: 2 ** 24,
    tipDay: 1,
    tipTarget: stepped,
  });
  gate(
    c1.redeem.length === c0.redeem.length,
    'ratchet preserves redeem length',
  );
  const diffs: number[] = [];
  for (let i = 0; i < c0.redeem.length; i++) {
    if (c0.redeem[i] !== c1.redeem[i]) diffs.push(i);
  }
  gate(
    diffs.length > 0 &&
      diffs.includes(stateOff + 1) &&
      diffs.every(d => d >= stateOff + 1 && d < stateOff + 9),
    `k=1 touches only state bytes [${stateOff + 1},${stateOff + 9}) (got ${diffs.length} @${diffs[0]})`,
  );
  gate(c1.address !== c0.address, `P2SH ratchets (${c1.address.slice(0, 18)}…)`);

  // eMPP / ALP encoding gates (prove covenant literals).
  const wldf = wldfV4Pushdata({
    newDay: 1,
    newTarget: stepped,
    locktime: 1_784_300_000 + 86_400,
  });
  gate(wldf.length === 0x11, `wldf len ${wldf.length} == 0x11`);
  gate(
    wldf[4] === WLDF_VERSION_UDELTA_V3 && WLDF_VERSION_UDELTA_V3 === 4,
    'wldf version byte is 0x04 (v3 states)',
  );
  const mint1 = Buffer.from(
    alpMint(tokenId, ALP_STANDARD, { atomsArray: [100n], numBatons: 1 }),
  );
  gate(mint1.length === 0x32, `mintSection len ${mint1.length} == 0x32`);
  gate(mint1[mint1.length - 1] === 0x01, 'single-shard numBatons byte is 0x01');
  const mint2 = Buffer.from(
    alpMint(tokenId, ALP_STANDARD, { atomsArray: [100n], numBatons: 2 }),
  );
  gate(
    mint2.length === mint1.length &&
      mint2[mint2.length - 1] === 0x02 &&
      mint2.subarray(0, -1).equals(mint1.subarray(0, -1)),
    'numBatons 0x01-vs-0x02 differ only in the last byte (two-shard template)',
  );
  const opret = expectedUdeltaMintOpReturnScript(tokenId, 100n, {
    newDay: 1,
    newTarget: stepped,
    locktime: 1_784_300_000 + 86_400,
  });
  gate(
    opret.bytecode.length === 0x47,
    `opReturn len ${opret.bytecode.length} == 0x47`,
  );

  // Size estimate: scriptSig ≈ pushes(nr + pk 33 + sig 65 + nonce 4 +
  // preimage ~200 + redeem) + push overhead ≈ 1.2KB; tx ≈ 1.6KB.
  const scriptSigEst =
    2 +
    c0.redeem.length +
    (1 + 33) +
    (1 + 65) +
    (1 + 4) +
    (3 + 200) +
    (3 + c0.redeem.length);
  console.log(
    JSON.stringify(
      {
        redeemBytes: c0.redeem.length,
        headroomBytes: MAX_REDEEM - c0.redeem.length,
        ops: sim.ops,
        headroomOps: MAX_OPS - sim.ops,
        maxMain: sim.maxMain,
        maxAlt: sim.maxAlt,
        scriptSigEstBytes: scriptSigEst,
        txEstBytes: scriptSigEst + 400,
        minRelayFeeEstSats: scriptSigEst + 400,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    console.error(`\nGATE FAILURES (${failures.length})`);
    process.exitCode = 1;
  } else {
    console.log('\nALL GATES PASS');
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
