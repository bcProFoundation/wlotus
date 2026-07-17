/**
 * Test-deployment economics for the first on-chain WLOTUS token.
 *
 * Target: mining / remint cost around **$0.000001 per token** (very cheap dogfood).
 * Later production aim: around **$0.01 per token** (raise PoW difficulty + retune M₀).
 *
 * At ~$6.6e-6 / XEC (mid-2026 ballpark):
 * - One remint fee (~10–50 XEC) is already on the order of $1e-4 … $3e-4.
 * - With M₀ = 100 tokens/remint and PoW ≈ free (1 leading zero byte),
 *   all-in cost per token lands near the $1e-6 target when hashrate is low.
 */

/** Documented target USD per whole token for this test deployment. */
export const TEST_TARGET_USD_PER_TOKEN = 0.000001;

/** Future production target USD per whole token. */
export const PROD_TARGET_USD_PER_TOKEN = 0.01;

/**
 * PoW leading zero *bytes* for the test deployment.
 * 1 byte ⇒ ~1/256 hashes succeed — trivial on a laptop; not mainnet-hard.
 * Raise toward 2–3+ when targeting ~$0.01/token.
 */
export const TEST_POW_LEADING_ZERO_BYTES = 1;

/**
 * Initial fungible mint at genesis (atoms) so temple/burn UX can be tested
 * before PoW remint is fully wired. 1e12 atoms @ 6 decimals = 1_000_000 tokens.
 */
export const TEST_INITIAL_MINT_ATOMS = 1_000_000_000_000n;

/** Parallel batons for the test genesis (still N ≥ 2). */
export const TEST_POW_BATON_COUNT = 4;

/** Ticker for the cheap test deployment (keep WLOTUS name free for $0.01 launch). */
export const TEST_TOKEN_TICKER = 'WLTEST';

export const TEST_TOKEN_NAME = 'White Lotus Test';
