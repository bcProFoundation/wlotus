/**
 * Single-shard δ (ULOTUS) — PURE covenant definition, zero deps.
 *
 * Hand-assembled single redeem (406B / 165 ops) doing what the two-shard
 * experiment split across C+M: PoW + miner-paced SUB-form micro-δ (v4:
 * 10-minute slots, k>=1 skip-tolerant, EXACTLY ONE micro-step per block
 * regardless of k — difficulty tracks WORK, time tracks TIME — so the v3
 * daily schedule survives as the full-utilization ceiling) + WLDF v5 /
 * ALP output pins + Moore-style VERIFIED successors + schnorr auth.
 *
 * Field pun (documented, v4): "day" fields carry SLOT indices and
 * daySeconds is the SLOT length (600). Renaming is deferred until the
 * design settles — the wire layout is unchanged (8B state).
 *
 * Deliberately imports nothing (not even ecash-lib): jest cannot load
 * ecash-lib's WASM glue, so the op list, push encoders, depth simulator,
 * and layout constants live here (jest-coverable). The ecash-lib-backed
 * P2SH assembly + scriptSig builder live in singleShardDeltaScript.ts.
 *
 * Redeem layout (Moore econ trick, state chunk 4B→9B):
 *   econHead (83B, hashed as prefixHash):
 *     0x20 tokenIdRev | 0x06 mintAtomsLe | 0x04 genesisUnixLe |
 *     0x04 daySecondsLe | 0x20 codeHash
 *   prefixHash push (33B, constant, skipped by successor check)
 *   stateChunk push (9B: 0x08 dayLe targetLe — THE STATE)
 *   code (hashed as codeHash — FIXED bytes, no params inside)
 *
 * Witness (scriptSig push order, bottom→top):
 *   nextRedeem | minerPk | s | nonce | preimage, then the redeem push.
 *
 * Stack after head (top→bottom): stateChunk, prefixHash, codeHash,
 * daySecondsLe, genesisUnixLe, mintAtomsLe, tokenIdRev, preimage, nonce,
 * s, minerPk, nextRedeem.
 */

import {
  deriveTwoShardState,
  type TwoShardDerived,
  type TwoShardGenesis,
  type TwoShardTip,
} from './twoShardMath.js';

/** Length of the hashed econ head (tokenId+mintAtoms+genesis+daySeconds+codeHash pushes). */
export const UDELTA_ECON_LEN = 83;
/** Bytes skipped after econ (the constant prefixHash push). */
export const UDELTA_PREFIX_SKIP = 33;
/** State chunk push length (0x08 dayLe targetLe). */
export const UDELTA_STATE_PUSH_LEN = 9;
/** Head total: econ + prefixHash push + state push. */
export const UDELTA_HEAD_LEN =
  UDELTA_ECON_LEN + UDELTA_PREFIX_SKIP + UDELTA_STATE_PUSH_LEN;
/** δ numerator pieces: 82 = 64 + 16 + 2 (double-and-add, no OP_MUL). */
export const UDELTA_NUMERATOR = 82;
/**
 * v4 micro-δ denominator: 14400000 = 100000 × 144 (10-min slots). One
 * step per BLOCK (not per slot): a full-cap day (144 blocks) steps
 * −0.0815%, i.e. the v3 daily schedule is the full-utilization ceiling.
 * q=95 at genesis target. WITHOUT this rescale a sprint day would step
 * −11% and brick the chain within days (δ never adjusts down).
 */
export const UDELTA_DENOMINATOR = 14400000;
/** v4 slot length in seconds (one Lotus block per eCash block, MTP-aligned). */
export const UDELTA_SLOT_SECONDS = 600;
/**
 * Advance floor v4: k>=1 per remint (skip-tolerant — no upper bound;
 * locktime≤MTP bounds k in practice). Same-slot re-mine (k=0) stays
 * forbidden (it would strictly dominate and freeze the schedule), but
 * miners may jump any number of open slots: small backlogs get backfilled
 * by profit miners (supply smoothing), deep ones get jumped (supply
 * scarcity). Difficulty is unaffected by k (one micro-step per block).
 */
export const UDELTA_K = 1;

