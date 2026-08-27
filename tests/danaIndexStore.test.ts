import { BurnStore, type IndexedBurn } from '../apps/dana-index/src/store.js';
import { ALTAR_SEP } from '../src/offering/altarFields.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function burn(
  partial: Partial<IndexedBurn> & Pick<IndexedBurn, 'burnTxid' | 'note'>,
): IndexedBurn {
  return {
    tokenId: 'aa'.repeat(32),
    offeringId: 'wlotus',
    version: partial.parentBurnTxid ? 2 : 1,
    originalBurnTxid: partial.parentBurnTxid || partial.burnTxid,
    blockHeight: 1,
    blockTimestamp: partial.blockTimestamp ?? 1_700_000_000,
    timeFirstSeen: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('BurnStore', () => {
  let dir: string;
  let store: BurnStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dana-index-'));
    store = new BurnStore(join(dir, 'burns.json'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('groups re-offers under the original dedication', () => {
    const root =
      '7ab478bcfddf6eb5130d33395846012c20b92ac48f19025ef8d53ba3d7d5e359';
    const child =
      'b38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: root,
        note: 'Cao Lâm Quả',
        blockTimestamp: 1_700_000_000,
      }),
    );
    store.upsert(
      burn({
        burnTxid: child,
        note: 'nhớ mãi',
        parentBurnTxid: root,
        blockTimestamp: 1_700_000_100,
      }),
    );

    const recent = store.recentGroups(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.originalNote).toBe('Cao Lâm Quả');
    expect(recent[0]!.latestNote).toBe('nhớ mãi');
    expect(recent[0]!.totalBurns).toBe(2);

    const memorial = store.memorial(child);
    expect(memorial?.originalBurnTxid).toBe(root);
    expect(memorial?.burns.map(b => b.note)).toEqual(['nhớ mãi', 'Cao Lâm Quả']);
  });

  it('skips orphan re-offers when the original is not indexed', () => {
    const root =
      'a38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const child =
      'b38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: child,
        note: '',
        parentBurnTxid: root,
        blockTimestamp: 1_700_000_100,
      }),
    );
    expect(store.recentGroups(10)).toHaveLength(0);
    expect(store.memorial(child)).toBeNull();
  });

  it('skips empty-name roots', () => {
    const root =
      'c38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: root,
        note: '  ',
        blockTimestamp: 1_700_000_000,
      }),
    );
    expect(store.recentGroups(10)).toHaveLength(0);
  });

  it('searches by name, ranking exact match before contains', () => {
    const rootA =
      'd38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootB =
      'e38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootC =
      'f38825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(burn({ burnTxid: rootA, note: 'Cao Lâm Quả' }));
    store.upsert(burn({ burnTxid: rootB, note: 'Quả' }));
    store.upsert(burn({ burnTxid: rootC, note: 'Nguyễn Văn A' }));

    const results = store.searchGroups('quả', 10);
    expect(results.map(r => r.originalBurnTxid)).toEqual([rootB, rootA]);
    expect(store.searchGroups('nguyen', 10)).toHaveLength(1);
    expect(store.searchGroups('', 10)).toHaveLength(0);
    expect(store.searchGroups('không tồn tại', 10)).toHaveLength(0);
  });

  it('breaks ties within the same relevance tier by offering count', () => {
    const rootA =
      '138825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootB =
      '238825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(burn({ burnTxid: rootA, note: 'Cao Lâm Quả' }));
    store.upsert(burn({ burnTxid: rootB, note: 'Cao Lâm An' }));
    // Both match "cao" at the same (contains) tier — rootB gets more
    // fragments, so it should rank first on offering score.
    for (let i = 0; i < 4; i++) {
      store.upsert(
        burn({
          burnTxid: `${rootB.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: rootB,
          blockTimestamp: 1_700_000_100 + i,
        }),
      );
    }

    const results = store.searchGroups('cao', 10);
    expect(results.map(r => r.originalBurnTxid)).toEqual([rootB, rootA]);
  });

  it('ranks honorific-prefixed names by offering score when query matches bare name', () => {
    const rootHigh =
      '338825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootMid =
      '438825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const rootLow =
      '538825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    store.upsert(
      burn({
        burnTxid: rootHigh,
        note: `mr${ALTAR_SEP}Cao Lâm Quả${ALTAR_SEP}`,
      }),
    );
    store.upsert(
      burn({
        burnTxid: rootMid,
        note: `mr${ALTAR_SEP}Cao Lâm Thanh${ALTAR_SEP}`,
      }),
    );
    store.upsert(burn({ burnTxid: rootLow, note: 'Cao Lâm Quả' }));
    for (let i = 0; i < 8; i++) {
      store.upsert(
        burn({
          burnTxid: `${rootHigh.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: rootHigh,
          blockTimestamp: 1_700_000_200 + i,
        }),
      );
    }
    for (let i = 0; i < 3; i++) {
      store.upsert(
        burn({
          burnTxid: `${rootMid.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: rootMid,
          blockTimestamp: 1_700_000_300 + i,
        }),
      );
    }
    for (let i = 0; i < 2; i++) {
      store.upsert(
        burn({
          burnTxid: `${rootLow.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: rootLow,
          blockTimestamp: 1_700_000_400 + i,
        }),
      );
    }

    const results = store.searchGroups('cao', 10);
    expect(results.map(r => r.originalBurnTxid)).toEqual([
      rootHigh,
      rootMid,
      rootLow,
    ]);
    expect(results.map(r => r.totalBurns)).toEqual([9, 4, 3]);
  });

  it('ranks trending by burns in 24 hours across person and event altars', () => {
    const person =
      '638825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const event =
      '738825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const quiet =
      '838825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const nowSec = 1_800_000_000;
    const nowMs = nowSec * 1000;

    store.upsert(
      burn({
        burnTxid: person,
        note: 'Cao Lâm Quả',
        blockTimestamp: nowSec - 3600,
      }),
    );
    for (let i = 0; i < 8; i++) {
      store.upsert(
        burn({
          burnTxid: `${person.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: person,
          blockTimestamp: nowSec - 3 * 86_400 - i,
        }),
      );
    }
    store.upsert(
      burn({
        burnTxid: event,
        note: `e${ALTAR_SEP}Vu Lan hội${ALTAR_SEP}`,
        blockTimestamp: nowSec - 100,
      }),
    );
    for (let i = 0; i < 3; i++) {
      store.upsert(
        burn({
          burnTxid: `${event.slice(0, 62)}${i}${i}`,
          note: '',
          parentBurnTxid: event,
          blockTimestamp: nowSec - 200 - i,
        }),
      );
    }
    store.upsert(
      burn({
        burnTxid: quiet,
        note: 'Old altar',
        blockTimestamp: nowSec - 5 * 86_400,
      }),
    );

    const trending = store.trendingGroups(8, nowMs);
    expect(trending.map(r => r.originalBurnTxid)).toEqual([event, person]);
    expect(trending.map(r => r.dayBurns)).toEqual([4, 1]);
    expect(trending.map(r => r.totalBurns)).toEqual([4, 9]);
    expect(trending.every(r => r.burns.length === 0)).toBe(true);
  });

  it('counts a previous-calendar-day burn that is still within 24 hours', () => {
    const recent =
      '938825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    const stale =
      'a48825a5afae52895126a77287a1f2480f0a8813699b824a5cbfc390cc0d2838';
    // 01:00 UTC on 27 Aug — calendar "today" would drop 26 Aug entirely.
    const nowMs = Date.parse('2026-08-27T01:00:00.000Z');
    const withinSec = Math.floor(Date.parse('2026-08-26T02:00:00.000Z') / 1000);
    const outsideSec = Math.floor(Date.parse('2026-08-26T00:30:00.000Z') / 1000);

    store.upsert(
      burn({
        burnTxid: recent,
        note: 'Within window',
        blockTimestamp: withinSec,
      }),
    );
    store.upsert(
      burn({
        burnTxid: stale,
        note: 'Outside window',
        blockTimestamp: outsideSec,
      }),
    );

    const trending = store.trendingGroups(8, nowMs);
    expect(trending.map(r => r.originalBurnTxid)).toEqual([recent]);
    expect(trending[0]!.dayBurns).toBe(1);
  });
});
