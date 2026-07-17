import {
  WLOTUS_COST_STACK,
  WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
  WLOTUS_TARGET_USD_PER_BATON,
  WLOTUS_TARGET_USD_PER_TOKEN,
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
  expectedHashesFromBits,
  ritualBits,
  wallSeconds,
  UX_PHONE_HASHRATE_H_S,
  PRAYER_WORK_DIVISOR,
  CANDLE_WORK_FACTOR,
  FLOWER_WORK_FACTOR_FROM_CANDLE,
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

describe('Ritual offer ladder', () => {
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

  test('work ladder: Prayer÷10, Candle×100, Flower×100 from Incense', () => {
    expect(PRAYER_WORK_DIVISOR).toBe(10);
    expect(CANDLE_WORK_FACTOR).toBe(100);
    expect(FLOWER_WORK_FACTOR_FROM_CANDLE).toBe(100);
    const b = ritualBits();
    expect(b.prayer).toBe(22);
    expect(b.incense).toBe(25);
    expect(b.candle).toBe(32);
    expect(b.flower).toBe(38);
    expect(POW_PRAYER_BASE_ZERO_BITS).toBe(22);
    expect(POW_INCENSE_BASE_ZERO_BITS).toBe(25);
    expect(POW_CANDLE_BASE_ZERO_BITS).toBe(32);
    expect(POW_FLOWER_BASE_ZERO_BITS).toBe(38);
  });

  test('Incense phone ~3.7 min; Prayer ~1/10 (~30 s)', () => {
    const incenseSec = wallSeconds(
      expectedHashesFromBits(25),
      UX_PHONE_HASHRATE_H_S,
    );
    const prayerSec = wallSeconds(
      expectedHashesFromBits(22),
      UX_PHONE_HASHRATE_H_S,
    );
    expect(incenseSec / 60).toBeGreaterThan(3);
    expect(incenseSec / 60).toBeLessThan(4.5);
    expect(prayerSec).toBeGreaterThan(20);
    expect(prayerSec).toBeLessThan(40);
    expect(incenseSec / prayerSec).toBeGreaterThan(7);
    expect(incenseSec / prayerSec).toBeLessThan(12);
  });

  test('mint-time table lists Prayer → Incense → Candle → Flower', () => {
    expect(buildMintTimeTable().rows.map(r => r.product)).toEqual([
      'Prayer',
      'Incense',
      'Candle',
      'Flower',
    ]);
    expect(buildPricingLadder().flower.ticker).toBe('WLOTUS');
  });

  test('Ergon half-life ~2.3y', () => {
    const y = ergonDaysForWorkFactor(2) / 365.25;
    expect(y).toBeGreaterThan(2.2);
    expect(y).toBeLessThan(2.4);
  });
});