/** eCash opcodes used by the hand-assembled redeem. */
export const OP = {
  OP_0: 0x00,
  OP_PUSHDATA1: 0x4c,
  OP_PUSHDATA2: 0x4d,
  OP_1NEGATE: 0x4f,
  OP_1: 0x51,
  OP_2: 0x52,
  OP_3: 0x53,
  OP_4: 0x54,
  OP_5: 0x55,
  OP_6: 0x56,
  OP_7: 0x57,
  OP_8: 0x58,
  OP_9: 0x59,
  OP_16: 0x60,
  OP_IF: 0x63,
  OP_ELSE: 0x67,
  OP_ENDIF: 0x68,
  OP_VERIFY: 0x69,
  OP_TOALTSTACK: 0x6b,
  OP_FROMALTSTACK: 0x6c,
  OP_2DUP: 0x6e,
  OP_DROP: 0x75,
  DUP: 0x76,
  OP_DUP: 0x76,
  OP_NIP: 0x77,
  OP_OVER: 0x78,
  OP_ROLL: 0x7a,
  OP_PICK: 0x79,
  OP_ROT: 0x7b,
  OP_SWAP: 0x7c,
  OP_CAT: 0x7e,
  OP_SPLIT: 0x7f,
  OP_NUM2BIN: 0x80,
  OP_BIN2NUM: 0x81,
  OP_SIZE: 0x82,
  OP_EQUALVERIFY: 0x88,
  OP_ADD: 0x93,
  OP_SUB: 0x94,
  OP_MUL: 0x95,
  OP_DIV: 0x96,
  OP_LESSTHAN: 0x9f,
  OP_GREATERTHANOREQUAL: 0xa2,
  OP_LESSTHANOREQUAL: 0xa1,
  OP_SHA256: 0xa8,
  OP_HASH160: 0xa9,
  OP_HASH256: 0xaa,
  OP_CODESEPARATOR: 0xab,
  OP_CHECKSIG: 0xac,
} as const;

/** One assembled unit: raw opcode, minimal script-number push, or data push. */
export type AsmUnit =
  | { op: number }
  | { num: number }
  | { data: Uint8Array };

export const op = (op: number): AsmUnit => ({ op });
export const num = (num: number): AsmUnit => ({ num });
export const data = (data: Uint8Array): AsmUnit => ({ data });
export const hexd = (hex: string): AsmUnit => ({
  data: new Uint8Array(Buffer.from(hex, 'hex')),
});

/** Minimal-encode a non-negative script number push. */
export function encodeNum(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`encodeNum needs non-negative int, got ${n}`);
  }
  if (n === 0) return new Uint8Array([OP.OP_0]);
  if (n <= 16) return new Uint8Array([OP.OP_1 + n - 1]);
  const bytes: number[] = [];
  let v = n;
  while (v > 0) {
    bytes.push(v & 0xff);
    v = Math.floor(v / 256);
  }
  if (bytes[bytes.length - 1]! & 0x80) bytes.push(0x00);
  return new Uint8Array([bytes.length, ...bytes]);
}

/** Minimal-encode a data push (direct / PUSHDATA1 / PUSHDATA2). */
export function encodePush(payload: Uint8Array): Uint8Array {
  const n = payload.length;
  if (n <= 75) return new Uint8Array([n, ...payload]);
  if (n <= 0xff) return new Uint8Array([OP.OP_PUSHDATA1, n, ...payload]);
  if (n <= 0xffff) {
    return new Uint8Array([
      OP.OP_PUSHDATA2,
      n & 0xff,
      (n >>> 8) & 0xff,
      ...payload,
    ]);
  }
  throw new Error(`push too large: ${n} bytes`);
}

