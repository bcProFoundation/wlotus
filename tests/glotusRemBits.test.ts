import { GLOTUS_MOORE_DAYS_PER_EXTRA_BIT } from '../src/params/consensus.js';
import { ergonDaysForWorkFactor } from '../src/params/pricing.js';
import { meetsPowBits } from '../src/covenant/wldf.js';

/** LE 2-byte remBits limits baked in GlotusPowRemintMooreTip.spedn. */
const GLOTUS_REM_LIMITS = Buffer.from(
  '00018000400020001000080004000200',
  'hex',
);

function glotusNextByteLimit(remBits: number): number {
  return GLOTUS_REM_LIMITS.readUInt16LE(remBits * 2);
}

describe('GLotus remBits flat table', () => {
  test('thresholds match 2^(8-remBits), remBits=0 → 256', () => {
    expect(glotusNextByteLimit(0)).toBe(256);
    for (let r = 1; r <= 7; r++) {
      expect(glotusNextByteLimit(r)).toBe(1 << (8 - r));
    }
  });

  test('padded next-byte < limit matches meetsPowBits', () => {
    const hash = new Uint8Array(32);
    hash[0] = 0;
    hash[1] = 40;
    expect(meetsPowBits(hash, 8)).toBe(true);
    expect(40 < glotusNextByteLimit(0)).toBe(true);
    expect(meetsPowBits(hash, 9)).toBe(true);
    expect(40 < glotusNextByteLimit(1)).toBe(true);
    expect(meetsPowBits(hash, 10)).toBe(true);
    expect(40 < glotusNextByteLimit(2)).toBe(true);
    hash[1] = 200;
    expect(meetsPowBits(hash, 9)).toBe(false);
    expect(200 < glotusNextByteLimit(1)).toBe(false);
  });
});

describe('GLotus Moore doubling', () => {
  test('845 days is Ergon 2× (not WLotus 500)', () => {
    const days = ergonDaysForWorkFactor(2);
    expect(GLOTUS_MOORE_DAYS_PER_EXTRA_BIT).toBe(845);
    expect(Math.round(days)).toBe(845);
  });
});
