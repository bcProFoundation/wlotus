/**
 * Single-shard δ v5 (durable generation) — nBits-style difficulty.
 *
 * v4's 32-bit integer target capped the design twice: the q-floor froze
 * Estimations (15-year fuse for ELOTUS, pre-installed for GLOTUS) and no
 * rescale could buy durability (logarithmic lifespan under any fixed
 * schedule). v5 answers with representation, not rate-chasing:
 *
 * - Threshold T = m × 256^e (mantissa m ∈ [2^23, 2^31), exponent e ∈
 *   [0,4]) — Bitcoin-nBits-shaped, byte-aligned for Script.
 * - DIV-δ: q = m // 463784 (EXACT 12.00%/yr: (1−1/K)^52560 = 1/1.12),
 *   one step per BLOCK (work-proportional, pacing-neutral, idle-safe),
 *   one-way (never falls — the elastic scarcity commitment).
 * - Renormalize when m < 2^23 (and e > 0): m×256 via zero-prepend CAT
 *   (byte shift, no MUL), e−1. Single step per crossing (q ≤ 4630 «
 *   window — the landing always re-normalizes, proven in tests).
 * - TERMINAL HALT: q == 0 is consensus-INVALID (VERIFY q). When steps
 *   quantize to zero the mine is exhausted: no successor exists, the
 *   baton becomes dust, supply freezes, the token goes legacy (still
 *   transferable + swappable — a finished series, not trash). Fuse:
 *   ~227 years base / ~166 grand at full cap.
 * - 64-bit PoW: u64 head < u64 threshold, halves-compared (hi direct,
 *   lo via XOR order-flip — top-bit-safe without shifts).
 * - k>=1 skip-tolerant slots (600s), WLDF v6, ALP pins, schnorr auth,
 *   verified successors — carried from v4 unchanged in spirit.
 *
 * v4 files stay byte-identical (ELOTUS/GLOTUS live on them); everything
 * v5 lives here + ScriptV5/minerV5/scripts-v5. Shared helpers (assemble,
 * num/op/data/hexd, simulateUdeltaCode) are reused; the OP enum + DEPTH
 * table gained only additive entries (XOR/EQUAL/MOD/BOOLAND).
 */
import {
  OP,
  assemble,
  data,
  hexd,
  num,
  op,
  simulateUdeltaCode,
  type AsmUnit,
} from './singleShardDeltaMath.js';

/** v5 slot length in seconds (one Lotus block per eCash block, MTP-aligned). */
export const UDELTA_V5_SLOT_SECONDS = 600;
/**
 * v5 DIV-δ constant: q = m // 463784 ⟺ EXACT 12.00%/yr tightening
 * ((1−1/463784)^52560 = 1/1.12 to 5e-8 — best integer K). Single DIV.
 */
export const UDELTA_V5_DELTA_K = 463784;
/** Renormalize trigger: m < 2^23 (m×256 then stays < 2^31, always valid). */
export const UDELTA_V5_M_NORM_MIN = 2 ** 23;
/** v5 exponent range [0,4] (T < 2^63 always — top bit clear for PoW). */
export const UDELTA_V5_E_MIN = 0;
export const UDELTA_V5_E_MAX = 4;
/** v5 genesis (base scale): T = 2^24 × 256^4 = 2^56 (P = 2^-8). */
export const UDELTA_V5_GENESIS_M_BASE = 2 ** 24;
export const UDELTA_V5_GENESIS_E_BASE = 4;
/** v5 genesis (grand scale): T = 2^30 × 256^2 = 2^46 (P = 2^-18). */
export const UDELTA_V5_GENESIS_M_GRAND = 2 ** 30;
export const UDELTA_V5_GENESIS_E_GRAND = 2;
/** v5 econ head length: tokenId01(34) + mintAtoms01(8) + genesis(5) + daySec(5) + codeHash(33). */
export const UDELTA_V5_ECON_LEN = 85;
/** Bytes skipped after econ (the constant prefixHash push). */
export const UDELTA_V5_PREFIX_SKIP = 33;
/** State chunk push length (0x09 slotLe mLe eByte). */
export const UDELTA_V5_STATE_PUSH_LEN = 10;
/** Head total: econ + prefixHash push + state push. */
export const UDELTA_V5_HEAD_LEN =
  UDELTA_V5_ECON_LEN + UDELTA_V5_PREFIX_SKIP + UDELTA_V5_STATE_PUSH_LEN;