/** Assemble an op list to raw script bytes. */
export function assemble(units: AsmUnit[]): Uint8Array {
  const parts: Uint8Array[] = [];
  let len = 0;
  for (const u of units) {
    let b: Uint8Array;
    if ('op' in u) b = new Uint8Array([u.op]);
    else if ('num' in u) b = encodeNum(u.num);
    else b = encodePush(u.data);
    parts.push(b);
    len += b.length;
  }
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * The hand-assembled redeem CODE (fixed bytes — every param arrives via
 * the stack). Phases:
 *  1. preimage tail → stash powcommit + hashOutputs + locktime
 *  2. newSlot/k derivation + k>=1 FLOOR (v4: skip-tolerant — miners may
 *     jump any number of open slots; k=0 same-slot re-mine stays dead)
 *  3. micro-δ (exactly one step, always, regardless of k) → newTarget = s1
 *  4. PoW head∈[0,newTarget)
 *  5. WLDF v3 + ALP MINT pins, out0..out2 concat
 *  6. successor verify (econ hash + 9B state + code hash)
 *  7. CODESEPARATOR + hashOutputs pin + bare CHECKSIG (TRUE on top)
 */
export function udeltaCodeUnits(): AsmUnit[] {
  const D = OP.DUP;
  const u: AsmUnit[] = [];
  // --- phase 1: preimage (index 7 under the 7 head pushes) ---
  u.push(num(7), op(OP.OP_ROLL)); // [pre, ...]
  u.push(op(D), op(OP.OP_SHA256), op(OP.OP_TOALTSTACK)); // alt: powcommit
  // tail40 = last 40 bytes (hashOutputs + locktime + sighashType). The DUP
  // leaves the ORIGINAL preimage under the split products, so two NIPs are
  // needed (drop head, drop original) — one NIP strands a ~200B preimage
  // on the stack and shifts every downstream index (caught by the VM gate).
  u.push(op(D), op(OP.OP_SIZE), num(40), op(OP.OP_SUB), op(OP.OP_SPLIT));
  u.push(op(OP.OP_NIP), op(OP.OP_NIP)); // [tail40]
  u.push(num(32), op(OP.OP_SPLIT)); // [hashOutputs, tail8]
  u.push(op(OP.OP_SWAP), op(OP.OP_TOALTSTACK)); // alt: hashOutputs
  u.push(num(4), op(OP.OP_SPLIT), op(OP.OP_DROP)); // [locktime]
  u.push(op(OP.OP_TOALTSTACK)); // alt: locktime, hashOutputs, powcommit
  // --- phase 2: derivation ---
  // NOTE (hand-assembly lesson): arithmetic operands must be VALID SCRIPT
  // NUMBERS (minimal encoding). SPLIT outputs and head pushes are raw
  // bytes (tipDay=0 is `00000000`, daySeconds ends 0x00) — every one
  // entering arithmetic goes through OP_BIN2NUM first (what Spedn's
  // bin2num() compiles to; skipped by hand = "requires a valid VM Number").
  u.push(num(4), op(OP.OP_SPLIT)); // stateChunk → [tipTarget, tipDay]
  u.push(op(OP.OP_BIN2NUM)); // tipTarget → number
  u.push(op(OP.OP_SWAP), op(OP.OP_BIN2NUM), op(OP.OP_SWAP)); // tipDay → number
  u.push(op(OP.OP_FROMALTSTACK)); // [locktime, tipTarget, tipDay, ...]
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash locktime BYTES copy for WLDF
  u.push(op(OP.OP_BIN2NUM)); // locktime → number
  u.push(num(6), op(OP.OP_ROLL), op(OP.OP_BIN2NUM), op(OP.OP_SUB));
  u.push(num(5), op(OP.OP_ROLL), op(OP.OP_BIN2NUM), op(OP.OP_DIV)); // newDay
  u.push(op(D), num(3), op(OP.OP_ROLL), op(OP.OP_SUB)); // k (newSlot kept)
  // v4: k >= 1 FLOOR ([k] → push 1 → [1,k] → GTE: second(k) >= top(1)).
  // NO SWAP: GTE compares second-to-top >= top (like the proven PoW
  // LESSTHAN compares second < top) — [k,1] would test 1>=k (the VM
  // gate caught exactly this: k=1 passed symmetrically, k=7 failed).
  // Skip-tolerant: any forward jump is legal (backlog policy is the
  // miners' business — backfill for revenue, jump for scarcity). k=0
  // (same-slot re-mine) stays forbidden: always-available + same reward
  // would strictly dominate and freeze the schedule.
  u.push(num(1), op(OP.OP_GREATERTHANOREQUAL));
  u.push(op(OP.OP_VERIFY));
  // [newSlot, tipTarget, prefixHash, codeHash, mintAtoms, tokenId, ...]
  // --- phase 3: δ (82 = 64+16+2), exactly one step → s1 ---
  u.push(num(1), op(OP.OP_ROLL)); // [t0, newDay, ...]
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash t0
  u.push(op(D), op(OP.OP_ADD)); // t2
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash t2
  u.push(op(D), op(OP.OP_ADD)); // t4
  u.push(op(D), op(OP.OP_ADD)); // t8
  u.push(op(D), op(OP.OP_ADD)); // t16
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash t16
  u.push(op(D), op(OP.OP_ADD)); // t32
  u.push(op(D), op(OP.OP_ADD)); // t64
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_ADD)); // t64+t16
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_ADD)); // t82
  u.push(num(UDELTA_DENOMINATOR), op(OP.OP_DIV)); // q
  // s1 = t0 - q: [q] → FROMALT t0 → [t0, q] → SWAP → [q, t0] → SUB.
  // No k-select in v3 (k==1 always): newTarget is unconditionally s1.
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_SWAP), op(OP.OP_SUB));
  // [newTarget, newDay, ...]
  // --- phase 4: PoW ---
  // alt: [locktimeDup, hashOutputs, powcommit] → want powcommit on main.
  // hashOutputs goes back to alt; locktimeDup STAYS ON MAIN (below
  // powcommit) — restoring it to alt buries it under the phase-5 NDB/NTB
  // stash, and wldf would FROMALT the wrong item (caught by the VM gate).
  // Main order below is unchanged downstream: L rides under NT/ND and is
  // ROLL-consumed at exactly the point the old FROMALT stood.
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_FROMALTSTACK));
  u.push(op(OP.OP_FROMALTSTACK)); // [powcommit, hashOutputs, locktimeDup]
  u.push(num(1), op(OP.OP_ROLL), op(OP.OP_TOALTSTACK)); // hashOutputs back
  // [powcommit, locktimeDup, newTarget, newDay, prefixHash, codeHash,
  //  mintAtoms, tokenId, nonce, s, minerPk, nextRedeem]
  u.push(num(8), op(OP.OP_ROLL)); // nonce (index 8: locktimeDup rides below)
  u.push(op(OP.OP_CAT), op(OP.OP_HASH256)); // solhash
  // SPLIT pushes l then r (r on top): head is second → DROP the rest.
  u.push(num(4), op(OP.OP_SPLIT), op(OP.OP_DROP)); // head (bytes)
  u.push(op(OP.OP_BIN2NUM)); // head → number (hash bytes are arbitrary)
  u.push(op(D), num(0), op(OP.OP_GREATERTHANOREQUAL), op(OP.OP_VERIFY));
  // head < newTarget, newTarget kept. locktimeDup rides at index 1, so
  // OVER would copy it (and the check would pass against the locktime
  // instead of the target — caught by the VM gate): PICK 2 copies
  // newTarget directly on top ([b=NT, a=head], no SWAP — a SWAP here
  // inverts the comparison; also caught by the VM gate).
  u.push(num(2), op(OP.OP_PICK), op(OP.OP_LESSTHAN));
  u.push(op(OP.OP_VERIFY));
  // [Ldup, NT, ND] → [NT, ND, Ldup]. NOTE ROT direction: OP_ROT moves
  // the 3RD item to the top ([x1,x2,x3] → [x3,x1,x2]), so one ROT gives
  // [ND, Ldup, NT] (wrong — caught by the VM gate) and two ROTs give
  // [NT, ND, Ldup] (right).
  u.push(op(OP.OP_ROT), op(OP.OP_ROT)); // [NT, ND, Ldup, ...]
  // --- phase 5: pins ---
  // 4-byte LE encodings: [NT, ND] → NUM2BIN converts the TOP-adjacent
  // item, so convert NT first (no leading SWAP), then SWAP and convert
  // ND → [NDB, NTB]. (A leading SWAP yields [NTB, NDB] — swapped day and
  // target in WLDF and in the successor check; caught by the VM gate.)
  u.push(num(4), op(OP.OP_NUM2BIN)); // NT → NTB ([NTB, ND])
  u.push(op(OP.OP_SWAP), num(4), op(OP.OP_NUM2BIN)); // ND → NDB ([NDB, NTB])
  // wldf = 574c4446.05.NDB.NTB.locktime (v5: miner-paced slot states;
  // v4-attested days were k==1-only, v5 slots are k>=1). NDB/NTB copies
  // are stashed for the successor state check at ROLL time; locktimeDup
  // rides the main stack (never on alt here) and is ROLL-consumed last.
  u.push(hexd('574c4446'), num(5), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL)); // NDB
  u.push(op(D), op(OP.OP_TOALTSTACK), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL)); // NTB
  u.push(op(D), op(OP.OP_TOALTSTACK), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL), op(OP.OP_CAT)); // locktimeDup
  // mint = SLP2.00.04.MINT.tokenId.01.mintAtoms.01(numBatons=1)
  // WARNING (genesis 1–3 lesson): the 0x00 ALP version byte is pushed as
  // `01 00`, NEVER bare OP_0 (empty push drops the byte).
  u.push(hexd('534c5032'), hexd('00'), op(OP.OP_CAT));
  u.push(num(4), op(OP.OP_CAT));
  u.push(hexd('4d494e54'), op(OP.OP_CAT));
  u.push(num(5), op(OP.OP_ROLL), op(OP.OP_CAT)); // tokenId
  u.push(num(1), op(OP.OP_CAT));
  u.push(num(4), op(OP.OP_ROLL), op(OP.OP_CAT)); // mintAtoms
  u.push(num(1), op(OP.OP_CAT)); // numBatons = 1 (single baton)
  // opReturn = 6a50.11.wldf.32.mint
  u.push(hexd('6a50'), hexd('11'), op(OP.OP_CAT));
  u.push(num(2), op(OP.OP_ROLL), op(OP.OP_CAT)); // wldf
  u.push(hexd('32'), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL), op(OP.OP_CAT)); // mint
  // out0 = Z8.47.opReturn
  u.push(hexd('0000000000000000'), hexd('47'), op(OP.OP_CAT));
  u.push(op(OP.OP_SWAP), op(OP.OP_CAT));
  // out1 = dust.19.76a914.H160(minerPk).88ac
  u.push(hexd('2202000000000000'), hexd('19'), op(OP.OP_CAT));
  u.push(hexd('76a914'), op(OP.OP_CAT));
  u.push(num(5), op(OP.OP_ROLL)); // minerPk
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash minerPk copy for CHECKSIG
  u.push(op(OP.OP_HASH160), op(OP.OP_CAT));
  u.push(hexd('88ac'), op(OP.OP_CAT));
  // out2 = dust.17.a914.H160(nextRedeem).87 (THE baton)
  u.push(hexd('2202000000000000'), hexd('17'), op(OP.OP_CAT));
  u.push(hexd('a914'), op(OP.OP_CAT));
  u.push(num(6), op(OP.OP_ROLL)); // nextRedeem
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash for successor verify
  // [h, p] → CAT gives p.h directly (b=top=h, a=p); a SWAP here would
  // build h.p and strand the hash outside the frame (caught by the VM gate).
  u.push(op(OP.OP_HASH160), op(OP.OP_CAT));
  u.push(hexd('87'), op(OP.OP_CAT));
  // concat = out0.out1.out2. CAT pops b=top, a=second: [out2,out1,out0]
  // → CAT gives [out1.out2, out0] = [b=out1.out2, a=out0] already, so a
  // second CAT yields out0.out1.out2 directly — a SWAP here builds
  // out1.out2.out0 instead (caught by the VM gate; all three outputs
  // were byte-perfect, only the concat order was wrong).
  u.push(op(OP.OP_CAT), op(OP.OP_CAT));
  // --- phase 6: successor verify (BEFORE the separator: scriptCode stays tiny)
  // main: [concat, prefixHash, codeHash, s]; alt: [nr, mpk, ND, NT, hashOutputs]
  u.push(op(OP.OP_FROMALTSTACK)); // nr
  u.push(num(UDELTA_ECON_LEN), op(OP.OP_SPLIT)); // [econ, rest]
  u.push(op(OP.OP_SWAP), op(OP.OP_SHA256)); // econHash (SPLIT leaves r on top)
  u.push(num(3), op(OP.OP_ROLL), op(OP.OP_EQUALVERIFY)); // econ == prefixHash
  u.push(num(UDELTA_PREFIX_SKIP), op(OP.OP_SPLIT), op(OP.OP_NIP));
  u.push(num(UDELTA_STATE_PUSH_LEN), op(OP.OP_SPLIT)); // [state', code]
  u.push(op(OP.OP_SWAP), op(OP.OP_TOALTSTACK)); // park state'
  u.push(op(OP.OP_SHA256));
  u.push(num(2), op(OP.OP_ROLL), op(OP.OP_EQUALVERIFY)); // code == codeHash
  u.push(op(OP.OP_FROMALTSTACK)); // state'
  // Alt is [mpk, NTB, NDB, hashOutputs]: minerPk (parked for the phase-7
  // CHECKSIG) sits above the state bytes — bring it along and put it
  // back. [mpk, NTB, NDB] → ROLL mpk home → [NDB, NTB] → SWAP.
  u.push(op(OP.OP_FROMALTSTACK)); // mpk
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_FROMALTSTACK)); // NTB, NDB
  u.push(num(2), op(OP.OP_ROLL), op(OP.OP_TOALTSTACK)); // mpk back to alt
  u.push(op(OP.OP_SWAP));
  // expected = 08.NDB.NTB via push-08 ROT CAT SWAP CAT
  u.push(num(8), op(OP.OP_ROT), op(OP.OP_CAT));
  u.push(op(OP.OP_SWAP), op(OP.OP_CAT));
  u.push(op(OP.OP_EQUALVERIFY)); // state' == expected
  // --- phase 7: separator + pins + auth (bare CHECKSIG leaves TRUE) ---
  u.push(op(OP.OP_CODESEPARATOR));
  u.push(op(OP.OP_HASH256));
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_FROMALTSTACK)); // mpk, hashOutputs
  u.push(num(2), op(OP.OP_ROLL)); // concatH → [concatH, hashOutputs, mpk, s]
  u.push(op(OP.OP_EQUALVERIFY));
  u.push(op(OP.OP_CHECKSIG)); // [TRUE] — no trailing VERIFY (empty stack fails)
  return u;
}

