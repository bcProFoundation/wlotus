import {
  mergeSearchResults,
  noteLooksLikeNameQuery,
  rankSearchCandidates,
  type SearchCandidate,
} from '../apps/web/src/lib/searchAltars.js';

describe('rankSearchCandidates', () => {
  it('ranks exact match over prefix over contains', () => {
    const candidates: SearchCandidate[] = [
      { txid: 'a', name: 'Cao Lâm Quả', totalBurns: 5, atMs: 1 },
      { txid: 'b', name: 'Quả', totalBurns: 1, atMs: 1 },
      { txid: 'c', name: 'Quả Cao', totalBurns: 1, atMs: 1 },
    ];
    const rows = rankSearchCandidates(candidates, 'quả');
    expect(rows.map(r => r.txid)).toEqual(['b', 'c', 'a']);
  });

  it('is diacritic and case insensitive (Vietnamese friendly)', () => {
    const candidates: SearchCandidate[] = [
      { txid: 'a', name: 'Bà Cao Lâm Quả', totalBurns: 1, atMs: 1 },
    ];
    expect(rankSearchCandidates(candidates, 'ba cao lam qua')).toHaveLength(1);
    expect(rankSearchCandidates(candidates, 'BÀ CAO')).toHaveLength(1);
  });

  it('breaks ties within the same relevance tier by offering score', () => {
    const candidates: SearchCandidate[] = [
      { txid: 'low', name: 'Cao Lâm Quả', totalBurns: 2, atMs: 1 },
      { txid: 'high', name: 'Cao Lâm An', totalBurns: 9, atMs: 1 },
    ];
    const rows = rankSearchCandidates(candidates, 'cao');
    expect(rows.map(r => r.txid)).toEqual(['high', 'low']);
  });

  it('falls back to most recent activity when tier and score tie', () => {
    const candidates: SearchCandidate[] = [
      { txid: 'older', name: 'Cao Lâm Quả', totalBurns: 3, atMs: 100 },
      { txid: 'newer', name: 'Cao Lâm An', totalBurns: 3, atMs: 200 },
    ];
    const rows = rankSearchCandidates(candidates, 'cao');
    expect(rows.map(r => r.txid)).toEqual(['newer', 'older']);
  });

  it('excludes non-matching names', () => {
    const candidates: SearchCandidate[] = [
      { txid: 'a', name: 'Cao Lâm Quả', totalBurns: 1, atMs: 1 },
    ];
    expect(rankSearchCandidates(candidates, 'nguyen')).toEqual([]);
  });
});

describe('mergeSearchResults', () => {
  it('prefers index rows and appends device-only extras', () => {
    const primary = [{ txid: 'a', label: 'A', totalBurns: 10 }];
    const extra = [
      { txid: 'a', label: 'A (local)', totalBurns: 1 },
      { txid: 'b', label: 'B', totalBurns: 1 },
    ];
    expect(mergeSearchResults(primary, extra)).toEqual([
      { txid: 'a', label: 'A', totalBurns: 10 },
      { txid: 'b', label: 'B', totalBurns: 1 },
    ]);
  });

  it('caps combined results at the limit', () => {
    const primary = [{ txid: 'a', label: 'A', totalBurns: 1 }];
    const extra = [
      { txid: 'b', label: 'B', totalBurns: 1 },
      { txid: 'c', label: 'C', totalBurns: 1 },
    ];
    expect(mergeSearchResults(primary, extra, 2)).toHaveLength(2);
  });
});

describe('noteLooksLikeNameQuery', () => {
  it('accepts short single-line name queries', () => {
    expect(noteLooksLikeNameQuery('cao')).toBe(true);
    expect(noteLooksLikeNameQuery('Cao Lâm')).toBe(true);
  });

  it('rejects empty, multi-line, and very long text', () => {
    expect(noteLooksLikeNameQuery('')).toBe(false);
    expect(noteLooksLikeNameQuery('a')).toBe(false);
    expect(noteLooksLikeNameQuery('line1\nline2')).toBe(false);
    expect(noteLooksLikeNameQuery('x'.repeat(81))).toBe(false);
  });
});
