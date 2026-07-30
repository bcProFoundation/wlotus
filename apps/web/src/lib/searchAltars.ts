/**
 * Client-side ranking for name search — combines the public dana-index
 * search (canonical offering counts across all users) with this device's
 * Recent list as an offline / not-yet-indexed fallback.
 */

import { altarSearchRelevance } from './altarFields.js';

export interface SearchCandidate {
  txid: string;
  name: string;
  /** Public or local offering count — the "offering score" tie-break. */
  totalBurns: number;
  atMs: number;
}

export interface SearchResultRow {
  txid: string;
  label: string;
  totalBurns: number;
}

/**
 * Rank candidates by name relevance (exact → prefix → contains), then by
 * offering count, then by most recent activity.
 */
export function rankSearchCandidates(
  candidates: SearchCandidate[],
  query: string,
): SearchResultRow[] {
  const scored = candidates
    .filter(c => c.name.trim().length > 0)
    .map(c => ({ c, tier: altarSearchRelevance(c.name, query) }))
    .filter(x => x.tier > 0);

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    if (a.c.totalBurns !== b.c.totalBurns) return b.c.totalBurns - a.c.totalBurns;
    return b.c.atMs - a.c.atMs;
  });

  return scored.map(x => ({
    txid: x.c.txid,
    label: x.c.name,
    totalBurns: x.c.totalBurns,
  }));
}

/** Union primary (index) results with device-only extras, primary first. */
export function mergeSearchResults(
  primary: SearchResultRow[],
  extra: SearchResultRow[],
  limit = 30,
): SearchResultRow[] {
  const seen = new Set(primary.map(r => r.txid.toLowerCase()));
  const rest = extra.filter(r => !seen.has(r.txid.toLowerCase()));
  return [...primary, ...rest].slice(0, Math.max(1, limit));
}

/**
 * Whether the memorial textarea value should trigger name suggestions.
 * Skips share links, multi-line dedications, and very short / long free text.
 */
export function noteLooksLikeNameQuery(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/[\r\n]/.test(raw)) return false;
  return true;
}