/** Net main/alt stack-depth effect per opcode (VERIFY-style consume). */
const DEPTH: Record<number, [main: number, alt: number]> = {
  [OP.OP_TOALTSTACK]: [-1, 1],
  [OP.OP_FROMALTSTACK]: [1, -1],
  [OP.OP_IF]: [-1, 0],
  [OP.OP_ELSE]: [0, 0],
  [OP.OP_ENDIF]: [0, 0],
  [OP.OP_VERIFY]: [-1, 0],
  [OP.OP_2DUP]: [2, 0],
  [OP.OP_DROP]: [-1, 0],
  [OP.OP_DUP]: [1, 0],
  [OP.OP_NIP]: [-1, 0],
  [OP.OP_OVER]: [1, 0],
  [OP.OP_ROLL]: [-1, 0],
  [OP.OP_PICK]: [0, 0],
  [OP.OP_ROT]: [0, 0],
  [OP.OP_SWAP]: [0, 0],
  [OP.OP_CAT]: [-1, 0],
  [OP.OP_SPLIT]: [0, 0],
  [OP.OP_NUM2BIN]: [-1, 0],
  [OP.OP_BIN2NUM]: [0, 0],
  [OP.OP_SIZE]: [1, 0],
  [OP.OP_EQUALVERIFY]: [-2, 0],
  [OP.OP_ADD]: [-1, 0],
  [OP.OP_SUB]: [-1, 0],
  [OP.OP_DIV]: [-1, 0],
  [OP.OP_LESSTHAN]: [-1, 0],
  [OP.OP_GREATERTHANOREQUAL]: [-1, 0],
  [OP.OP_LESSTHANOREQUAL]: [-1, 0],
  [OP.OP_SHA256]: [0, 0],
  [OP.OP_HASH160]: [0, 0],
  [OP.OP_HASH256]: [0, 0],
  [OP.OP_CODESEPARATOR]: [0, 0],
  [OP.OP_CHECKSIG]: [-1, 0],
};

