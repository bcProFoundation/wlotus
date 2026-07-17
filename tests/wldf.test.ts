import {
  computeMooreBits,
  meetsPowBits,
  wldfPushdata,
  WLDF_LOKAD,
  WLDF_VERSION,
  TEST_MOORE_SECONDS_PER_EXTRA_BIT,
} from '../src/covenant/wldf.js';
import { POW_BASE_ZERO_BITS } from '../src/params/consensus.js';

describe('Moore fine-grain bits + WLDF', () => {
  const params = {
    genesisUnix: 1_700_000_000,
    baseZeroBits: POW_BASE_ZERO_BITS,
    secondsPerExtraBit: TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  };

  test('bits stay at base until one period elapses', () => {
    expect(computeMooreBits(params.genesisUnix, params).bits).toBe(8);
    expect(
      computeMooreBits(params.genesisUnix + 86_399, params).extraBits,
    ).toBe(0);
    expect(
      computeMooreBits(params.genesisUnix + 86_400, params).bits,
    ).toBe(9);
  });

  test('WLDF push is 15 bytes with LOKAD + ver + fields', () => {
    const state = computeMooreBits(params.genesisUnix + 86_400, params);
    const push = wldfPushdata(state);
    expect(push.length).toBe(15);
    expect(Buffer.from(push.slice(0, 4)).equals(Buffer.from(WLDF_LOKAD))).toBe(
      true,
    );
    expect(push[4]).toBe(WLDF_VERSION);
    // bits = 9 LE
    expect(push[5]).toBe(9);
    expect(push[6]).toBe(0);
    // extraBits = 1 LE
    expect(push[7]).toBe(1);
    expect(push[8]).toBe(0);
    expect(push[9]).toBe(0);
    expect(push[10]).toBe(0);
  });

  test('meetsPowBits handles remBits', () => {
    const h = new Uint8Array(32);
    // bits=8 → first byte 0
    h[0] = 0;
    h[1] = 0xff;
    expect(meetsPowBits(h, 8)).toBe(true);
    expect(meetsPowBits(h, 9)).toBe(false); // need next < 128
    h[1] = 0x7f;
    expect(meetsPowBits(h, 9)).toBe(true);
    h[1] = 0x3f;
    expect(meetsPowBits(h, 10)).toBe(true);
    expect(meetsPowBits(h, 11)).toBe(false);
  });

  test('rejects locktime before genesis', () => {
    expect(() => computeMooreBits(params.genesisUnix - 1, params)).toThrow(
      /locktime/,
    );
  });
});
