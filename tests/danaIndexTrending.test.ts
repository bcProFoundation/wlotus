import {
  fetchIndexTrending,
  rankGroupsByDayBurns,
  type IndexBurn,
  type IndexMemorialGroup,
} from '../apps/web/src/lib/danaIndexApi.js';

const nowMs = Date.parse('2026-08-27T12:00:00.000Z');
const nowSec = Math.floor(nowMs / 1000);

function tx(ch: string): string {
  return ch.repeat(64);
}

function idxBurn(
  partial: Partial<IndexBurn> & Pick<IndexBurn, 'burnTxid'>,
): IndexBurn {
  return {
    tokenId: tx('a'),
    note: '',
    offeringId: 'wlotus',
    version: 1,
    originalBurnTxid: partial.originalBurnTxid || partial.burnTxid,
    blockHeight: 1,
    blockTimestamp: nowSec,
    timeFirstSeen: '2026-08-27T00:00:00.000Z',
    ...partial,
  };
}

function group(
  id: string,
  note: string,
  stamps: number[],
): IndexMemorialGroup {
  const burns = stamps.map((blockTimestamp, i) =>
    idxBurn({
      burnTxid: `${id.slice(0, 62)}${i}${i}`,
      originalBurnTxid: id,
      parentBurnTxid: i === 0 ? undefined : id,
      blockTimestamp,
    }),
  );
  return {
    originalBurnTxid: id,
    originalNote: note,
    latestBurnTxid: burns[0]!.burnTxid,
    latestNote: note,
    totalBurns: burns.length,
    at: new Date(Math.max(...stamps) * 1000).toISOString(),
    burns,
  };
}

const person = tx('1');
const event = tx('2');
const quiet = tx('3');

const recentPayload = {
  ok: true,
  items: [
    group(person, 'Cao Lâm Quả', [nowSec - 3600, nowSec - 3 * 86_400]),
    group(event, 'Vu Lan hội', [nowSec - 100, nowSec - 200, nowSec - 300]),
    group(quiet, 'Old altar', [nowSec - 5 * 86_400]),
  ],
};

describe('rankGroupsByDayBurns', () => {
  it('ranks by decay and still includes altars quieter than 24 hours', () => {
    const ranked = rankGroupsByDayBurns(recentPayload.items, 8, nowMs);
    expect(ranked.map(r => r.originalBurnTxid)).toEqual([
      event,
      person,
      quiet,
    ]);
    expect(ranked.map(r => r.dayBurns)).toEqual([3, 1, 0]);
    expect(ranked.map(r => r.totalBurns)).toEqual([3, 2, 1]);
    expect(ranked[0]!.score!).toBeGreaterThan(ranked[1]!.score!);
    expect(ranked[1]!.score!).toBeGreaterThan(ranked[2]!.score!);
  });
});

describe('fetchIndexTrending', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses /api/trending when available', async () => {
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/trending')) {
        return new Response(
          JSON.stringify({
            ok: true,
            items: [
              {
                originalBurnTxid: event,
                originalNote: 'Vu Lan hội',
                latestBurnTxid: event,
                latestNote: 'Vu Lan hội',
                totalBurns: 40,
                at: '2026-08-27T11:00:00.000Z',
                dayBurns: 5,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await fetchIndexTrending(8, nowMs);
    expect(results).toHaveLength(1);
    expect(results[0]?.dayBurns).toBe(5);
    expect(results[0]?.totalBurns).toBe(40);
  });

  it('falls back to /api/recent when /api/trending returns 404', async () => {
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/trending')) {
        return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/recent')) {
        return new Response(JSON.stringify(recentPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await fetchIndexTrending(8, nowMs);
    expect(results.map(r => r.originalBurnTxid)).toEqual([
      event,
      person,
      quiet,
    ]);
    expect(results.map(r => r.dayBurns)).toEqual([3, 1, 0]);
  });
});