/**
 * Simulate main/alt stack depths over the code. Asserts: no underflow,
 * ROLL indices in range (checked against the live depth at each ROLL),
 * exactly one CODESEPARATOR, and final depth main=1/alt=0 (TRUE on top).
 * IF/ELSE branches are simulated SEPARATELY (linear application would
 * double-count the branch effects) and must converge to equal depths.
 * Returns consensus op count (opcode > OP_16).
 */
export function simulateUdeltaCode(
  units: AsmUnit[],
  mainStart: number,
): { ops: number; maxMain: number; maxAlt: number } {
  // Op/separator counts are STATIC: consensus charges opcode > OP_16 for
  // every unit in the walk, including unexecuted IF arms.
  let ops = 0;
  let seps = 0;
  for (const u of units) {
    if (!('op' in u)) continue;
    if (u.op === OP.OP_CODESEPARATOR) seps++;
    if (u.op > OP.OP_16) ops++;
  }
  // Depths need branch-aware simulation (linear application would
  // double-count the taken arm's effects).
  let main = mainStart;
  let alt = 0;
  let maxMain = main;
  let maxAlt = 0;
  const apply = (u: AsmUnit, i: number): void => {
    if ('num' in u || 'data' in u) {
      main++;
      maxMain = Math.max(maxMain, main);
      return;
    }
    if (u.op === OP.OP_ROLL || u.op === OP.OP_PICK) {
      const prev = units[i - 1];
      if (!prev || !('num' in prev)) {
        throw new Error(
          `ROLL/PICK at unit ${i} not preceded by a num push`,
        );
      }
      if (prev.num < 0 || prev.num > main - 2) {
        throw new Error(
          `ROLL/PICK ${prev.num} out of range at unit ${i} (main=${main})`,
        );
      }
    }
    const d = DEPTH[u.op];
    if (d === undefined) throw new Error(`unknown opcode 0x${u.op.toString(16)}`);
    main += d[0];
    alt += d[1];
    if (main < 0) throw new Error(`main stack underflow at unit ${i}`);
    if (alt < 0) throw new Error(`alt stack underflow at unit ${i}`);
    maxMain = Math.max(maxMain, main);
    maxAlt = Math.max(maxAlt, alt);
  };
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if ('op' in u && u.op === OP.OP_IF) {
      // Single non-nested IF/ELSE/ENDIF: simulate both arms from the
      // post-condition depth and require convergence.
      let elseIdx = -1;
      let endifIdx = -1;
      for (let j = i + 1; j < units.length; j++) {
        const v = units[j]!;
        if ('op' in v && v.op === OP.OP_IF) {
          throw new Error('nested IF not supported by the simulator');
        }
        if ('op' in v && v.op === OP.OP_ELSE) elseIdx = j;
        if ('op' in v && v.op === OP.OP_ENDIF) {
          endifIdx = j;
          break;
        }
      }
      if (elseIdx < 0 || endifIdx < 0) {
        throw new Error(`IF at unit ${i} missing ELSE/ENDIF`);
      }
      main--; // IF consumes the condition
      if (main < 0) throw new Error(`main stack underflow at IF ${i}`);
      const arm = (from: number, to: number): [number, number] => {
        const savedMain = main;
        const savedAlt = alt;
        for (let j = from; j < to; j++) apply(units[j]!, j);
        const out: [number, number] = [main, alt];
        main = savedMain;
        alt = savedAlt;
        return out;
      };
      const [thenMain, thenAlt] = arm(i + 1, elseIdx);
      const [elseMain, elseAlt] = arm(elseIdx + 1, endifIdx);
      if (thenMain !== elseMain || thenAlt !== elseAlt) {
        throw new Error(
          `IF arms diverge at unit ${i}: then=(${thenMain},${thenAlt}) else=(${elseMain},${elseAlt})`,
        );
      }
      main = thenMain;
      alt = thenAlt;
      i = endifIdx;
      continue;
    }
    apply(u, i);
  }
  if (seps !== 1) throw new Error(`expected exactly 1 CODESEPARATOR, got ${seps}`);
  if (main !== 1) throw new Error(`final main depth ${main} != 1 (TRUE on top)`);
  if (alt !== 0) throw new Error(`final alt depth ${alt} != 0`);
  return { ops, maxMain, maxAlt };
}

