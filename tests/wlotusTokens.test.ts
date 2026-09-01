import {
  AbandonedDeskError,
  assertDeskTokenId,
  assertMigrateToTokenId,
  FAILED_FELT_CUTOVER_TOKEN_ID,
  LIVE_PROD_WLOTUS_TOKEN_ID,
  OLD_TEST_DWLOTUS_TOKEN_ID,
  PREV_PROD_102_6_WLOTUS_TOKEN_ID,
  requireMigrateFromTokenId,
  RETIRED_PROD_WLOTUS_TOKEN_ID,
} from '../src/params/wlotusTokens.js';

describe('wlotusTokens migrate guards', () => {
  const live = LIVE_PROD_WLOTUS_TOKEN_ID;
  const prev1026 = PREV_PROD_102_6_WLOTUS_TOKEN_ID;
  const retired = RETIRED_PROD_WLOTUS_TOKEN_ID;
  const oldTest = OLD_TEST_DWLOTUS_TOKEN_ID;
  const failed = FAILED_FELT_CUTOVER_TOKEN_ID;

  it('requires explicit FROM_TOKEN_ID (no 154d229b fallback)', () => {
    expect(() => requireMigrateFromTokenId({})).toThrow(/FROM_TOKEN_ID/);
    expect(() => requireMigrateFromTokenId({})).toThrow(live);
    expect(requireMigrateFromTokenId({ FROM_TOKEN_ID: live })).toBe(live);
    expect(requireMigrateFromTokenId({ FROM_TOKEN_ID: prev1026 })).toBe(
      prev1026,
    );
  });

  it('refuses abandoned FROM unless ALLOW_ABANDONED_FROM=1', () => {
    expect(() =>
      requireMigrateFromTokenId({ FROM_TOKEN_ID: retired }),
    ).toThrow(/abandoned/);
    expect(() =>
      requireMigrateFromTokenId({ FROM_TOKEN_ID: oldTest }),
    ).toThrow(/dWLOTUS/);
    expect(() =>
      requireMigrateFromTokenId({ FROM_TOKEN_ID: failed }),
    ).toThrow(/failed felt cutover/);
    expect(
      requireMigrateFromTokenId({
        FROM_TOKEN_ID: failed,
        ALLOW_ABANDONED_FROM: '1',
      }),
    ).toBe(failed);
  });

  it('refuses abandoned TO unless ALLOW_ABANDONED_TO=1', () => {
    expect(() => assertMigrateToTokenId(failed)).toThrow(/do not migrate onto/);
    expect(assertMigrateToTokenId(failed, { ALLOW_ABANDONED_TO: '1' })).toBe(
      failed,
    );
    expect(assertMigrateToTokenId('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it('refuses mint-api desk JSON on abandoned ids unless ALLOW_ABANDONED_DESK=1', () => {
    expect(() => assertDeskTokenId(failed)).toThrow(AbandonedDeskError);
    expect(() => assertDeskTokenId(failed)).toThrow(/do not serve this desk/);
    expect(assertDeskTokenId(live)).toBe(live);
    expect(
      assertDeskTokenId(failed, { ALLOW_ABANDONED_DESK: '1' }),
    ).toBe(failed);
  });
});
