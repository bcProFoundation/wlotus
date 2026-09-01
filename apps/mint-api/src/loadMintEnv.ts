/**
 * Load mint-api env before any other mint-api module.
 *
 * ESM evaluates `import` graphs before this file's importer body. If
 * `offer.ts` is imported first, `MINT_SERVING_TIP_INDEX` is still unset and
 * the desk pins baton 0 — test then races prod on the live token.
 *
 * `server.ts` must import `./loadMintEnv.boot.js` first.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

export function loadMintApiEnv(opts?: {
  cwd?: string;
  mintEnvPath?: string;
}): ReturnType<typeof loadEnv> {
  const cwd = opts?.cwd ?? process.cwd();
  loadEnv({ path: resolve(cwd, '.env') });
  return loadEnv({
    path: opts?.mintEnvPath ?? '/etc/wlotus/mint.env',
    override: true,
  });
}
