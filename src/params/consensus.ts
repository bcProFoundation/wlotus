/**
 * WLOTUS family consensus parameters.
 *
 * Ritual offer ladder (prestige high → low):
 *   Flower (WLotus) → Candle → Incense → Prayer
 *
 * Mint: Prayer 1 · Incense/Candle/Flower 100 each.
 * Peg: 1000 lower ≈ 1 higher (token). Fee floor (~5.46 XEC) prices
 * Prayer/Incense UX; Flower is $1 ASIC sheet. See pricing.ts / ECONOMICS.md.
 */

export const PRAYER_TICKER = 'PRAYER';
export const PRAYER_NAME = 'Prayer';

export const INCENSE_TICKER = 'INCENSE';
export const INCENSE_NAME = 'Incense';

export const CANDLE_TICKER = 'CANDLE';
export const CANDLE_NAME = 'Candle';

export const PROD_TOKEN_TICKER = 'WLOTUS';
export const PROD_TOKEN_NAME = 'WLotus';
export const FLOWER_TICKER = PROD_TOKEN_TICKER;
export const FLOWER_NAME = 'Flower';

/** @deprecated use INCENSE_* */
export const NWLPOW_TICKER = INCENSE_TICKER;
export const NWLPOW_NAME = INCENSE_NAME;

/** @deprecated use CANDLE_* */
export const TOKEN_TICKER = CANDLE_TICKER;
export const TOKEN_NAME = CANDLE_NAME;

/** @deprecated dogfood ticker still on some live test tokens */
export const DOGFOOD_TICKER_MWLPOW = 'mWLPOW';

export const TOKEN_DECIMALS = 0;
export const PROD_TOKEN_DECIMALS = 0;

/** @deprecated Dogfood only. */
export const POW_LEADING_ZERO_BYTES = 1;

/** Prayer — phone ~30 s (fee-dominated ritual). */
export const POW_PRAYER_BASE_ZERO_BITS = 22;

/** Incense — easy UX; fee amortized over 100 tokens. */
export const POW_INCENSE_BASE_ZERO_BITS = 25;

/** Candle — PoW from baton value vs Flower ($0.001 → ~49 bits). */
export const POW_CANDLE_BASE_ZERO_BITS = 49;

/** Flower — $1/baton × 25% electricity → ~59 bits. */
export const POW_FLOWER_BASE_ZERO_BITS = 59;

/** @deprecated */
export const POW_N_BASE_ZERO_BITS = POW_INCENSE_BASE_ZERO_BITS;
/** @deprecated */
export const POW_M_BASE_ZERO_BITS = POW_CANDLE_BASE_ZERO_BITS;
/** @deprecated */
export const POW_W_BASE_ZERO_BITS = POW_FLOWER_BASE_ZERO_BITS;

/** @deprecated dogfood fixed-D */
export const POW_BASE_ZERO_BITS = POW_LEADING_ZERO_BYTES * 8;

export const BASE_MINT_ATOMS = 100n;

export const PRAYER_MINT_ATOMS = 1n;
export const INCENSE_MINT_ATOMS = 100n;
export const CANDLE_MINT_ATOMS = 100n;
export const FLOWER_MINT_ATOMS = 100n;

export const POW_BATON_COUNT = 4;

export const MOORE_NUM = 99918n;
export const MOORE_DEN = 100000n;
export const MOORE_NUM_OBSOLETE = 99826n;

export const MOORE_DAY_BLOCKS = 144;
export const MOORE_DAY_SECONDS = 86_400;
export const MOORE_DAYS_PER_EXTRA_BIT = 840;

/** Nominal token peg: 1000 lower ≈ 1 higher. */
export const PRAYER_PER_INCENSE = 1000n;
export const INCENSE_PER_CANDLE = 1000n;
export const CANDLE_PER_FLOWER = 1000n;
export const INCENSE_PER_FLOWER = INCENSE_PER_CANDLE * CANDLE_PER_FLOWER;
export const PRAYER_PER_FLOWER =
  PRAYER_PER_INCENSE * INCENSE_PER_CANDLE * CANDLE_PER_FLOWER;

/** @deprecated */
export const MWLOTUS_PER_WLOTUS = CANDLE_PER_FLOWER;
export const MWLPOW_PER_WLOTUS = MWLOTUS_PER_WLOTUS;
export const NWLPOW_PER_MWLPOW = INCENSE_PER_CANDLE;
export const NWLPOW_PER_WLOTUS = INCENSE_PER_FLOWER;

export const TOKEN_URL = 'https://github.com/bcProFoundation/wlotus';
