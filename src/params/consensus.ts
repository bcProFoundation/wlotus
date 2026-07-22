/**
 * WLOTUS family consensus parameters.
 *
 * Flower / Candle = economic MoE.
 * Prayer / Incense = non-economic ritual chrome.
 * See pricing.ts / docs/ECONOMICS.md.
 */

export const PRAYER_TICKER = 'PRAYER';
export const PRAYER_NAME = 'Prayer';

export const INCENSE_TICKER = 'INCENSE';
export const INCENSE_NAME = 'Incense';

export const CANDLE_TICKER = 'CANDLE';
export const CANDLE_NAME = 'Candle';

export const PROD_TOKEN_TICKER = 'WLOTUS';
export const PROD_TOKEN_NAME = 'wLotus';
export const FLOWER_TICKER = PROD_TOKEN_TICKER;
export const FLOWER_NAME = 'Flower';

/** @deprecated */
export const NWLPOW_TICKER = INCENSE_TICKER;
export const NWLPOW_NAME = INCENSE_NAME;
/** @deprecated */
export const TOKEN_TICKER = CANDLE_TICKER;
export const TOKEN_NAME = CANDLE_NAME;

export const DOGFOOD_TICKER_MWLPOW = 'mWLPOW';

export const TOKEN_DECIMALS = 0;
export const PROD_TOKEN_DECIMALS = 0;
export const POW_LEADING_ZERO_BYTES = 1;

/** Prayer — phone ~30 s (non-economic). */
export const POW_PRAYER_BASE_ZERO_BITS = 22;

/** Incense — trivial PoW / fee-only (non-economic). */
export const POW_INCENSE_BASE_ZERO_BITS = 8;

/**
 * Candle — 1/baton, GPU wall-clock (~43 bits). Soft ~1/10 Flower token.
 * Not full ASIC anti-arb vs Flower.
 */
export const POW_CANDLE_BASE_ZERO_BITS = 43;

/** Flower — $1/baton → ~59 bits. */
export const POW_FLOWER_BASE_ZERO_BITS = 59;

/** @deprecated */
export const POW_N_BASE_ZERO_BITS = POW_INCENSE_BASE_ZERO_BITS;
/** @deprecated */
export const POW_M_BASE_ZERO_BITS = POW_CANDLE_BASE_ZERO_BITS;
/** @deprecated */
export const POW_W_BASE_ZERO_BITS = POW_FLOWER_BASE_ZERO_BITS;
export const POW_BASE_ZERO_BITS = POW_LEADING_ZERO_BYTES * 8;

export const BASE_MINT_ATOMS = 100n;

export const PRAYER_MINT_ATOMS = 1n;
export const INCENSE_MINT_ATOMS = 100n;
export const CANDLE_MINT_ATOMS = 1n;
export const FLOWER_MINT_ATOMS = 100n;

/**
 * ALP mempool policy caps token outputs per tx at 29 (`ALP_POLICY_MAX_OUTPUTS`).
 * Genesis with one fungible mint output ⇒ at most 28 PoW batons.
 * **Immutable after genesis** — always mint the max; desk may serve fewer tips.
 */
export const ALP_GENESIS_MAX_TOKEN_OUTPUTS = 29;
export const POW_BATON_COUNT_MAX = ALP_GENESIS_MAX_TOKEN_OUTPUTS - 1; // 28
/** Default / required genesis baton count (use the ALP maximum). */
export const POW_BATON_COUNT = POW_BATON_COUNT_MAX;

export const MOORE_NUM = 99918n;
export const MOORE_DEN = 100000n;
export const MOORE_NUM_OBSOLETE = 99826n;

export const MOORE_DAY_BLOCKS = 144;
export const MOORE_DAY_SECONDS = 86_400;

/**
 * Calendar days per +1 Moore bit (baked into covenant at genesis).
 * Default **500** — 五百罗汉 (Five Hundred Arhats): one arhat-day per calendar day
 * until the bit ticks. Override: `MOORE_DAYS_PER_EXTRA_BIT=365..730`.
 * Existing deployments keep whatever `secondsPerExtraBit` was baked in JSON.
 */
export const MOORE_DAYS_PER_EXTRA_BIT = 500;

/** Allowed range for genesis override (~1–2 years). */
export const MOORE_DAYS_PER_EXTRA_BIT_MIN = 365;
export const MOORE_DAYS_PER_EXTRA_BIT_MAX = 730;

/**
 * Resolve days/bit for a new genesis. Clamps to 365–730.
 * Env: `MOORE_DAYS_PER_EXTRA_BIT` (default 500).
 */
export function resolveMooreDaysPerExtraBit(
  raw: string | undefined = process.env.MOORE_DAYS_PER_EXTRA_BIT,
): number {
  const s = (raw ?? '').trim();
  if (s === '') return MOORE_DAYS_PER_EXTRA_BIT;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return MOORE_DAYS_PER_EXTRA_BIT;
  return Math.min(
    MOORE_DAYS_PER_EXTRA_BIT_MAX,
    Math.max(MOORE_DAYS_PER_EXTRA_BIT_MIN, Math.round(n)),
  );
}

/** Economic peg only: 10 Candle tokens ≈ 1 Flower token. */
export const CANDLE_PER_FLOWER = 10n;

/** @deprecated non-economic — do not use for MoE conversion */
export const PRAYER_PER_INCENSE = 0n;
/** @deprecated */
export const INCENSE_PER_CANDLE = 0n;
/** @deprecated old milli peg */
export const MWLOTUS_PER_WLOTUS = CANDLE_PER_FLOWER;
export const MWLPOW_PER_WLOTUS = MWLOTUS_PER_WLOTUS;
export const NWLPOW_PER_MWLPOW = 0n;
export const NWLPOW_PER_WLOTUS = 0n;

/** Document / website URI written into ALP genesis metadata (immutable after mint). */
export const TOKEN_URL = 'https://wlotus.org';
