/**
 * Incubation vs production economics (market intents).
 * Difficulty bits: see consensus.ts + pricing.ts / docs/ECONOMICS.md.
 */

import {
  POW_M_BASE_ZERO_BITS,
  POW_N_BASE_ZERO_BITS,
  POW_W_BASE_ZERO_BITS,
} from './consensus.js';

export const TOKENS_PER_REMINT = 100;

/** nWLPOW — launch / phone. Soft market price. */
export const NWLPOW_TARGET_USD_PER_TOKEN = 1e-6;
export const NWLPOW_BASE_ZERO_BITS = POW_N_BASE_ZERO_BITS;

/** mWLPOW — PC incubation. Soft market price (not ASIC joule peg). */
export const TEST_TARGET_USD_PER_TOKEN = 1e-3;
export const TEST_BASE_ZERO_BITS = POW_M_BASE_ZERO_BITS;

/**
 * WLOTUS — ASIC energy floor ≈ $1/token ($100/remint) at reference sheet.
 * Old $0.01/token plan was under-difficult vs 100 TH/s ASICs.
 */
export const PROD_TARGET_USD_PER_TOKEN = 1;
export const PROD_BASE_ZERO_BITS = POW_W_BASE_ZERO_BITS;

/** @deprecated dogfood fixed-D byte difficulty */
export const TEST_POW_LEADING_ZERO_BYTES = 1;

export const TEST_INITIAL_MINT_ATOMS = 1_000_000n;
export const TEST_POW_BATON_COUNT = 4;

export const TEST_TOKEN_TICKER = 'mWLPOW';
export const TEST_TOKEN_NAME = 'milli White Lotus PoW';
export const NWLPOW_TOKEN_TICKER = 'nWLPOW';
export const NWLPOW_TOKEN_NAME = 'nano White Lotus PoW';

export const TEST_TARGET_USD_PER_REMINT =
  TEST_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;
export const PROD_TARGET_USD_PER_REMINT =
  PROD_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;
export const NWLPOW_TARGET_USD_PER_REMINT =
  NWLPOW_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;
