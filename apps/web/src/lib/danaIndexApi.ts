/** Client for the DANA memorial index (`/index-api`). */

import {
  altarBareNameFromNote,
  altarSearchRelevance,
  memorialDisplayName,
  mergeAltarFields,
  type AltarFields,
} from './altarFields.js';
import {
  compareTrending,
  TRENDING_GRAVITY,
  trendingGroupScore,
} from '../../../../src/lib/trendingScore.js';
import { groupLotusAtoms } from '../../../../src/offering/lotusAtoms.js';

export interface IndexBurn {
  burnTxid: string;
  tokenId: string;
  note: string;
  offeringId: string;
  version: number;
  parentBurnTxid?: string;
  originalBurnTxid: string;
  blockHeight: number | null;
  blockTimestamp: number | null;
  timeFirstSeen: string;
  burnAtoms?: string;
}

export interface IndexMemorialGroup {
  originalBurnTxid: string;
  originalNote: string;
  latestBurnTxid: string;
  latestNote: string;
  totalBurns: number;
  totalLotus?: number;
  at: string;
  burns: IndexBurn[];
}

/** Rolling 24h count on the trending payload (ranking uses gravity decay). */
export const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

export { TRENDING_GRAVITY };

/** Lotus atoms shown next to the flower — not the offering tx count. */
export function groupLotusCount(
  g: {
    totalBurns?: number;
    totalLotus?: number;
    burns?: IndexBurn[];
  },
): number {
  return groupLotusAtoms(g);
}

export type IndexTrendingGroup = Omit<IndexMemorialGroup, 'burns'> & {
  /** Burns in the last 24 hours (not the rank key). */
  dayBurns: number;
  /** Gravity score when the index sent one. */
  score?: number;
  burns?: IndexBurn[];
};

/** Packed notes from an index memorial (burns, then original, then latest). */
export function indexMemorialNotes(
  remote: Pick<IndexMemorialGroup, 'originalNote' | 'latestNote' | 'burns'>,
): string[] {
  const notes: string[] = [];
  for (const b of remote.burns ?? []) {
    const n = (b.note || '').trim();
    if (n) notes.push(n);
  }
  const original = (remote.originalNote || '').trim();
  if (original) notes.push(original);
  const latest = (remote.latestNote || '').trim();
  if (latest) notes.push(latest);
  return notes;
}

/**
 * Ban thờ fields from the public index. Viewing must not depend on a local
 * Recent row — history prune only keeps this device's own offerings.
 */
export function altarFieldsFromIndexMemorial(
  remote: Pick<IndexMemorialGroup, 'originalNote' | 'latestNote' | 'burns'>,
): AltarFields | null {
  return mergeAltarFields(indexMemorialNotes(remote));
}

