/**
 * WLOTUS family consensus parameters.
 *
 * Ritual offer ladder (prestige high → low):
 *   Flower (WLotus) → Candle → Incense → Prayer
 *
 * See `pricing.ts` and docs/ECONOMICS.md.
 * Live dogfood tokens may still use toy difficulty / old tickers.
 */

/** Quick offer — ~1/10 Incense wall-clock. */
export const PRAYER_TICKER = 'PRAYER';
export const PRAYER_NAME = 'Prayer';

/** Launch offer (ex-nWLotus). */
export const INCENSE_TICKER = 'INCENSE';
export const INCENSE_NAME = 'Incense';

/** Mid offer (ex-mWLotus). */
export const CANDLE_TICKER = 'CANDLE';
export const CANDLE_NAME = 'Candle';

/** Prestige Flower — product brand WLotus. */
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

/**
 * @deprecated Dogfood only. Leading zero *bytes* used by early fixed-D covenants.
 */
export const POW_LEADING_ZERO_BYTES = 1;

/** Prayer genesis bits — Incense/10 (anti-arb ladder from Flower $1). */
export const POW_PRAYER_BASE_ZERO_BITS = 42;

/** Incense genesis bits — Flower/10000 work (ex-nWLotus UX@25 abandoned for anti-arb). */
export const POW_INCENSE_BASE_ZERO_BITS = 46;

/** Candle genesis bits — Incense × 100 work. */
export const POW_CANDLE_BASE_ZERO_BITS = 52;

/**
 * Flower (WLotus) genesis bits — $1/baton × 25% electricity on ref. ASIC.
 * Also = Incense × 10_000 so ASICs are indifferent across the peg.
 */
export const POW_FLOWER_BASE_ZERO_BITS = 59;

/** @deprecated use POW_INCENSE_BASE_ZERO_BITS */
export const POW_N_BASE_ZERO_BITS = POW_INCENSE_BASE_ZERO_BITS;

/** @deprecated use POW_CANDLE_BASE_ZERO_BITS */
export const POW_M_BASE_ZERO_BITS = POW_CANDLE_BASE_ZERO_BITS;

/** @deprecated use POW_FLOWER_BASE_ZERO_BITS */
export const POW_W_BASE_ZERO_BITS = POW_FLOWER_BASE_ZERO_BITS;

/** @deprecated alias — dogfood fixed-D. */
export const POW_BASE_ZERO_BITS = POW_LEADING_ZERO_BYTES * 8;

/** Default mint atoms (Flower). Prefer per-tier constants below. */
export const BASE_MINT_ATOMS = 100n;

export const PRAYER_MINT_ATOMS = 1n;
export const INCENSE_MINT_ATOMS = 1n;
export const CANDLE_MINT_ATOMS = 10n;
export const FLOWER_MINT_ATOMS = 100n;

export const POW_BATON_COUNT = 4;

export const MOORE_NUM = 99918n;
export const MOORE_DEN = 100000n;
export const MOORE_NUM_OBSOLETE = 99826n;

export const MOORE_DAY_BLOCKS = 144;
export const MOORE_DAY_SECONDS = 86_400;
export const MOORE_DAYS_PER_EXTRA_BIT = 840;

/**
 * Nominal token peg (offer units):
 *   10 Prayer ≈ 1 Incense (work-ish)
 *   100 Incense ≈ 1 Candle
 *   100 Candle ≈ 1 Flower (WLotus)
 */
export const PRAYER_PER_INCENSE = 10n;
export const INCENSE_PER_CANDLE = 100n;
export const CANDLE_PER_FLOWER = 100n;
export const INCENSE_PER_FLOWER = INCENSE_PER_CANDLE * CANDLE_PER_FLOWER;

/** @deprecated old milli peg — Candle fills that slot now */
export const MWLOTUS_PER_WLOTUS = CANDLE_PER_FLOWER;
export const MWLPOW_PER_WLOTUS = MWLOTUS_PER_WLOTUS;
export const NWLPOW_PER_MWLPOW = INCENSE_PER_CANDLE;
export const NWLPOW_PER_WLOTUS = INCENSE_PER_FLOWER;

export const TOKEN_URL = 'https://github.com/bcProFoundation/wlotus';
