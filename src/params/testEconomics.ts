/**
 * Incubation (mWLOTUS) vs production (WLOTUS) economics.
 *
 * Ritual loop: burn = sacrifice (destroy supply); remint = pure PoW rebirth.
 * Burns create scarcity → support price → pull miners back.
 *
 * Price targets are **market** aims (energy + fees + hardware amortisation +
 * miner margin), not an on-chain USD oracle.
 */

/** mWLOTUS target ≈ $0.00001 / token ≈ 1/1000 of WLOTUS $0.01. */
export const TEST_TARGET_USD_PER_TOKEN = 0.00001;

/** Future WLOTUS target ≈ $0.01 / token ≈ $1 / remint (100 tokens). */
export const PROD_TARGET_USD_PER_TOKEN = 0.01;

/** Fixed tokens per remint (both mWLOTUS and WLOTUS). */
export const TOKENS_PER_REMINT = 100;

/** @deprecated use POW_LEADING_ZERO_BYTES from consensus — incubation genesis. */
export const TEST_POW_LEADING_ZERO_BYTES = 1;

/**
 * Bootstrap fungible supply for burn UX before heavy reminting.
 * 1_000_000 mWLOTUS @ 2 decimals = 100_000_000 atoms.
 */
export const TEST_INITIAL_MINT_ATOMS = 100_000_000n;

export const TEST_POW_BATON_COUNT = 4;

export const TEST_TOKEN_TICKER = 'mWLOTUS';

export const TEST_TOKEN_NAME = 'milli White Lotus';

/** Per-remint USD target at incubation (100 × $1e-5). */
export const TEST_TARGET_USD_PER_REMINT =
  TEST_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;

/** Per-remint USD target at production (100 × $0.01). */
export const PROD_TARGET_USD_PER_REMINT =
  PROD_TARGET_USD_PER_TOKEN * TOKENS_PER_REMINT;
