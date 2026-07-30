import { searchIndexMemorials } from '../apps/web/src/lib/danaIndexApi.js';

const recentPayload = {
  ok: true,
  items: [
    {
      originalBurnTxid: 'aaaa'.padEnd(64, 'a'),
      originalNote: 'mr\u001fCao Lâm Quả\u001f',
      latestBurnTxid: 'bbbb'.padEnd(64, 'b'),
      latestNote: 'mr\u001fCao Lâm Quả\u001f',
      totalBurns: 5,
      at: '2026-07-29T02:25:40.281Z',
      burns: [],
    },
    {
      originalBurnTxid: 'cccc'.padEnd(64, 'c'),
      originalNote: 'mrs\u001fĐinh Thị Hồng Chăm\u001f',
      latestBurnTxid: 'dddd'.padEnd(64, 'd'),
      latestNote: 'mrs\u001fĐinh Thị Hồng Chăm\u001f',
      totalBurns: 1,
      at: '2026-07-29T05:12:45.587Z',
      burns: [],
    },
  ],
};

describe('searchIndexMemorials', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('falls back to /api/recent when /api/search returns 404', async () => {
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search')) {
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

    const results = await searchIndexMemorials('cao', 10);
    expect(results).toHaveLength(1);
    expect(results[0]?.originalBurnTxid).toBe('aaaa'.padEnd(64, 'a'));
  });

  it('uses /api/search when available', async () => {
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search')) {
        return new Response(
          JSON.stringify({
            ok: true,
            items: [recentPayload.items[1]],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchIndexMemorials('hong', 10);
    expect(results).toHaveLength(1);
    expect(results[0]?.originalBurnTxid).toBe('cccc'.padEnd(64, 'c'));
  });
});