/** Empty = same origin `/index-api` (Vite proxy / nginx). */
function viteEnv(name: string): string | undefined {
  try {
    // Jest has no Vite `import.meta.env`; guard for unit tests.
    const env = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

export const DANA_INDEX_BASE = viteEnv('VITE_DANA_INDEX_BASE')?.trim() || '';

function indexUrl(path: string): string {
  const base = DANA_INDEX_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return `/index-api${p}`;
  return `${base}${p}`;
}

/** True when nginx/SPA returned HTML instead of the index API. */
export function looksLikeHtmlBody(text: string): boolean {
  const s = text.trimStart().slice(0, 32).toLowerCase();
  return s.startsWith('<!doctype') || s.startsWith('<html');
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (looksLikeHtmlBody(text)) {
    throw new Error('INDEX_HTML');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('INDEX_BAD_JSON');
  }
}

export async function fetchIndexRecent(
  limit = 40,
): Promise<IndexMemorialGroup[]> {
  const res = await fetch(indexUrl(`/api/recent?limit=${limit}`));
  const body = await readJson<{
    ok?: boolean;
    items?: IndexMemorialGroup[];
    error?: string;
  }>(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `Index recent ${res.status}`);
  }
  return body.items ?? [];
}

export function burnActivityMs(
  b: Pick<IndexBurn, 'blockTimestamp' | 'timeFirstSeen'>,
): number {
  if (b.blockTimestamp != null && b.blockTimestamp > 0) {
    return b.blockTimestamp * 1000;
  }
  return Date.parse(b.timeFirstSeen) || 0;
}

export function countBurnsInWindow(
  group: Pick<IndexMemorialGroup, 'burns'> | IndexTrendingGroup,
  nowMs: number,
  windowMs = TRENDING_WINDOW_MS,
): number {
  const burns = group.burns ?? [];
  const cutoff = nowMs - windowMs;
  let n = 0;
  for (const b of burns) {
    const t = burnActivityMs(b);
    if (t >= cutoff && t <= nowMs) n++;
  }
  return n;
}

/** Rank named altars by gravity-decayed offerings (client fallback). */
export function rankGroupsByTrendingScore(
  groups: IndexMemorialGroup[],
  limit: number,
  nowMs = Date.now(),
  windowMs = TRENDING_WINDOW_MS,
): IndexTrendingGroup[] {
  const scored: Array<IndexTrendingGroup & { score: number; atMs: number }> =
    [];
  for (const g of groups) {
    const times = (g.burns ?? []).map(burnActivityMs);
    const score = trendingGroupScore(times, nowMs);
    if (score <= 0) continue;
    scored.push({
      ...g,
      dayBurns: countBurnsInWindow(g, nowMs, windowMs),
      score,
      atMs: Date.parse(g.at) || 0,
    });
  }
  scored.sort(compareTrending);
  return scored
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map(({ atMs: _atMs, ...g }) => g);
}

/** @deprecated Use `rankGroupsByTrendingScore`. */
export const rankGroupsByDayBurns = rankGroupsByTrendingScore;

/**
 * Home Trending: named star-root altars ranked by gravity decay.
 * Falls back to ranking `/api/recent` when `/api/trending` is not deployed.
 */
export async function fetchIndexTrending(
  limit = 8,
  nowMs = Date.now(),
): Promise<IndexTrendingGroup[]> {
  async function fallbackViaRecent(): Promise<IndexTrendingGroup[]> {
    const recent = await fetchIndexRecent(200);
    return rankGroupsByTrendingScore(recent, limit, nowMs);
  }

  try {
    const res = await fetch(indexUrl(`/api/trending?limit=${limit}`));
    if (res.status === 404) {
      return fallbackViaRecent();
    }
    const body = await readJson<{
      ok?: boolean;
      items?: IndexTrendingGroup[];
      error?: string;
    }>(res);
    if (!res.ok || body.ok === false) {
      return fallbackViaRecent();
    }
    const items = body.items ?? [];
    return items.map(g => ({
      ...g,
      dayBurns:
        typeof g.dayBurns === 'number'
          ? g.dayBurns
          : countBurnsInWindow(g, nowMs),
    }));
  } catch {
    return fallbackViaRecent();
  }
}

export async function fetchIndexMemorial(
  txid: string,
): Promise<IndexMemorialGroup> {
  const found = await fetchIndexMemorialOrNull(txid);
  if (!found) {
    throw new Error('Memorial not found');
  }
  return found;
}

/** `null` when the live index has no star for this burn (old-token / unknown). */
export async function fetchIndexMemorialOrNull(
  txid: string,
): Promise<IndexMemorialGroup | null> {
  const id = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const res = await fetch(indexUrl(`/api/memorial/${id}`));
  if (res.status === 404) return null;
  const body = await readJson<
    IndexMemorialGroup & { ok?: boolean; error?: string }
  >(res);
  if (!res.ok || body.ok === false) {
    const err = (body.error || '').toLowerCase();
    if (res.status === 404 || err.includes('not found')) return null;
    throw new Error(body.error || `Index memorial ${res.status}`);
  }
  return body;
}

/** Client-side rank over `/api/recent` when `/api/search` is not deployed yet. */
function searchViaRecentGroups(
  groups: IndexMemorialGroup[],
  query: string,
  limit: number,
): IndexMemorialGroup[] {
  const q = query.trim();
  if (!q) return [];
  const scored = groups
    .map(group => {
      const name =
        memorialDisplayName(group.originalNote) || group.originalNote.trim();
      const bare = altarBareNameFromNote(group.originalNote);
      return { group, tier: altarSearchRelevance(name, q, bare) };
    })
    .filter(x => x.tier > 0);

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    if (a.group.totalBurns !== b.group.totalBurns) {
      return b.group.totalBurns - a.group.totalBurns;
    }
    return Date.parse(b.group.at) - Date.parse(a.group.at);
  });

  return scored
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map(x => x.group);
}

/** Search named star roots by display name — ranked server-side (see dana-index). */
export async function searchIndexMemorials(
  query: string,
  limit = 20,
): Promise<IndexMemorialGroup[]> {
  const q = query.trim();
  if (!q) return [];

  async function fallbackViaRecent(): Promise<IndexMemorialGroup[]> {
    const recent = await fetchIndexRecent(200);
    return searchViaRecentGroups(recent, q, limit);
  }

  try {
    const res = await fetch(
      indexUrl(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    );
    if (res.status === 404) {
      return fallbackViaRecent();
    }
    const body = await readJson<{
      ok?: boolean;
      items?: IndexMemorialGroup[];
      error?: string;
    }>(res);
    if (!res.ok || body.ok === false) {
      return fallbackViaRecent();
    }
    return body.items ?? [];
  } catch {
    return fallbackViaRecent();
  }
}
