/**
 * WLOTUS consensus draft parameters.
 * Freeze only at GENESIS; until then values may change on chipnet.
 */

/** ALP ticker (ASCII). */
export const TOKEN_TICKER = 'WLOTUS';

/** Human-readable name. */
export const TOKEN_NAME = 'White Lotus';

/**
 * Token decimals. Use enough precision so daily Moore floor-division
 * `(x * 99918) / 100000` does not collapse small balances to zero.
 */
export const TOKEN_DECIMALS = 6;

/**
 * Leading zero *bytes* required on hash256(preimage || nonce).
 * Draft — retune on chipnet.
 */
export const POW_LEADING_ZERO_BYTES = 2;

/**
 * Base mint atoms at k=0 (genesis day-step).
 * 100_000_000 atoms @ 6 decimals = 100 WLOTUS per remint at genesis.
 * Must stay large: Ergon applies Moore to huge work values; applying the
 * same integer factor to a tiny M₀ reaches 0 in far less than 2.3 years.
 */
export const BASE_MINT_ATOMS = 100_000_000n;

/**
 * Number of parallel PoW mint batons created at genesis.
 * Each baton is an independent remint race (true parallelization).
 */
export const POW_BATON_COUNT = 8;

/**
 * Ergon post-fix Moore daily factor numerator.
 * @see https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978
 */
export const MOORE_NUM = 99918n;

/** Moore daily factor denominator. */
export const MOORE_DEN = 100000n;

/**
 * Obsolete Ergon pre-fix factor (~1.1y half-life). Forbidden for WLOTUS.
 */
export const MOORE_NUM_OBSOLETE = 99826n;

/**
 * Host blocks per Moore day-step (Ergon uses 144 × 10-minute blocks).
 * eCash target spacing is likewise ~10 minutes.
 */
export const MOORE_DAY_BLOCKS = 144;

/** Document URL placeholder (set before genesis). */
export const TOKEN_URL = 'https://github.com/bcProFoundation/wlotus';
