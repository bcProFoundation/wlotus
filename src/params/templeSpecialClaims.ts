/**
 * First-burn claims: bind a catalog special `id` to the first root txid.
 * Temple does not pre-burn; the first visitor's offering becomes the root.
 *
 * File is a `{ [specialId]: txid }` map. First writer wins.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TXID_RE = /^[0-9a-f]{64}$/;

export function claimsFilePath(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const explicit = env.TEMPLE_SPECIAL_CLAIMS_FILE?.trim();
  if (explicit) return explicit;
  return resolve(process.cwd(), 'deployments/temple-special-claims.json');
}

export function loadSpecialClaims(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Record<string, string> {
  const path = claimsFilePath(env);
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = String(k || '')
        .trim()
        .toLowerCase();
      const txid = String(v || '')
        .trim()
        .toLowerCase();
      if (!id || !TXID_RE.test(txid)) continue;
      out[id] = txid;
    }
    return out;
  } catch {
    return {};
  }
}

export function claimSpecialRoot(
  specialId: string,
  profileId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { ok: true; profileId: string; created: boolean } | { ok: false; error: string; profileId?: string } {
  const id = specialId.trim().toLowerCase();
  const txid = profileId.trim().toLowerCase();
  if (!id) return { ok: false, error: 'specialId required' };
  if (!TXID_RE.test(txid)) return { ok: false, error: 'profileId must be 64 hex' };

  const current = loadSpecialClaims(env);
  const existing = current[id];
  if (existing) {
    if (existing === txid) return { ok: true, profileId: existing, created: false };
    return {
      ok: false,
      error: 'already claimed',
      profileId: existing,
    };
  }
  current[id] = txid;
  const path = claimsFilePath(env);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `could not write claims file: ${msg}` };
  }
  return { ok: true, profileId: txid, created: true };
}

/** Rebind a catalog special to a new root (token recut). */
export function rebindSpecialRoot(
  specialId: string,
  profileId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { ok: true; profileId: string; previous: string | null } | { ok: false; error: string } {
  const id = specialId.trim().toLowerCase();
  const txid = profileId.trim().toLowerCase();
  if (!id) return { ok: false, error: 'specialId required' };
  if (!TXID_RE.test(txid)) return { ok: false, error: 'profileId must be 64 hex' };
  const current = loadSpecialClaims(env);
  const previous = current[id] ?? null;
  current[id] = txid;
  const path = claimsFilePath(env);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `could not write claims file: ${msg}` };
  }
  return { ok: true, profileId: txid, previous };
}
