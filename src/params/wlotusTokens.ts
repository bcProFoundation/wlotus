/**
 * Live and abandoned WLOTUS token ids.
 *
 * Confirm with GET /api/status on each desk. Git copies of
 * `deployments/mainnet-wlotus.json` can lag or point at a failed cutover.
 */

/** Current https://wlotus.org — felt 108, ticker WLOTUS. Confirm `/api/status`. */
export const LIVE_PROD_WLOTUS_TOKEN_ID =
  'a41bf9d03961a2be83f854c8cea0b3fddf7e275ff3695d9848046052d6db3df9';

/**
 * Old SPA fallback when `VITE_PRAYER_TOKEN_ID` was unset (dWLOTUS dryrun).
 * Never a live WLOTUS era — do not adopt this id as `wlotus.liveTokenId`.
 */
export const SPA_BAKE_PLACEHOLDER_TOKEN_ID =
  '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';

/** Pre-felt 102/6 prod. Clone FROM this during the felt recut. Not live. */
export const PREV_PROD_102_6_WLOTUS_TOKEN_ID =
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

/** Thrown when mint-api would serve a known-abandoned tokenId. */
export class AbandonedDeskError extends Error {
  override name = 'AbandonedDeskError';
}

/**
 * mint-api must not serve abandoned ids (failed fcf7de59 cutover, retired
 * prod, old dWLOTUS). Git `deployments/mainnet-wlotus.json` can still be
 * fcf7de59 after a force-checkout; restore the VM overlay instead.
 */
export function assertDeskTokenId(
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const id = normalizeTokenId(tokenId);
  if (!isTokenId(id)) {
    throw new Error('Deployment JSON tokenId must be 64 hex');
  }
  const label = abandonedWlotusLabel(id);
  if (label && !envFlag('ALLOW_ABANDONED_DESK', env)) {
    throw new AbandonedDeskError(
      `Deployment JSON tokenId is ${label} — do not serve this desk. ` +
        `Restore deployments/mainnet-wlotus.json from the VM overlay ` +
        `(live ${LIVE_PROD_WLOTUS_TOKEN_ID}). Git copies can be the failed ` +
        `fcf7de59 cutover. Set ALLOW_ABANDONED_DESK=1 only to override.`,
    );
  }
  return id;
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
