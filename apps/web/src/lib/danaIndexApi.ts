/** Client for the DANA memorial index (`/index-api`). */

import {
  altarBareNameFromNote,
  altarSearchRelevance,
  memorialDisplayName,
} from './altarFields.js';

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
}

export interface IndexMemorialGroup {
  originalBurnTxid: string;
  originalNote: string;
  latestBurnTxid: string;
  latestNote: string;
  totalBurns: number;
  at: string;
  burns: IndexBurn[];
}

/** Rolling 24h window — same as dana-index `TRENDING_WINDOW_MS`. */
export const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

export type IndexTrendingGroup = Omit<IndexMemorialGroup, 'burns'> & {
  /** Burns whose activity time falls in the trending window. */
  dayBurns: number;
  burns?: IndexBurn[];
};

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

/** Rank named altars by burns in the last day (client fallback). */
export function rankGroupsByDayBurns(
  groups: IndexMemorialGroup[],
  limit: number,
  nowMs = Date.now(),
  windowMs = TRENDING_WINDOW_MS,
): IndexTrendingGroup[] {
  const scored: IndexTrendingGroup[] = [];
  for (const g of groups) {
    const dayBurns = countBurnsInWindow(g, nowMs, windowMs);
    if (dayBurns <= 0) continue;
    scored.push({ ...g, dayBurns });
  }
  scored.sort((a, b) => {
    if (a.dayBurns !== b.dayBurns) return b.dayBurns - a.dayBurns;
    return Date.parse(b.at) - Date.parse(a.at);
  });
  return scored.slice(0, Math.max(1, Math.min(50, limit)));
}

/**
 * Home Trending: all named star-root altars, ranked by burns in one day.
 * Falls back to ranking `/api/recent` when `/api/trending` is not deployed.
 */
export async function fetchIndexTrending(
  limit = 8,
  nowMs = Date.now(),
): Promise<IndexTrendingGroup[]> {
  async function fallbackViaRecent(): Promise<IndexTrendingGroup[]> {
    const recent = await fetchIndexRecent(200);
    return rankGroupsByDayBurns(recent, limit, nowMs);
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
  const id = txid.trim().toLowerCase();
  const res = await fetch(indexUrl(`/api/memorial/${id}`));
  const body = await readJson<IndexMemorialGroup & { ok?: boolean; error?: string }>(
    res,
  );
  if (!res.ok || body.ok === false) {
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
