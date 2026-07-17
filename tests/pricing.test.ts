import {
  WLOTUS_COST_STACK,
  WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
  WLOTUS_TARGET_USD_PER_BATON,
  WLOTUS_TARGET_USD_PER_TOKEN,
  REMINT_FEE_XEC,
  REMINT_FEE_USD,
  bitsFromExpectedHashes,
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
  expectedHashesForWlotusBaton,
  ritualBits,
  wallSeconds,
  CANDLE_TOKENS_PER_BATON,
  INCENSE_TOKENS_PER_BATON,
  PRAYER_TOKENS_PER_BATON,
  FLOWER_TOKENS_PER_BATON,
  CANDLE_PER_FLOWER,
  INCENSE_PER_CANDLE,
  PRAYER_PER_INCENSE,
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

describe('Fee-floor offer ladder', () => {
  test('Flower market target is $1/baton ($0.01/token)', () => {
    expect(WLOTUS_TARGET_USD_PER_BATON).toBe(1);
    expect(WLOTUS_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(PROD_TARGET_USD_PER_REMINT).toBe(1);
  });

  test('cost stack ~40% risk margin', () => {
    const sum = Object.values(WLOTUS_COST_STACK).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(WLOTUS_ELECTRICITY_SHARE_OF_PRICE).toBe(0.25);
    expect(WLOTUS_COST_STACK.profitMargin).toBe(0.4);
  });

  test('mint 1 / 100 / 100 / 100 and 1000∶1 peg', () => {
    expect(PRAYER_TOKENS_PER_BATON).toBe(1);
    expect(INCENSE_TOKENS_PER_BATON).toBe(100);
    expect(CANDLE_TOKENS_PER_BATON).toBe(100);
    expect(FLOWER_TOKENS_PER_BATON).toBe(100);
    expect(PRAYER_MINT_ATOMS).toBe(1n);
    expect(INCENSE_MINT_ATOMS).toBe(100n);
    expect(CANDLE_MINT_ATOMS).toBe(100n);
    expect(FLOWER_MINT_ATOMS).toBe(100n);
    expect(PRAYER_PER_INCENSE).toBe(1000);
    expect(INCENSE_PER_CANDLE).toBe(1000);
    expect(CANDLE_PER_FLOWER).toBe(1000);
  });

  test('bits: Prayer 22, Incense 25, Candle 49, Flower 59', () => {
    const b = ritualBits();
    expect(b.prayer).toBe(22);
    expect(b.incense).toBe(25);
    expect(b.candle).toBe(49);
    expect(b.flower).toBe(59);
    expect(POW_PRAYER_BASE_ZERO_BITS).toBe(22);
    expect(POW_INCENSE_BASE_ZERO_BITS).toBe(25);
    expect(POW_CANDLE_BASE_ZERO_BITS).toBe(49);
    expect(POW_FLOWER_BASE_ZERO_BITS).toBe(59);
  });

  test('Flower $1 → ~59 bits, ~1.6h on 100 TH/s', () => {
    const H = expectedHashesForWlotusBaton();
    expect(Math.round(bitsFromExpectedHashes(H))).toBe(59);
    expect(wallSeconds(H, 100e12) / 3600).toBeGreaterThan(1.4);
    expect(wallSeconds(H, 100e12) / 3600).toBeLessThan(1.8);
  });

  test('fee dominates Prayer/Incense soft peg; not Flower', () => {
    expect(REMINT_FEE_XEC).toBe(5.46);
    expect(REMINT_FEE_USD).toBeGreaterThan(0);
    const ladder = buildPricingLadder();
    expect(ladder.prayer.feeOverMarket).toBeGreaterThan(1000);
    expect(ladder.incense.feeOverMarket).toBeGreaterThan(10);
    expect(ladder.flower.feeOverMarket).toBeLessThan(0.01);
    // Fee-floor unit cost: Prayer token ≈ fee; Incense token ≈ fee/100 → ~100∶1
    expect(ladder.prayer.allInUsd / (ladder.incense.allInUsd / 100)).toBeCloseTo(
      100,
      3,
    );
  });

  test('mint-time table order', () => {
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