/**
 * WLDF versions attested by single-shard states (own sequence, distinct
 * from the covenant versions: v4 = k==1-only days, v5 = miner-paced slots).
 */
export const WLDF_VERSION_UDELTA_V4 = 4;
export const WLDF_VERSION_UDELTA_V5 = 5;
const WLDF_LOKAD = new TextEncoder().encode('WLDF');

function u32LeBytes(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n >= 0x80000000) {
    throw new Error(`wldf field out of Script-safe u32 range: ${n}`);
  }
  const v = n >>> 0;
  return new Uint8Array([
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ]);
}

/**
 * 17-byte WLDF push: LOKAD | version | slot u32 | target u32 | locktime u32.
 * (v4 kept for VLOTUS history; miners build v5.)
 */
export function wldfUdeltaPushdata(
  state: {
    newDay: number;
    newTarget: number;
    locktime: number;
  },
  version: number,
): Uint8Array {
  if (
    version !== WLDF_VERSION_UDELTA_V4 &&
    version !== WLDF_VERSION_UDELTA_V5
  ) {
    throw new Error(`unknown single-shard WLDF version: ${version}`);
  }
  const out = new Uint8Array(17);
  out.set(WLDF_LOKAD, 0);
  out[4] = version;
  out.set(u32LeBytes(state.newDay), 5);
  out.set(u32LeBytes(state.newTarget), 9);
  out.set(u32LeBytes(state.locktime), 13);
  return out;
}

