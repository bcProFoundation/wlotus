/**
 * Live and abandoned WLOTUS token ids.
 *
 * Confirm with GET /api/status on each desk. Git copies of
 * `deployments/mainnet-wlotus.json` can lag or point at a failed cutover.
 */

/** Current https://wlotus.org — 102/6 temple, ticker WLOTUS. Clone FROM this. */
export const LIVE_PROD_WLOTUS_TOKEN_ID =
  'f4e452ef78eaf61908d30ecbd804df5588c6bb6aeea61cf0cbe8bf2186764456';

/** Retired 1/107 (or earlier) prod genesis. Not live. */
export const RETIRED_PROD_WLOTUS_TOKEN_ID =
  '154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091';

/** Old test dWLOTUS. Do not clone FROM this into the felt recut. */
export const OLD_TEST_DWLOTUS_TOKEN_ID =
  'ffc15eb40711fbf069370a4f90ca44ce7913968a6d5940df9890343066f119ec';

/**
 * Failed felt cutover on test.wlotus.org (ticker WLOTUS, mixed history).
 * Abandon. Do not clone FROM or TO this id. Do not point prod at it.
 */
export const FAILED_FELT_CUTOVER_TOKEN_ID =
  'fcf7de592aceef5c0ee118fa8830daeb3d0efb445020e92b8a102e5127555ec4';

const TOKEN_ID_RE = /^[0-9a-f]{64}$/;

export const ABANDONED_WLOTUS_TOKEN_IDS: Readonly<Record<string, string>> = {
  [RETIRED_PROD_WLOTUS_TOKEN_ID]: 'retired prod (154d229b…)',
  [OLD_TEST_DWLOTUS_TOKEN_ID]: 'old test dWLOTUS (ffc15eb4…)',
  [FAILED_FELT_CUTOVER_TOKEN_ID]: 'failed felt cutover (fcf7de59…)',
};

export function normalizeTokenId(raw: string | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

export function isTokenId(raw: string): boolean {
  return TOKEN_ID_RE.test(raw);
}

export function abandonedWlotusLabel(tokenId: string): string | undefined {
  return ABANDONED_WLOTUS_TOKEN_IDS[normalizeTokenId(tokenId)];
}

function envFlag(name: string, env: NodeJS.ProcessEnv): boolean {
  const v = (env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * FROM must be explicit (no silent 154d229b fallback) and must not be an
 * abandoned id unless ALLOW_ABANDONED_FROM=1.
 */
export function requireMigrateFromTokenId(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const id = normalizeTokenId(env.FROM_TOKEN_ID);
  if (!isTokenId(id)) {
    throw new Error(
      `FROM_TOKEN_ID must be a 64-hex token id. Clone live prod:\n` +
        `  FROM_TOKEN_ID=${LIVE_PROD_WLOTUS_TOKEN_ID}`,
    );
  }
  const label = abandonedWlotusLabel(id);
  if (label && !envFlag('ALLOW_ABANDONED_FROM', env)) {
    throw new Error(
      `FROM_TOKEN_ID is ${label} — abandoned. Clone live prod ` +
        `${LIVE_PROD_WLOTUS_TOKEN_ID} (wlotus.org). ` +
        `Set ALLOW_ABANDONED_FROM=1 only if you really mean this source.`,
    );
  }
  return id;
}

/**
 * Dest must not be a known-abandoned token (failed cutover / retired)
 * unless ALLOW_ABANDONED_TO=1. Genesis a new WLOTUS first.
 */
export function assertMigrateToTokenId(
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const id = normalizeTokenId(tokenId);
  if (!isTokenId(id)) {
    throw new Error('TO_TOKEN_ID must be a 64-hex token id');
  }
  const label = abandonedWlotusLabel(id);
  if (label && !envFlag('ALLOW_ABANDONED_TO', env)) {
    throw new Error(
      `TO_TOKEN_ID is ${label} — do not migrate onto it. ` +
        `Genesis a new ticker-WLOTUS token on the test VM, then migrate. ` +
        `Set ALLOW_ABANDONED_TO=1 only to override.`,
    );
  }
  return id;
}
