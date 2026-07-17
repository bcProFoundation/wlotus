/**
 * WLOTUS / mWLOTUS consensus parameters.
 *
 * Incubation token **mWLOTUS** ≈ 1/1000 energy of future **WLOTUS**.
 * Freeze only at GENESIS; until then values may change.
 */

/** Incubation ticker (milli-WLOTUS). */
export const TOKEN_TICKER = 'mWLOTUS';

/** Human-readable name. */
export const TOKEN_NAME = 'milli White Lotus';

/**
 * Future production ticker (not this genesis).
 * Nominal energy peg: 1000 mWLOTUS ≈ 1 WLOTUS.
 */
export const PROD_TOKEN_TICKER = 'WLOTUS';

export const PROD_TOKEN_NAME = 'White Lotus';

/**
 * Decimals for mWLOTUS. Mint amount is fixed (no Moore on atoms),
 * so 2 decimals is enough for UX (100.00 per remint).
 */
export const TOKEN_DECIMALS = 2;

/**
 * Future WLOTUS decimals (same fixed-100 mint model).
 */
export const PROD_TOKEN_DECIMALS = 2;

/**
 * Leading zero *bytes* on hash256(preimage ‖ nonce) at incubation genesis.
 * 1 byte ⇒ ~1/256 — cheap dogfood so anyone can mine/burn.
 * WLOTUS later raises this (~1000× energy ⇒ roughly +10 bits / ~1–2 bytes).
 */
export const POW_LEADING_ZERO_BYTES = 1;

/**
 * Fixed mint per remint (atoms). Always 100.00 tokens @ 2 decimals.
 * Moore / Koomey adjusts **difficulty**, not this amount.
 */
export const BASE_MINT_ATOMS = 10_000n; // 100.00

/** Parallel PoW mint batons (N ≥ 2). */
export const POW_BATON_COUNT = 4;

/**
 * Ergon post-fix Moore daily factor numerator (~2.3y half-life).
 * Applied to **required work / difficulty**, not to mint atoms.
 * @see https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978
 */
export const MOORE_NUM = 99918n;

export const MOORE_DEN = 100000n;

/** Obsolete Ergon pre-fix factor — forbidden. */
export const MOORE_NUM_OBSOLETE = 99826n;

/** Host blocks per Moore day-step (~10 min × 144). */
export const MOORE_DAY_BLOCKS = 144;

/**
 * Wall-seconds per Moore day (unix-time schedule).
 * Incubation covenants may use height or time; miner uses time.
 */
export const MOORE_DAY_SECONDS = 86_400;

/**
 * Extra leading zero *bits* of PoW required per this many Moore days.
 * ≈ Ergon half-life (~840d): +1 bit ≈ 2× work when hardware efficiency doubles.
 * Full on-chain bit schedule needs stateful difficulty (see docs/ECONOMICS.md);
 * incubation mWLOTUS ships fixed genesis bytes and this constant for the library.
 */
export const MOORE_DAYS_PER_EXTRA_BIT = 840;

/** Base PoW zero-bits at genesis (8 ≡ 1 leading zero byte). */
export const POW_BASE_ZERO_BITS = POW_LEADING_ZERO_BYTES * 8;

/**
 * Nominal energy conversion when WLOTUS launches:
 * 1000 mWLOTUS ↔ 1 WLOTUS (live or burned ledger).
 */
export const MWLOTUS_PER_WLOTUS = 1000n;

/** Document URL. */
export const TOKEN_URL = 'https://github.com/bcProFoundation/wlotus';
