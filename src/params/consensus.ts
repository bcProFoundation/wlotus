/**
 * WLOTUS / mWLPOW consensus parameters.
 *
 * Incubation token **mWLPOW** ≈ 1/1000 energy of future **WLOTUS**.
 * Freeze only at GENESIS; until then values may change.
 */

/** Incubation ticker (milli-WLPOW test). */
export const TOKEN_TICKER = 'mWLPOW';

/** Human-readable name. */
export const TOKEN_NAME = 'milli White Lotus PoW';

/**
 * Future production ticker (not this genesis).
 * Nominal energy peg: 1000 mWLPOW ≈ 1 WLOTUS.
 */
export const PROD_TOKEN_TICKER = 'WLOTUS';

export const PROD_TOKEN_NAME = 'White Lotus';

/**
 * Decimals for mWLPOW incubation. Whole tokens only (no fractional).
 * Mint is always 100 tokens per remint.
 */
export const TOKEN_DECIMALS = 0;

/** Future WLOTUS decimals (same fixed-100 mint model). */
export const PROD_TOKEN_DECIMALS = 0;

/**
 * Leading zero *bytes* on hash256(preimage ‖ nonce) at incubation genesis.
 * 1 byte ⇒ ~1/256 — cheap dogfood so anyone can mine/burn.
 */
export const POW_LEADING_ZERO_BYTES = 1;

/**
 * Fixed mint per remint (atoms). Always 100 tokens @ 0 decimals.
 * Moore / Koomey adjusts **difficulty**, not this amount.
 */
export const BASE_MINT_ATOMS = 100n;

/** Parallel PoW mint batons (N ≥ 2). */
export const POW_BATON_COUNT = 4;

/**
 * Ergon post-fix Moore daily factor numerator (~2.3y half-life).
 * Applied to **required work / difficulty**, not to mint atoms.
 */
export const MOORE_NUM = 99918n;

export const MOORE_DEN = 100000n;

/** Obsolete Ergon pre-fix factor — forbidden. */
export const MOORE_NUM_OBSOLETE = 99826n;

/** Host blocks per Moore day-step (~10 min × 144). */
export const MOORE_DAY_BLOCKS = 144;

/** Wall-seconds per Moore day. */
export const MOORE_DAY_SECONDS = 86_400;

/**
 * Extra leading zero *bits* of PoW required per this many Moore days.
 * ≈ Ergon half-life (~840d): +1 bit ≈ 2× work.
 */
export const MOORE_DAYS_PER_EXTRA_BIT = 840;

/** Base PoW zero-bits at genesis (8 ≡ 1 leading zero byte). */
export const POW_BASE_ZERO_BITS = POW_LEADING_ZERO_BYTES * 8;

/**
 * Nominal energy conversion when WLOTUS launches:
 * 1000 mWLPOW ↔ 1 WLOTUS.
 */
export const MWLOTUS_PER_WLOTUS = 1000n;

/** Alias for the same peg. */
export const MWLPOW_PER_WLOTUS = MWLOTUS_PER_WLOTUS;

/** Document URL. */
export const TOKEN_URL = 'https://github.com/bcProFoundation/wlotus';
