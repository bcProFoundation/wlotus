import { fetchIndexMemorialOrNull } from '../apps/web/src/lib/danaIndexApi.js';

const ROOT = '51a2211da2aa54ed8eea53ea17e8eb848053df066f03d403bde1aac9c03112ad';

describe('fetchIndexMemorialOrNull', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null on HTTP 404', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, error: 'Memorial not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    await expect(fetchIndexMemorialOrNull(ROOT)).resolves.toBeNull();
  });

  it('rejects a 500 whose error text contains not found', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, error: 'Memorial not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    await expect(fetchIndexMemorialOrNull(ROOT)).rejects.toThrow(
      /Memorial not found/,
    );
  });

  it('returns the group on 200', async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          originalBurnTxid: ROOT,
          originalNote: 'Nepal',
          latestBurnTxid: ROOT,
          latestNote: 'Nepal',
          totalBurns: 1,
          at: '2026-09-01T00:00:00.000Z',
          burns: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;
    const g = await fetchIndexMemorialOrNull(ROOT);
    expect(g?.originalBurnTxid).toBe(ROOT);
  });
});
