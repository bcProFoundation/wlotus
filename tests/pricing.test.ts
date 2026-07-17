import {
  WLOTUS_COST_STACK,
  WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
  WLOTUS_TARGET_USD_PER_BATON,
  WLOTUS_TARGET_USD_PER_TOKEN,
  bitsFromExpectedHashes,
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
  expectedHashesForWlotusBaton,
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
} from '../src/params/testEconomics.js';

describe('WLotus market price vs energy cost', () => {
  test('market target is $1/baton ($0.01/token), not pure electricity', () => {
    expect(WLOTUS_TARGET_USD_PER_BATON).toBe(1);
    expect(WLOTUS_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_REMINT).toBe(1);
  });

  test('cost stack sums to 100% with electricity at 35%', () => {
    const sum = Object.values(WLOTUS_COST_STACK).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(WLOTUS_ELECTRICITY_SHARE_OF_PRICE).toBe(0.35);
    expect(WLOTUS_COST_STACK.profitMargin).toBeGreaterThan(0);
  });

  test('D sized from electricity share → ~59 bits, ~2h on 100 TH/s', () => {
    const H = expectedHashesForWlotusBaton();
    expect(Math.round(bitsFromExpectedHashes(H))).toBe(59);
    expect(POW_W_BASE_ZERO_BITS).toBe(59);
    const hours = wallSeconds(H, 100e12) / 3600;
    expect(hours).toBeGreaterThan(2);
    expect(hours).toBeLessThan(2.5);
  });

  test('reference electricity is well below $1 market baton price', () => {
    const ladder = buildPricingLadder();
    expect(ladder.wlotus.referenceElectricityUsd).toBeCloseTo(0.35, 10);
    expect(ladder.wlotus.referenceElectricityUsd).toBeLessThan(
      ladder.wlotus.targetUsdPerRemint,
    );
  });

  test('mint-time table lists three parallel products', () => {
    expect(buildMintTimeTable().rows.map(r => r.product)).toEqual([
      'nWLotus',
      'mWLotus',
      'WLotus',
    ]);
  });

  test('n/m UX bits unchanged', () => {
    expect(POW_N_BASE_ZERO_BITS).toBe(25);
    expect(POW_M_BASE_ZERO_BITS).toBe(30);
    expect(
      wallSeconds(expectedHashesFromBits(30), UX_PC_HASHRATE_H_S),
    ).toBeGreaterThan(10 * 60);
  });

  test('Ergon half-life ~2.3y', () => {
    const y = ergonDaysForWorkFactor(2) / 365.25;
    expect(y).toBeGreaterThan(2.2);
    expect(y).toBeLessThan(2.4);
  });
});