/** WLDF v6: nBits states (slot + m + e). */
export const WLDF_VERSION_UDELTA_V6 = 6;

export interface UdeltaV5Tip {
  tipDay: number;
  m: number;
  e: number;
}

export interface UdeltaV5Genesis {
  genesisUnix: number;
  daySeconds: number;
}

export interface UdeltaV5Derived extends UdeltaV5Tip {
  newDay: number;
  newM: number;
  newE: number;
  steps: number;
  locktime: number;
}

/** Off-chain threshold: T = m × 256^e as bigint (miner + gates). */
export function thresholdU64(m: number, e: number): bigint {
  if (!Number.isInteger(m) || m < 1 || m >= 2 ** 31) {
    throw new Error(`mantissa out of range: ${m}`);
  }
  if (!Number.isInteger(e) || e < 0 || e > UDELTA_V5_E_MAX) {
    throw new Error(`exponent out of range: ${e}`);
  }
  return BigInt(m) * 256n ** BigInt(e);
}

/**
 * v5 state derivation: DIV-δ + renormalize + TERMINAL HALT. k>=1 (jumps
 * destroy passed slots — the behavioral throttle lives here, off-chain).
 * Throws HALT when q == 0 (no valid successor exists — mine exhausted).
 */
export function deriveUdeltaV5(
  genesis: UdeltaV5Genesis,
  tip: UdeltaV5Tip,
  locktime: number,
): UdeltaV5Derived {
  if (!Number.isInteger(locktime) || locktime < 0 || locktime >= 0x80000000) {
    throw new Error(`locktime out of Script-safe u32 range: ${locktime}`);
  }
  if (genesis.daySeconds <= 0) throw new Error('daySeconds must be positive');
  if (!Number.isInteger(tip.m) || tip.m < 1 || tip.m >= 2 ** 31) {
    throw new Error(`tip mantissa must be in [1, 2^31), got ${tip.m}`);
  }
  if (
    !Number.isInteger(tip.e) ||
    tip.e < UDELTA_V5_E_MIN ||
    tip.e > UDELTA_V5_E_MAX
  ) {
    throw new Error(`tip exponent must be in [0, 4], got ${tip.e}`);
  }
  const newDay = Math.floor(
    (locktime - genesis.genesisUnix) / genesis.daySeconds,
  );
  const steps = newDay - tip.tipDay;
  if (steps < 1) {
    throw new Error(
      `v5 requires k>=1 (tip slot ${tip.tipDay} → locktime slot ${newDay}, steps=${steps}); same-slot re-mine is forbidden`,
    );
  }
  const q = Math.floor(tip.m / UDELTA_V5_DELTA_K);
  if (q === 0) {
    throw new Error(
      `HALT: mantissa ${tip.m} below quantization (q=0) — mine exhausted, no successor exists (legacy)`,
    );
  }
  const m1 = tip.m - q;
  let newM = m1;
  let newE = tip.e;
  if (m1 < UDELTA_V5_M_NORM_MIN && tip.e > UDELTA_V5_E_MIN) {
    newM = m1 * 256;
    newE = tip.e - 1;
  }
  if (newM < 1 || newM >= 2 ** 31) {
    throw new Error(`derived mantissa out of range: ${newM}`);
  }
  return {
    tipDay: tip.tipDay,
    m: tip.m,
    e: tip.e,
    newDay,
    newM,
    newE,
    steps,
    locktime,
  };
}

/**
 * v5 treadmill step for the econ sims (float-safe covenant mirror):
 * t − floor(t/463784). Magnitude-free (sim tracks ratios only).
 */
export function microStepV5(t: number): number {
  return t - Math.floor(t / UDELTA_V5_DELTA_K);
}

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
 * 18-byte WLDF v6 push: LOKAD | version=6 | slot u32 | m u32 | e u8 |
 * locktime u32.
 */
