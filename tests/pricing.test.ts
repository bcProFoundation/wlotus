import {
  WLOTUS_COST_STACK,
  WLOTUS_TARGET_USD_PER_BATON,
  WLOTUS_TARGET_USD_PER_TOKEN,
  CANDLES_PER_FLOWER_TOKEN,
  CANDLE_TOKENS_PER_BATON,
  CANDLE_GPU_TARGET_BITS,
  buildMintTimeTable,
  buildPricingLadder,
  economicBatonPricesUsd,
  ergonDaysForWorkFactor,
  expectedHashesFromBits,
  ritualBits,
  wallSeconds,
  GPU_HASHRATE_H_S,
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

describe('GPU Candle + ASIC Flower', () => {
  test('Flower $1; Candle 1/baton soft 1/10 token', () => {
    expect(WLOTUS_TARGET_USD_PER_BATON).toBe(1);
    expect(WLOTUS_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(CANDLES_PER_FLOWER_TOKEN).toBe(10);
    expect(CANDLE_TOKENS_PER_BATON).toBe(1);
    expect(CANDLE_MINT_ATOMS).toBe(1n);
    expect(FLOWER_MINT_ATOMS).toBe(100n);
    expect(economicBatonPricesUsd()).toEqual({ flower: 1, candle: 0.001 });
  });

  test('cost stack 40% margin', () => {
    expect(
      Object.values(WLOTUS_COST_STACK).reduce((a, b) => a + b, 0),
    ).toBeCloseTo(1, 10);
  });

  test('bits: Prayer 22, Incense 8, Candle 43 (GPU), Flower 59', () => {
    const b = ritualBits();
    expect(b.prayer).toBe(22);
    expect(b.incense).toBe(8);
    expect(b.candle).toBe(43);
    expect(b.flower).toBe(59);
    expect(CANDLE_GPU_TARGET_BITS).toBe(43);
    expect(POW_CANDLE_BASE_ZERO_BITS).toBe(43);
    expect(POW_FLOWER_BASE_ZERO_BITS).toBe(59);
    expect(POW_PRAYER_BASE_ZERO_BITS).toBe(22);
    expect(POW_INCENSE_BASE_ZERO_BITS).toBe(8);
  });

  test('Prayer/Incense non-economic', () => {
    const ladder = buildPricingLadder();
    expect(ladder.prayer.regime).toBe('non-economic');
    expect(ladder.incense.regime).toBe('non-economic');
    expect(ladder.candle.targetUsdPerRemint).toBe(0.001);
    expect(PRAYER_MINT_ATOMS).toBe(1n);
    expect(INCENSE_MINT_ATOMS).toBe(100n);
  });

  test('Candle ~hours on 1 GH/s GPU; Flower ASIC-hours', () => {
    const candleH = expectedHashesFromBits(43);
    const hours = wallSeconds(candleH, GPU_HASHRATE_H_S) / 3600;
    expect(hours).toBeGreaterThan(1);
    expect(hours).toBeLessThan(6);
    const flowerHours = wallSeconds(expectedHashesFromBits(59), 100e12) / 3600;
    expect(flowerHours).toBeGreaterThan(1.4);
    expect(flowerHours).toBeLessThan(1.8);
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
