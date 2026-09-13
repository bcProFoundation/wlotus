/**
 * Single-shard δ (ULOTUS) — PURE covenant definition, zero deps.
 *
 * Hand-assembled single redeem (~420B / ~169 ops) doing what the two-shard
 * experiment split across C+M: PoW + K=1 SUB-form δ derivation + WLDF v3 /
 * ALP output pins + Moore-style VERIFIED successors + schnorr auth.
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
export const UDELTA_DENOMINATOR = 100000;
/** Step cap: K=1 (matches the two-shard experiment). */
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
 *  2. newDay/k derivation + k∈{0,1} (ROLL indices verified in comments)
 *  3. δ step (always computed) + k-branch select → newTarget
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
  u.push(op(D), num(3), op(OP.OP_ROLL), op(OP.OP_SUB)); // k (newDay kept)
  u.push(op(D), num(0), op(OP.OP_GREATERTHANOREQUAL), op(OP.OP_VERIFY));
  u.push(op(D), num(1), op(OP.OP_LESSTHANOREQUAL), op(OP.OP_VERIFY));
  // [k, newDay, tipTarget, prefixHash, codeHash, mintAtoms, tokenId, ...]
  // --- phase 3: δ (82 = 64+16+2) + k-select ---
  u.push(num(2), op(OP.OP_ROLL)); // [t0, k, newDay, ...]
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
  // s1 = t0 - q, keeping t0 for the k-select: [q] → FROMALT t0, DUP,
  // ROLL q on top, SUB, SWAP → [t0, s1, k, newDay, ...]
  u.push(op(OP.OP_FROMALTSTACK), op(D));
  u.push(num(2), op(OP.OP_ROLL), op(OP.OP_SUB), op(OP.OP_SWAP));
  u.push(num(2), op(OP.OP_ROLL)); // [k, t0, s1, newDay, ...]
  // k=1 → s1 (drop top t0); k=0 → t0 (drop second s1). Arms verified
  // against VM stacks: [t0, s1] top-first — IF:DROP ELSE:NIP (the
  // intuitive IF:NIP ELSE:DROP is BACKWARDS here; caught by the VM gate).
  u.push(op(OP.OP_IF), op(OP.OP_DROP), op(OP.OP_ELSE), op(OP.OP_NIP));
  u.push(op(OP.OP_ENDIF)); // [newTarget, newDay, ...]
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
  // wldf = 574c4446.03.NDB.NTB.locktime. NDB/NTB copies are stashed for
  // the successor state check at ROLL time; locktimeDup rides the main
  // stack (never on alt here) and is ROLL-consumed last.
  u.push(hexd('574c4446'), num(3), op(OP.OP_CAT));
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
