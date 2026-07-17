/**
 * WLOTUS family consensus parameters.
 *
 * Pricing ladder (n → m → W): see `pricing.ts` and docs/ECONOMICS.md.
 * Live dogfood tokens may still use toy difficulty; **next genesis** should
 * follow the UX / ASIC bits below.
 */

/** Launch tier — phone / PC minutes. */
export const NWLPOW_TICKER = 'nWLPOW';
export const NWLPOW_NAME = 'nano White Lotus PoW';

/** Incubation tier — normal PC tens of minutes+. */
export const TOKEN_TICKER = 'mWLPOW';
export const TOKEN_NAME = 'milli White Lotus PoW';

export const PROD_TOKEN_TICKER = 'WLOTUS';
export const PROD_TOKEN_NAME = 'White Lotus';

export const TOKEN_DECIMALS = 0;
export const PROD_TOKEN_DECIMALS = 0;

/**
 * @deprecated Dogfood only. Next mWLPOW genesis: POW_M_BASE_ZERO_BITS (30).
 * Leading zero *bytes* used by early fixed-D covenants.
 */
export const POW_LEADING_ZERO_BYTES = 1;

/** nWLPOW genesis bits — phone ~minutes, PC <1 min @ ~1 MH/s. */
export const POW_N_BASE_ZERO_BITS = 25;

/** mWLPOW genesis bits — normal PC ~tens of minutes @ ~1 MH/s. */
export const POW_M_BASE_ZERO_BITS = 30;

/**
 * WLOTUS genesis bits — ASIC electricity floor ≈ $1/token ($100/remint)
 * at 20 J/TH, $0.08/kWh (see pricing.ts). Tune before freeze.
 */
export const POW_W_BASE_ZERO_BITS = 68;

/** @deprecated alias — prefer POW_M_BASE_ZERO_BITS for real incubation. */
export const POW_BASE_ZERO_BITS = POW_LEADING_ZERO_BYTES * 8;

export const BASE_MINT_ATOMS = 100n;

export const POW_BATON_COUNT = 4;

export const MOORE_NUM = 99918n;
export const MOORE_DEN = 100000n;
export const MOORE_NUM_OBSOLETE = 99826n;

export const MOORE_DAY_BLOCKS = 144;
export const MOORE_DAY_SECONDS = 86_400;
export const MOORE_DAYS_PER_EXTRA_BIT = 840;

/** Nominal peg: 1000 m ≈ 1 W; 1000 n ≈ 1 m. */
export const MWLOTUS_PER_WLOTUS = 1000n;
export const MWLPOW_PER_WLOTUS = MWLOTUS_PER_WLOTUS;
export const NWLPOW_PER_MWLPOW = 1000n;
export const NWLPOW_PER_WLOTUS = NWLPOW_PER_MWLPOW * MWLPOW_PER_WLOTUS;

export const TOKEN_URL = 'https://github.com/bcProFoundation/wlotus';