export function wldfUdeltaV6Pushdata(state: {
  newDay: number;
  newM: number;
  newE: number;
  locktime: number;
}): Uint8Array {
  if (
    !Number.isInteger(state.newE) ||
    state.newE < UDELTA_V5_E_MIN ||
    state.newE > UDELTA_V5_E_MAX
  ) {
    throw new Error(`wldf v6 exponent out of range: ${state.newE}`);
  }
  const out = new Uint8Array(18);
  out.set(WLDF_LOKAD, 0);
  out[4] = WLDF_VERSION_UDELTA_V6;
  out.set(u32LeBytes(state.newDay), 5);
  out.set(u32LeBytes(state.newM), 9);
  out[13] = state.newE;
  out.set(u32LeBytes(state.locktime), 14);
  return out;
}

/**
 * The v5 redeem CODE (fixed bytes). Stack convention in comments is
 * TOP-FIRST ([top, second, ...]). Phases:
 *  1. preimage tail → stash powcommit + hashOutputs + locktime (v4 copy)
 *  2. slot/m/e parse + newSlot/k + k>=1 FLOOR
 *  3. nBits DIV-δ + renormalize + TERMINAL HALT (VERIFY q)
 *  4. 64-bit PoW (halves compare, XOR order-flip on lo)
 *  5. WLDF v6 + ALP MINT pins, out0..out2 concat
 *  6. successor verify (econ hash + 10B state push + code hash)
 *  7. CODESEPARATOR + hashOutputs pin + bare CHECKSIG (TRUE on top)
 */
