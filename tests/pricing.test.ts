import {
  asicUsdPerHash,
  bitsFromExpectedHashes,
  buildPricingLadder,
  ergonDaysForWorkFactor,
  expectedHashesForAsicUsd,
  expectedHashesFromBits,
  wallSeconds,
  UX_PC_HASHRATE_H_S,
} from '../src/params/pricing.js';
import {
  POW_M_BASE_ZERO_BITS,
  POW_N_BASE_ZERO_BITS,
  POW_W_BASE_ZERO_BITS,
} from '../src/params/consensus.js';
import {
  PROD_TARGET_USD_PER_TOKEN,
  TEST_TARGET_USD_PER_TOKEN,
} from '../src/params/testEconomics.js';

describe('pricing ladder (ASIC vs UX)', () => {
  test('ASIC $100/remint implies ~68 bits class difficulty', () => {
    const H = expectedHashesForAsicUsd(100);
    const bits = bitsFromExpectedHashes(H);
    expect(bits).toBeGreaterThan(65);
    expect(bits).toBeLessThan(70);
    expect(POW_W_BASE_ZERO_BITS).toBe(68);
  });

  test('100 TH/s cannot mint WLOTUS energy D in under a day', () => {
    const H = expectedHashesForAsicUsd(100);
    const sec = wallSeconds(H, 100e12);
    expect(sec).toBeGreaterThan(86400); // > 1 day
  });

  test('mWLPOW 30 bits is minutes on a PC, not milliseconds', () => {
    const H = expectedHashesFromBits(POW_M_BASE_ZERO_BITS);
    const sec = wallSeconds(H, UX_PC_HASHRATE_H_S);
    expect(sec).toBeGreaterThan(10 * 60); // > 10 min
    expect(sec).toBeLessThan(60 * 60); // < 1 h at 0.85 MH/s
  });

  test('nWLPOW 25 bits is sub-minute on PC, minutes on slow phone', () => {
    const H = expectedHashesFromBits(POW_N_BASE_ZERO_BITS);
    expect(wallSeconds(H, UX_PC_HASHRATE_H_S)).toBeLessThan(120);
    expect(wallSeconds(H, 150_000)).toBeGreaterThan(60);
  });

  test('ladder prices: WLOTUS $1/token, m at $0.001', () => {
    expect(PROD_TARGET_USD_PER_TOKEN).toBe(1);
    expect(TEST_TARGET_USD_PER_TOKEN).toBe(1e-3);
    const ladder = buildPricingLadder();
    expect(ladder.wlotus.targetUsdPerToken).toBe(1);
    expect(ladder.mwlpow.baseZeroBits).toBe(30);
    expect(ladder.nwlpow.baseZeroBits).toBe(25);
  });

  test('ASIC hash is vastly cheaper than CPU µJ model', () => {
    expect(asicUsdPerHash()).toBeLessThan(1e-16);
  });

  test('Ergon half-life ~2.3y for 2× work', () => {
    const days = ergonDaysForWorkFactor(2);
    expect(days / 365.25).toBeGreaterThan(2.2);
    expect(days / 365.25).toBeLessThan(2.4);
  });
});
