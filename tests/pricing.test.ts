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
  ritualBits,
  wallSeconds,
  PRAYER_WORK_DIVISOR,
  CANDLE_WORK_FACTOR,
  FLOWER_WORK_FACTOR_FROM_INCENSE,
} from '../src/params/pricing.js';
import {
  POW_CANDLE_BASE_ZERO_BITS,
  POW_FLOWER_BASE_ZERO_BITS,
  POW_INCENSE_BASE_ZERO_BITS,
  POW_PRAYER_BASE_ZERO_BITS,
  CANDLE_MINT_ATOMS,
  FLOWER_MINT_ATOMS,
  INCENSE_MINT_ATOMS,
  PRAYER_MINT_ATOMS,
} from '../src/params/consensus.js';
import {
  PROD_TARGET_USD_PER_REMINT,
  PROD_TARGET_USD_PER_TOKEN,
} from '../src/params/testEconomics.js';

describe('Ritual offer ladder (anti-ASIC-arbitrage)', () => {
  test('Flower market target is $1/baton ($0.01/token)', () => {
    expect(WLOTUS_TARGET_USD_PER_BATON).toBe(1);
    expect(WLOTUS_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_REMINT).toBe(1);
  });

  test('cost stack sums to 100% with ~40% new-market risk margin', () => {
    const sum = Object.values(WLOTUS_COST_STACK).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(WLOTUS_ELECTRICITY_SHARE_OF_PRICE).toBe(0.25);
    expect(WLOTUS_COST_STACK.profitMargin).toBe(0.4);
  });

  test('mint atoms: Prayer 1, Incense 1, Candle 10, Flower 100', () => {
    expect(PRAYER_MINT_ATOMS).toBe(1n);
    expect(INCENSE_MINT_ATOMS).toBe(1n);
    expect(CANDLE_MINT_ATOMS).toBe(10n);
    expect(FLOWER_MINT_ATOMS).toBe(100n);
  });

  test('Flower = Incense×10000; Candle = Incense×100; Prayer = Incense/10', () => {
    expect(FLOWER_WORK_FACTOR_FROM_INCENSE).toBe(10_000);
    expect(CANDLE_WORK_FACTOR).toBe(100);
    expect(PRAYER_WORK_DIVISOR).toBe(10);
    const b = ritualBits();
    expect(b.flower).toBe(59);
    expect(b.incense).toBe(46);
    expect(b.candle).toBe(52);
    expect(b.prayer).toBe(42);
    expect(POW_FLOWER_BASE_ZERO_BITS).toBe(59);
    expect(POW_INCENSE_BASE_ZERO_BITS).toBe(46);
    expect(POW_CANDLE_BASE_ZERO_BITS).toBe(52);
    expect(POW_PRAYER_BASE_ZERO_BITS).toBe(42);
  });

  test('Flower $1 → ~59 bits, ~1.6h on 100 TH/s', () => {
    const H = expectedHashesForWlotusBaton();
    expect(Math.round(bitsFromExpectedHashes(H))).toBe(59);
    const hours = wallSeconds(H, 100e12) / 3600;
    expect(hours).toBeGreaterThan(1.4);
    expect(hours).toBeLessThan(1.8);
    const ladder = buildPricingLadder();
    expect(ladder.flower.referenceElectricityUsd).toBeCloseTo(0.25, 10);
  });

  test('ASIC $/hash roughly equal across peg (anti-arb)', () => {
    const ladder = buildPricingLadder();
    const flower = ladder.flower.targetUsdPerRemint / ladder.flower.expectedHashes;
    const incense = ladder.incense.targetUsdPerRemint / ladder.incense.expectedHashes;
    const candle = ladder.candle.targetUsdPerRemint / ladder.candle.expectedHashes;
    // Same order of magnitude — exact match on unrounded hashes.
    expect(incense / flower).toBeCloseTo(1, 10);
    expect(candle / flower).toBeCloseTo(1, 10);
  });

  test('mint-time table lists Prayer → Incense → Candle → Flower', () => {
    expect(buildMintTimeTable().rows.map(r => r.product)).toEqual([
      'Prayer',
      'Incense',
      'Candle',
      'Flower',
    ]);
  });

  test('Ergon half-life ~2.3y', () => {
    const y = ergonDaysForWorkFactor(2) / 365.25;
    expect(y).toBeGreaterThan(2.2);
    expect(y).toBeLessThan(2.4);
  });
});
