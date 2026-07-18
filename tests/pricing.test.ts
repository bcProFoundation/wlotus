import {
  WLOTUS_COST_STACK,
  WLOTUS_TARGET_USD_PER_BATON,
  WLOTUS_TARGET_USD_PER_TOKEN,
  CANDLES_PER_FLOWER_TOKEN,
  CANDLE_TOKENS_PER_BATON,
  bitsFromExpectedHashes,
  buildMintTimeTable,
  buildPricingLadder,
  economicBatonPricesUsd,
  ergonDaysForWorkFactor,
  expectedHashesForWlotusBaton,
  ritualBits,
  wallSeconds,
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

describe('Candle/Flower economic ladder + non-economic Prayer/Incense', () => {
  test('Flower $1/baton; Candle = 1/10 token price, 10/baton', () => {
    expect(WLOTUS_TARGET_USD_PER_BATON).toBe(1);
    expect(WLOTUS_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(CANDLES_PER_FLOWER_TOKEN).toBe(10);
    expect(CANDLE_TOKENS_PER_BATON).toBe(10);
    expect(CANDLE_MINT_ATOMS).toBe(10n);
    expect(FLOWER_MINT_ATOMS).toBe(100n);
    expect(economicBatonPricesUsd()).toEqual({ flower: 1, candle: 0.01 });
  });

  test('cost stack 40% margin', () => {
    expect(Object.values(WLOTUS_COST_STACK).reduce((a, b) => a + b, 0)).toBeCloseTo(
      1,
      10,
    );
    expect(WLOTUS_COST_STACK.profitMargin).toBe(0.4);
  });

  test('bits: Prayer 22, Incense 8, Candle 52, Flower 59', () => {
    const b = ritualBits();
    expect(b.prayer).toBe(22);
    expect(b.incense).toBe(8);
    expect(b.candle).toBe(52);
    expect(b.flower).toBe(59);
    expect(POW_PRAYER_BASE_ZERO_BITS).toBe(22);
    expect(POW_INCENSE_BASE_ZERO_BITS).toBe(8);
    expect(POW_CANDLE_BASE_ZERO_BITS).toBe(52);
    expect(POW_FLOWER_BASE_ZERO_BITS).toBe(59);
  });

  test('Prayer/Incense non-economic; Candle/Flower priced', () => {
    const ladder = buildPricingLadder();
    expect(ladder.prayer.regime).toBe('non-economic');
    expect(ladder.incense.regime).toBe('non-economic');
    expect(ladder.prayer.targetUsdPerRemint).toBe(0);
    expect(ladder.incense.targetUsdPerRemint).toBe(0);
    expect(ladder.candle.targetUsdPerRemint).toBe(0.01);
    expect(ladder.flower.targetUsdPerRemint).toBe(1);
    expect(PRAYER_MINT_ATOMS).toBe(1n);
    expect(INCENSE_MINT_ATOMS).toBe(100n);
  });

  test('Candle baton work ≈ Flower/100 (weak HW much faster)', () => {
    const ladder = buildPricingLadder();
    expect(
      ladder.flower.expectedHashes / ladder.candle.expectedHashes,
    ).toBeCloseTo(100, 5);
    const H = expectedHashesForWlotusBaton();
    expect(Math.round(bitsFromExpectedHashes(H))).toBe(59);
    expect(wallSeconds(H, 100e12) / 3600).toBeGreaterThan(1.4);
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
