#!/usr/bin/env tsx
/**
 * Static gates for the hand-assembled single-shard δ v5 (durable
 * generation: nBits difficulty, DIV-δ 12.00%/yr, 64-bit PoW) redeem.
 *
 * Limits: P2SH redeem ≤520B, eCash MAX_OPS_PER_SCRIPT = 201.
 * Gates: depth-simulator green, exactly one CODESEPARATOR, no OP_MUL,
 * no introspection opcodes (0xc0–0xcd are BCH-only), head layout
 * econ(85) | prefixHash push(33) | state push(10), state-change isolation
 * (slot 0 vs slot 1 AND slot 0 vs slot 7 — both differ ONLY in the 9
 * state bytes; the jump carries the same single DIV step),
 * P2SH ratchet, WLDF v6 version byte,
 * eMPP lengths (0x12/0x32/0x48), numBatons 0x01 (diffed against the
 * two-shard 0x02 template), and tx-size estimates. Does not broadcast.
 */
import { ALP_STANDARD, alpMint } from 'ecash-lib';
import { createSingleShardDeltaContractV5 } from '../src/covenant/singleShardDeltaScriptV5.js';
import { OP } from '../src/covenant/singleShardDeltaMath.js';
import {
  UDELTA_V5_DELTA_K,
  UDELTA_V5_ECON_LEN,
  UDELTA_V5_GENESIS_E_BASE,
  UDELTA_V5_GENESIS_M_BASE,
  UDELTA_V5_HEAD_LEN,
  UDELTA_V5_PREFIX_SKIP,
  UDELTA_V5_STATE_PUSH_LEN,
  WLDF_VERSION_UDELTA_V6,
  simUdeltaV5,
  wldfUdeltaV6Pushdata,
} from '../src/covenant/singleShardDeltaMathV5.js';
import { expectedUdeltaV5MintOpReturnScript } from '../src/miner/remintSingleShardV5.js';

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
  const sim = simUdeltaV5();
  gate(true, `depth simulator green (ops=${sim.ops} — throws otherwise)`);
  gate(sim.ops <= MAX_OPS, `ops ${sim.ops} <= ${MAX_OPS}`);

  const c0 = createSingleShardDeltaContractV5({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 600,
    tipDay: 0,
    m: UDELTA_V5_GENESIS_M_BASE,
    e: UDELTA_V5_GENESIS_E_BASE,
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

  // Head layout: econ(85) | 0x20+prefixHash(33) | 0x09+slot+m+e(10).
  gate(c0.redeem.length >= UDELTA_V5_HEAD_LEN, 'redeem covers head');
  gate(
    c0.redeem[UDELTA_V5_ECON_LEN] === 0x20,
    `prefixHash push tag 0x20 @${UDELTA_V5_ECON_LEN}`,
  );
  const stateOff = UDELTA_V5_ECON_LEN + UDELTA_V5_PREFIX_SKIP;
  gate(c0.redeem[stateOff] === 0x09, `state push tag 0x09 @${stateOff}`);
  gate(c0.redeem.readUInt32LE(stateOff + 1) === 0, 'state slot = tipDay (0)');
  gate(
    c0.redeem.readUInt32LE(stateOff + 5) === UDELTA_V5_GENESIS_M_BASE,
    'state m = genesisM (2^24)',
  );
  gate(
    c0.redeem[stateOff + 9] === UDELTA_V5_GENESIS_E_BASE,
    'state e = genesisE (4)',
  );
  gate(
    UDELTA_V5_HEAD_LEN ===
      UDELTA_V5_ECON_LEN + UDELTA_V5_PREFIX_SKIP + UDELTA_V5_STATE_PUSH_LEN,
    'head length identity (85+33+10)',
  );

  // State-change isolation: advance to slot 1 — ONLY the 9 state bytes change.
  // v5 DIV step: q = floor(2^24/463784) = 36 → 16777180.
  const stepped =
    UDELTA_V5_GENESIS_M_BASE -
    Math.floor(UDELTA_V5_GENESIS_M_BASE / UDELTA_V5_DELTA_K);
  gate(stepped === 16777180, `DIV step lands on 16777180 (got ${stepped})`);
  const c1 = createSingleShardDeltaContractV5({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 600,
    tipDay: 1,
    m: stepped,
    e: UDELTA_V5_GENESIS_E_BASE,
  });
  gate(c1.redeem.length === c0.redeem.length, 'ratchet preserves redeem length');
  const diffs: number[] = [];
  for (let i = 0; i < c0.redeem.length; i++) {
    if (c0.redeem[i] !== c1.redeem[i]) diffs.push(i);
  }
  gate(
    diffs.length > 0 &&
      diffs.includes(stateOff + 1) &&
      diffs.every(d => d >= stateOff + 1 && d < stateOff + 10),
    `k=1 touches only state bytes [${stateOff + 1},${stateOff + 10}) (got ${diffs.length} @${diffs[0]})`,
  );
  gate(c1.address !== c0.address, `P2SH ratchets (${c1.address.slice(0, 18)}…)`);

  // Jump isolation: slot 0 → slot 7 carries the SAME single DIV step
  // (one-step-per-block) and still touches only the 9 state bytes.
  const c7 = createSingleShardDeltaContractV5({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 600,
    tipDay: 7,
    m: stepped,
    e: UDELTA_V5_GENESIS_E_BASE,
  });
  const diffs7: number[] = [];
  for (let i = 0; i < c0.redeem.length; i++) {
    if (c0.redeem[i] !== c7.redeem[i]) diffs7.push(i);
  }
  gate(
    diffs7.length > 0 &&
      diffs7.every(d => d >= stateOff + 1 && d < stateOff + 10),
    `k=7 touches only state bytes [${stateOff + 1},${stateOff + 10}) (got ${diffs7.length} @${diffs7[0]})`,
  );
  gate(
    c7.address !== c0.address && c7.address !== c1.address,
    'jump ratchets to a third address',
  );

  // Renorm isolation: a renormalized successor (m×256, e−1) still touches
  // only the 9 state bytes (different e byte proves the e-lane works).
  const mCross = 2 ** 23 + 10;
  const qCross = Math.floor(mCross / UDELTA_V5_DELTA_K);
  const cR0 = createSingleShardDeltaContractV5({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 600,
    tipDay: 50,
    m: mCross,
    e: 4,
  });
  const cR1 = createSingleShardDeltaContractV5({
    tokenId,
    mintAtoms: 100n,
    genesisUnix: 1_784_300_000,
    daySeconds: 600,
    tipDay: 51,
    m: (mCross - qCross) * 256,
    e: 3,
  });
  const diffsR: number[] = [];
  for (let i = 0; i < cR0.redeem.length; i++) {
    if (cR0.redeem[i] !== cR1.redeem[i]) diffsR.push(i);
  }
  gate(
    diffsR.length > 0 &&
      diffsR.every(d => d >= stateOff + 1 && d < stateOff + 10),
    `renorm touches only state bytes [${stateOff + 1},${stateOff + 10}) (got ${diffsR.length} @${diffsR[0]})`,
  );
  gate(cR1.address !== cR0.address, 'renorm ratchets address');

  // eMPP / ALP encoding gates (prove covenant literals).
  const wldf = wldfUdeltaV6Pushdata({
    newDay: 1,
    newM: stepped,
    newE: UDELTA_V5_GENESIS_E_BASE,
    locktime: 1_784_300_000 + 600,
  });
  gate(wldf.length === 0x12, `wldf len ${wldf.length} == 0x12`);
  gate(
    wldf[4] === WLDF_VERSION_UDELTA_V6 && WLDF_VERSION_UDELTA_V6 === 6,
    'wldf version byte is 0x06 (v5 nBits states)',
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
  const opret = expectedUdeltaV5MintOpReturnScript(tokenId, 100n, {
    newDay: 1,
    newM: stepped,
    newE: UDELTA_V5_GENESIS_E_BASE,
    locktime: 1_784_300_000 + 600,
  });
  gate(
    opret.bytecode.length === 0x48,
    `opReturn len ${opret.bytecode.length} == 0x48`,
  );

  // Size estimate: scriptSig ≈ pushes + redeem + push overhead; tx ≈ +400B.
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