/**
 * v3 state derivation: SUB-form δ + EXACTLY k=1. Same-day (k=0) and
 * multi-day (k≥2) locktimes are rejected — the miner fails fast instead
 * of building a tx the covenant will reject.
 */
export function deriveUdeltaV3(
  genesis: TwoShardGenesis,
  tip: TwoShardTip,
  locktime: number,
): TwoShardDerived {
  const d = deriveTwoShardState(genesis, tip, locktime);
  if (d.steps !== 1) {
    throw new Error(
      `v3 requires exactly k=1 (tipDay ${tip.tipDay} → locktime day ${d.newDay}, steps=${d.steps}); same-day k=0 is forbidden`,
    );
  }
  return d;
}

/**
 * v4 state derivation: miner-paced slots. k>=1 (skip-tolerant — stale
 * slots are jumped, miners decide backfill-vs-jump), EXACTLY ONE micro-δ
 * step per block regardless of k (difficulty tracks WORK, time tracks
 * TIME — what makes idle/backlog non-toxic). Cannot reuse
 * deriveTwoShardState (K=1 cap + k-stepped target); the SUB form is
 * mirrored with the v4 denominator.
 *
 * Field pun (documented): reuses TwoShard* types with "day" = slot index
 * and daySeconds = slot length (600). Wire layout unchanged (8B state).
 */
export function deriveUdeltaV4(
  genesis: TwoShardGenesis,
  tip: TwoShardTip,
  locktime: number,
): TwoShardDerived {
  if (!Number.isInteger(locktime) || locktime < 0 || locktime >= 0x80000000) {
    throw new Error(`locktime out of Script-safe u32 range: ${locktime}`);
  }
  if (genesis.daySeconds <= 0) throw new Error('daySeconds must be positive');
  if (!Number.isInteger(tip.target) || tip.target <= 0) {
    throw new Error(`tip target must be a positive int, got ${tip.target}`);
  }
  const newDay = Math.floor(
    (locktime - genesis.genesisUnix) / genesis.daySeconds,
  );
  const steps = newDay - tip.tipDay;
  if (steps < 1) {
    throw new Error(
      `v4 requires k>=1 (tip slot ${tip.tipDay} → locktime slot ${newDay}, steps=${steps}); same-slot re-mine is forbidden`,
    );
  }
  const newTarget =
    tip.target -
    Math.floor((tip.target * UDELTA_NUMERATOR) / UDELTA_DENOMINATOR);
  return {
    tipDay: tip.tipDay,
    target: tip.target,
    newDay,
    newTarget,
    steps,
    locktime,
  };
}
