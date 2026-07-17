/**
 * Incubation (mWLPOW) vs production (WLOTUS) economics.
 *
 * Ritual loop: burn = sacrifice (destroy supply); remint = pure PoW rebirth.
 */

/** mWLPOW target ≈ $0.00001 / token ≈ 1/1000 of WLOTUS $0.01. */
export const TEST_TARGET_USD_PER_TOKEN = 0.00001;

/** Future WLOTUS target ≈ $0.01 / token ≈ $1 / remint (100 tokens). */
export const PROD_TARGET_USD_PER_TOKEN = 0.01;

/** Fixed tokens per remint (both mWLPOW and WLOTUS). */
export const TOKENS_PER_REMINT = 100;

/** @deprecated use POW_LEADING_ZERO_BYTES from consensus. */
export const TEST_POW_LEADING_ZERO_BYTES = 1;

/**
 * Bootstrap fungible supply for burn UX.
 * 1_000_000 mWLPOW @ 0 decimals = 1_000_000 atoms.
 */
export const TEST_INITIAL_MINT_ATOMS = 1_000_000n;

export const TEST_POW_BATON_COUNT = 4;

export const TEST_TOKEN_TICKER = 'mWLPOW';

export const TEST_TOKEN_NAME = 'milli White Lotus PoW';

export const TEST_TARGET_USD_PER_REMINT =
  TEST_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;

export const PROD_TARGET_USD_PER_REMINT =
  PROD_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;