export function udeltaV5CodeUnits(): AsmUnit[] {
  const D = OP.OP_DUP;
  const u: AsmUnit[] = [];
  // --- phase 1: preimage (index 7 under the 7 head pushes) ---
  u.push(num(7), op(OP.OP_ROLL)); // [pre, ...]
  u.push(op(D), op(OP.OP_SHA256), op(OP.OP_TOALTSTACK)); // alt: powcommit
  u.push(op(D), op(OP.OP_SIZE), num(40), op(OP.OP_SUB), op(OP.OP_SPLIT));
  u.push(op(OP.OP_NIP), op(OP.OP_NIP)); // [tail40]
  u.push(num(32), op(OP.OP_SPLIT)); // [hashOutputs, tail8]
  u.push(op(OP.OP_SWAP), op(OP.OP_TOALTSTACK)); // alt: hashOutputs
  u.push(num(4), op(OP.OP_SPLIT), op(OP.OP_DROP)); // [locktime]
  u.push(op(OP.OP_TOALTSTACK)); // alt: locktime, hashOutputs, powcommit
  // --- phase 2: state parse + derivation ---
  // state9 = slotLe(4).mLe(4).eByte: [me5, slotLe] → [eByte, mLe, slotLe].
  u.push(num(4), op(OP.OP_SPLIT)); // [me5, slotLe, ...]
  u.push(num(4), op(OP.OP_SPLIT)); // [eByte, mLe, slotLe, ...]
  u.push(op(OP.OP_BIN2NUM)); // [e#, mLe, slotLe, ...]
  u.push(num(2), op(OP.OP_ROLL)); // [slotLe, e#, mLe, ...]
  u.push(op(OP.OP_BIN2NUM)); // [slot#, e#, mLe, ...]
  u.push(op(OP.OP_SWAP)); // [e#, slot#, mLe, ...]
  u.push(num(2), op(OP.OP_ROLL)); // [mLe, e#, slot#, ...]
  u.push(op(OP.OP_BIN2NUM)); // [m#, e#, slot#, ...]
  u.push(num(2), op(OP.OP_ROLL)); // [slot#, m#, e#, ...]
  u.push(op(OP.OP_FROMALTSTACK)); // [locktimeB, slot#, m#, e#, ...]
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash locktime BYTES for WLDF
  u.push(op(OP.OP_BIN2NUM)); // [locktime#, slot#, m#, e#, ...]
  // genesisUnix at index 7 (extra e# shifts v4's 6 by one).
  u.push(num(7), op(OP.OP_ROLL), op(OP.OP_BIN2NUM), op(OP.OP_SUB)); // dt
  // daySeconds back at index 6 (dt consumed one): same as v4.
  u.push(num(6), op(OP.OP_ROLL), op(OP.OP_BIN2NUM), op(OP.OP_DIV)); // newSlot
  // k = newSlot − slot# ([newSlot, slot#, m#, e#]: DUP, ROLL 2, SUB).
  u.push(op(D), num(2), op(OP.OP_ROLL), op(OP.OP_SUB)); // [k, newSlot, ...]
  // k >= 1 FLOOR (v4 order: [k,1] GTE tests k>=1 — NO SWAP).
  u.push(num(1), op(OP.OP_GREATERTHANOREQUAL));
  u.push(op(OP.OP_VERIFY));
  // [newSlot, m#, e#, prefixHash, codeHash, mintAtoms, tokenId, ...]
  // --- phase 3: nBits DIV-δ + renormalize + HALT ---
  u.push(num(1), op(OP.OP_ROLL)); // [m#, newSlot, e#, ...]
  u.push(op(D)); // [m#, m#, newSlot, e#, ...]
  u.push(num(UDELTA_V5_DELTA_K), op(OP.OP_DIV)); // [m#, q, newSlot, e#, ...]
  u.push(op(D), op(OP.OP_VERIFY)); // HALT: q==0 fails (mine exhausted)
  u.push(op(OP.OP_SUB)); // m1 = m − q → [m1, newSlot, e#, ...]
  // renorm condition: (m1 < 2^23) AND (e > 0), single IF (sim: no nesting).
  u.push(num(2), op(OP.OP_ROLL)); // [e#, m1, newSlot, ...]
  u.push(op(OP.OP_SWAP)); // [m1, e#, newSlot, ...]
  u.push(op(OP.OP_2DUP)); // [m1, e#, m1, e#, newSlot, ...]
  u.push(num(UDELTA_V5_M_NORM_MIN)); // [2^23, m1, e#, m1, e#, ...]
  // NO SWAP: LT pops b=top, a=second → m1 < 2^23 ✓ ([const, value] order).
  u.push(op(OP.OP_LESSTHAN)); // needM → [needM, e#, m1, e#, newSlot, ...]
  u.push(op(OP.OP_SWAP)); // [e#, needM, m1, e#, newSlot, ...]
  u.push(op(OP.OP_TOALTSTACK)); // park e# → [needM, m1, e#, newSlot, ...]
  u.push(num(1)); // [1, needM, m1, e#, newSlot, ...]
  u.push(op(OP.OP_FROMALTSTACK)); // [e#, 1, needM, m1, e#, newSlot, ...]
  u.push(op(OP.OP_LESSTHANOREQUAL)); // 1<=e# → [haveE, needM, m1, e#, ...]
  u.push(op(OP.OP_SWAP)); // [needM, haveE, m1, e#, newSlot, ...]
  u.push(op(OP.OP_BOOLAND)); // [doRenorm, m1, e#, newSlot, ...]
  u.push(op(OP.OP_IF)); // consumes flag: arms see [m1, e#, newSlot]
  // renorm arm: [m1, e#, newSlot] → [m', e', newSlot] (net depth 0).
  u.push(op(OP.OP_SWAP)); // [e#, m1, newSlot, ...]
  u.push(op(OP.OP_TOALTSTACK)); // park e# → [m1, newSlot, ...]
  u.push(num(3), op(OP.OP_NUM2BIN)); // m1b3 (m1 < 2^23 fits 3B)
  u.push(hexd('00')); // [zero1, m1b3, newSlot, ...]
  u.push(op(OP.OP_SWAP)); // [m1b3, zero1, newSlot, ...]
  u.push(op(OP.OP_CAT)); // zero++m1b3 = m1×256 LE
  u.push(op(OP.OP_BIN2NUM)); // [m'#, newSlot, ...] (< 2^31, valid)
  u.push(op(OP.OP_FROMALTSTACK)); // [e#, m'#, newSlot, ...]
  u.push(num(1), op(OP.OP_SUB)); // e−1 ([1,e#]: second−top ✓ — NO SWAP)
  u.push(op(OP.OP_SWAP)); // [m'#, e', newSlot, ...]
  u.push(op(OP.OP_ELSE));
  // no-op arm (depths converge with the net-0 renorm arm).
  u.push(op(OP.OP_ENDIF));
  // [mX, eX, newSlot, prefixHash, codeHash, mintAtoms, tokenId, ...]
  // --- phase 4: 64-bit PoW, exponent-gated 32-bit form ---
  // H64 < m×256^e ⟺ head4 = H[e..e+4] < m AND top = H[e+4..8] == 0
  // (low e bytes are free — strict < makes equality fail regardless).
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_FROMALTSTACK));
  u.push(op(OP.OP_FROMALTSTACK)); // [powcommit, hashOutputs, locktimeB, ...]
  u.push(num(1), op(OP.OP_ROLL), op(OP.OP_TOALTSTACK)); // hashOutputs back
  // [powcommit, locktimeB, mX, eX, newSlot, ...]
  u.push(num(9), op(OP.OP_ROLL)); // nonce (index 9: pow,lock,mX,eX + 5 econ)
  u.push(op(OP.OP_CAT), op(OP.OP_HASH256)); // solhash32 (powcommit++nonce)
  // eX copies: ROLL original, DUP for pins stash + two consumers.
  u.push(num(3), op(OP.OP_ROLL)); // [eX, sol32, locktimeB, mX, ...]
  u.push(op(D)); // [eX, eX, sol32, ...]
  u.push(op(OP.OP_TOALTSTACK)); // park pins-e# → [eX, sol32, ...]
  u.push(op(D)); // [eX, eX, sol32, ...]
  u.push(num(2), op(OP.OP_ROLL)); // [sol32, eX, eX, ...]
  u.push(op(OP.OP_SWAP)); // [eX, sol32, eX, ...]
  u.push(op(OP.OP_SPLIT)); // n=eX: [lowE, rest, eX] (top-first [rest,...])
  u.push(op(OP.OP_NIP)); // drop lowE (free bytes) → [rest, eX, ...]
  u.push(num(4), op(OP.OP_SPLIT)); // [head4, rest2, eX] ([rest2,head4] top)
  u.push(op(OP.OP_SWAP)); // [head4, rest2, ...]: park head4 first...
  u.push(op(OP.OP_TOALTSTACK)); // park head4 → [rest2, eX, ...]
  u.push(op(OP.OP_TOALTSTACK)); // park rest2 (top: needed first) → [eX, ...]
  u.push(num(4), op(OP.OP_SWAP), op(OP.OP_SUB)); // 4−e ([eX,4]→4−eX)
  u.push(op(OP.OP_FROMALTSTACK)); // [rest2, 4−e, ...]
  u.push(op(OP.OP_SWAP)); // [4−e, rest2, ...]
  u.push(op(OP.OP_SPLIT)); // [top(4−e B), beyond]: top-first [beyond, top]
  u.push(op(OP.OP_DROP)); // drop beyond-8 (outside the 64-bit head)
  u.push(op(OP.OP_BIN2NUM)); // top# (empty→0 when e=4: vacuous pass)
  u.push(num(0), op(OP.OP_EQUAL), op(OP.OP_VERIFY)); // top == 0
  u.push(op(OP.OP_FROMALTSTACK)); // [head4, locktimeB, mX, ...]
  // Guarded direct compare (both < 2^31 after the guard — no XOR needed).
  u.push(op(OP.OP_BIN2NUM)); // [head4#, ...]
  u.push(op(D)); // [head4#, head4#, ...]
  u.push(num(0)); // [0, head4#, head4#, ...] — NO SWAP: GTE tests head4#>=0 ✓
  u.push(op(OP.OP_GREATERTHANOREQUAL), op(OP.OP_VERIFY)); // head4# >= 0
  u.push(num(2), op(OP.OP_ROLL)); // [mX, head4#, ...]
  u.push(op(D), num(4), op(OP.OP_NUM2BIN)); // [mX, mB4, head4#, ...]
  u.push(op(OP.OP_TOALTSTACK)); // stash mB4 (pins) → [mX, head4#, ...]
  // NO SWAP: LT pops b=top, a=second → head4# < mX ✓ ([value, head] order).
  u.push(op(OP.OP_LESSTHAN), op(OP.OP_VERIFY)); // H < m (unsigned ✓)
  // [locktimeB, newSlot, ...]: alt [hashOutputs, pins-e#, mB4].
  // --- phase 5: pins (WLDF v6 + ALP MINT, out0..out2 concat) ---
  // SDB: [locktimeB, newSlot, ...] → stash locktimeB, convert newSlot.
  u.push(op(OP.OP_TOALTSTACK)); // park locktimeB → [newSlot, ...]
  u.push(op(D), num(4), op(OP.OP_NUM2BIN)); // [newSlot, SDB, ...]
  u.push(op(OP.OP_TOALTSTACK)); // stash SDB (successor) → [newSlot, ...]
  u.push(op(OP.OP_DROP)); // drop newSlot# → [prefixHash, ...rest]
  u.push(op(OP.OP_FROMALTSTACK)); // SDB → [SDB, prefixHash, ...]
  u.push(op(OP.OP_FROMALTSTACK)); // locktimeB (rides main, ROLL-last)
  u.push(op(OP.OP_FROMALTSTACK)); // mB4 → [mB4, locktimeB, SDB, ...]
  u.push(op(OP.OP_FROMALTSTACK)); // pins-e# → [e#, mB4, locktimeB, SDB, ...]
  u.push(num(1), op(OP.OP_NUM2BIN)); // eB (pins copy consumed below)
  // wldf = 574c4446.06.SDB.MB.EB.locktimeB (18 bytes, 0x12).
  u.push(hexd('574c444606')); // LOKAD + version in one push (saves a CAT)
  u.push(num(4), op(OP.OP_ROLL)); // SDB (locktimeB rides at index 3)
  u.push(op(D), op(OP.OP_TOALTSTACK), op(OP.OP_CAT));
  u.push(num(2), op(OP.OP_ROLL)); // mB4
  u.push(op(D), op(OP.OP_TOALTSTACK), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL)); // eB
  u.push(op(D), op(OP.OP_TOALTSTACK), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL), op(OP.OP_CAT)); // locktimeB rides main
  // mint = SLP2.00.04.MINT.tokenId.01.mintAtoms.01 (50 bytes, 0x32).
  // Base in one push; tokenId01 (33B) + mintAtoms01 (9B) arrive pre-joined
  // from the center (ScriptV5) — saves two CATs, identical pinned bytes.
  u.push(hexd('534c503200044d494e54'));
  u.push(num(5), op(OP.OP_ROLL), op(OP.OP_CAT)); // tokenId01
  u.push(num(4), op(OP.OP_ROLL), op(OP.OP_CAT)); // mintAtoms01
  // opReturn = 6a50.12.wldf.32.mint (72 bytes, 0x48).
  u.push(hexd('6a5012'));
  u.push(num(2), op(OP.OP_ROLL), op(OP.OP_CAT)); // wldf
  u.push(hexd('32'), op(OP.OP_CAT));
  u.push(num(1), op(OP.OP_ROLL), op(OP.OP_CAT)); // mint
  // out0 = Z8.48.opReturn
  u.push(hexd('000000000000000048'));
  u.push(op(OP.OP_SWAP), op(OP.OP_CAT));
  // out1 = dust.19.76a914.H160(minerPk).88ac
  u.push(hexd('22020000000000001976a914'));
  u.push(num(5), op(OP.OP_ROLL)); // minerPk
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash minerPk copy for CHECKSIG
  u.push(op(OP.OP_HASH160), op(OP.OP_CAT));
  u.push(hexd('88ac'), op(OP.OP_CAT));
  // out2 = dust.17.a914.H160(nextRedeem).87 (THE baton)
  u.push(hexd('220200000000000017a914'));
  u.push(num(6), op(OP.OP_ROLL)); // nextRedeem (s rides at 5, nr at 6)
  u.push(op(D), op(OP.OP_TOALTSTACK)); // stash for successor verify
  u.push(op(OP.OP_HASH160), op(OP.OP_CAT));
  u.push(hexd('87'), op(OP.OP_CAT));
  // concat = out0.out1.out2 (v4 order: CAT CAT, no SWAP).
  u.push(op(OP.OP_CAT), op(OP.OP_CAT));
  // --- phase 6: successor verify (BEFORE the separator) ---
  // main: [concat, ...]; alt: [hashOutputs, SDB, MB, EB, mpk, nr].
  u.push(op(OP.OP_FROMALTSTACK)); // nr
  u.push(num(UDELTA_V5_ECON_LEN), op(OP.OP_SPLIT)); // [econ, rest]
  u.push(op(OP.OP_SWAP), op(OP.OP_SHA256)); // econHash
  u.push(num(3), op(OP.OP_ROLL), op(OP.OP_EQUALVERIFY)); // econ == prefixHash
  u.push(num(UDELTA_V5_PREFIX_SKIP), op(OP.OP_SPLIT), op(OP.OP_NIP));
  u.push(num(UDELTA_V5_STATE_PUSH_LEN), op(OP.OP_SPLIT)); // [state', code]
  u.push(op(OP.OP_SHA256)); // hash code directly (no state' park)
  u.push(num(3), op(OP.OP_ROLL)); // codeHash (state' rides at index 1)
  u.push(op(OP.OP_SWAP), op(OP.OP_EQUALVERIFY)); // code == codeHash
  // Alt [mpk, EB, MB, SDB, hashOutputs]: ferry mpk home, fetch bytes.
  u.push(op(OP.OP_FROMALTSTACK)); // mpk
  u.push(op(OP.OP_FROMALTSTACK)); // EB
  u.push(op(OP.OP_FROMALTSTACK)); // MB
  u.push(op(OP.OP_FROMALTSTACK)); // SDB
  // [SDB, MB, EB, mpk, state', ...] → mpk home → [SDB, MB, EB].
  u.push(num(3), op(OP.OP_ROLL), op(OP.OP_TOALTSTACK)); // mpk back to alt
  // expected = 09.SDB.MB.EB: [SDB, MB, EB, state'] — pure main-stack.
  u.push(num(9)); // [9, SDB, MB, EB, state']
  u.push(op(OP.OP_SWAP)); // [SDB, 9, MB, EB, state']
  u.push(op(OP.OP_CAT)); // 09++SDB → [09SDB, MB, EB, state']
  u.push(op(OP.OP_SWAP)); // [MB, 09SDB, EB, state']
  u.push(op(OP.OP_CAT)); // 09SDB++MB → [09SDBMB, EB, state']
  u.push(op(OP.OP_SWAP)); // [EB, 09SDBMB, state']
  u.push(op(OP.OP_CAT)); // ++EB → [expected, state']
  u.push(op(OP.OP_EQUALVERIFY)); // state' == expected (order-free)
  // --- phase 7: separator + pins + auth (bare CHECKSIG leaves TRUE) ---
  u.push(op(OP.OP_CODESEPARATOR));
  u.push(op(OP.OP_HASH256)); // concatH
  u.push(op(OP.OP_FROMALTSTACK), op(OP.OP_FROMALTSTACK)); // mpk, hashOutputs
  u.push(num(2), op(OP.OP_ROLL)); // concatH → [concatH, hashOutputs, mpk, s]
  u.push(op(OP.OP_EQUALVERIFY));
  u.push(op(OP.OP_CHECKSIG)); // [TRUE] — no trailing VERIFY (empty stack fails)
  return u;
}

/** Depth-simulate the v5 code (12 stack items at entry, like v4). */
export function simUdeltaV5(): { ops: number; maxMain: number; maxAlt: number } {
  return simulateUdeltaCode(udeltaV5CodeUnits(), 12);
}

/** Assemble the v5 code bytes. */
export function assembleV5(): Uint8Array {
  return assemble(udeltaV5CodeUnits());
}
