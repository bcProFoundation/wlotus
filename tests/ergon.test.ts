import {
  buildErgonTargetTable,
  computeErgonState,
  meetsErgonTarget,
  wldfErgonPushdata,
  WLDF_VERSION_ERGON,
  ERGON_GENESIS_TARGET,
  ERGON_MAX_DAYS,
} from '../src/covenant/ergon.js';
import { mooreAfterDays } from '../src/lib/moore.js';
import { MOORE_NUM, MOORE_DEN } from '../src/params/consensus.js';
import { WLDF_LOKAD } from '../src/covenant/wldf.js';

describe('Ergon daily δ compact target', () => {
  test('table matches mooreAfterDays for days 0..max', () => {
    const table = buildErgonTargetTable(ERGON_GENESIS_TARGET);
    for (let d = 0; d <= ERGON_MAX_DAYS; d++) {
      expect(table.readUInt32LE(d * 4)).toBe(
        Number(mooreAfterDays(d, BigInt(ERGON_GENESIS_TARGET))),
      );
    }
  });

  test('one day applies 99918/100000', () => {
    const t0 = BigInt(ERGON_GENESIS_TARGET);
    const t1 = mooreAfterDays(1, t0);
    expect(t1).toBe((t0 * MOORE_NUM) / MOORE_DEN);
    expect(t1).toBeLessThan(t0);
  });

  test('WLDF v2 layout', () => {
    const state = computeErgonState(1_700_086_400, {
      genesisUnix: 1_700_000_000,
      daySeconds: 86_400,
      genesisTarget: ERGON_GENESIS_TARGET,
    });
    expect(state.days).toBe(1);
    const push = wldfErgonPushdata(state);
    expect(push.length).toBe(17);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLDF_LOKAD))).toBe(
      true,
    );
    expect(push[4]).toBe(WLDF_VERSION_ERGON);
  });

  test('meetsErgonTarget rejects negative Script heads', () => {
    const h = new Uint8Array(32);
    h[3] = 0x80;
    expect(meetsErgonTarget(h, ERGON_GENESIS_TARGET)).toBe(false);
    h[3] = 0x00;
    h[0] = 0x01;
    expect(meetsErgonTarget(h, ERGON_GENESIS_TARGET)).toBe(true);
  });
});
