import {
  bitsFromExpectedHashes,
  buildMintTimeTable,
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
  PROD_TARGET_USD_PER_REMINT,
  PROD_TARGET_USD_PER_TOKEN,
  TEST_TARGET_USD_PER_TOKEN,
} from '../src/params/testEconomics.js';

describe('pricing ladder (nWLotus / mWLotus / WLotus)', () => {
  test('WLotus standard is $0.01/token = $1/baton → ~61 bits', () => {
    expect(PROD_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_REMINT).toBe(1);
    const H = expectedHashesForAsicUsd(1);
    expect(Math.round(bitsFromExpectedHashes(H))).toBe(61);
    expect(POW_W_BASE_ZERO_BITS).toBe(61);
  });

  test('100 TH/s mints $1 baton in about 6–7 hours', () => {
    const H = expectedHashesForAsicUsd(1);
    const hours = wallSeconds(H, 100e12) / 3600;
    expect(hours).toBeGreaterThan(6);
    expect(hours).toBeLessThan(7);
  });

  test('mint-time table has three parallel tiers', () => {
    const table = buildMintTimeTable();
    expect(table.rows).toHaveLength(3);
    expect(table.rows.map(r => r.product)).toEqual([
      'nWLotus',
      'mWLotus',
      'WLotus',
    ]);
  });

  test('mWLotus 30 bits is tens of minutes on a PC', () => {
    const sec = wallSeconds(
      expectedHashesFromBits(POW_M_BASE_ZERO_BITS),
      UX_PC_HASHRATE_H_S,
    );
    expect(sec).toBeGreaterThan(10 * 60);
    expect(sec).toBeLessThan(60 * 60);
  });

  test('nWLotus 25 bits is the launch tier', () => {
    expect(POW_N_BASE_ZERO_BITS).toBe(25);
    const ladder = buildPricingLadder();
    expect(ladder.nwlotus.ticker).toBe('nWLOTUS');
    expect(TEST_TARGET_USD_PER_TOKEN).toBe(1e-5);
  });

  test('Ergon half-life ~2.3y for 2× work', () => {
    const years = ergonDaysForWorkFactor(2) / 365.25;
    expect(years).toBeGreaterThan(2.2);
    expect(years).toBeLessThan(2.4);
  });
});
