import {
  approxHalfLifeYears,
  mintAtomsAtHostHeight,
  mooreAfterDays,
  mooreDaysFromHeights,
  mooreStep,
  requiredZeroBits,
  requiredZeroBytes,
} from '../src/lib/moore.js';
import {
  BASE_MINT_ATOMS,
  MOORE_DAYS_PER_EXTRA_BIT,
  MOORE_NUM,
  MOORE_NUM_OBSOLETE,
  POW_BASE_ZERO_BITS,
  TOKEN_DECIMALS,
  TOKEN_TICKER,
} from '../src/params/consensus.js';
import {
  assertMultiBaton,
  buildGenesisPlan,
} from '../src/genesis/createGenesis.js';

describe('moore decay (Ergon 99918/100000) on work', () => {
  test('one step shrinks work scale', () => {
    const next = mooreStep(BASE_MINT_ATOMS);
    expect(next).toBe((BASE_MINT_ATOMS * MOORE_NUM) / 100000n);
    expect(next).toBeLessThan(BASE_MINT_ATOMS);
  });

  test('forbids obsolete 99826 factor', () => {
    expect(() => mooreStep(100n, MOORE_NUM_OBSOLETE)).toThrow(/Obsolete/);
  });

  test('k=0 returns base', () => {
    expect(mooreAfterDays(0, BASE_MINT_ATOMS)).toBe(BASE_MINT_ATOMS);
  });

  test('day index from heights', () => {
    expect(mooreDaysFromHeights(1000, 1000)).toBe(0);
    expect(mooreDaysFromHeights(1000, 1143)).toBe(0);
    expect(mooreDaysFromHeights(1000, 1144)).toBe(1);
    expect(mooreDaysFromHeights(1000, 1288)).toBe(2);
  });

  test('mint atoms stay fixed at host height', () => {
    const genesis = 500_000;
    expect(mintAtomsAtHostHeight(genesis, genesis + 144)).toBe(BASE_MINT_ATOMS);
    expect(mintAtomsAtHostHeight(genesis, genesis + 144_000)).toBe(
      BASE_MINT_ATOMS,
    );
  });

  test('half-life ~2.3 years for 99918/100000', () => {
    const years = approxHalfLifeYears();
    expect(years).toBeGreaterThan(2.2);
    expect(years).toBeLessThan(2.4);
  });

  test('after ~2.3y large work scale is near half (not zero)', () => {
    const work0 = 100_000_000n; // not mint atoms — work scale must stay large
    const days = Math.round(approxHalfLifeYears() * 365.25);
    const half = mooreAfterDays(days, work0);
    expect(half).toBeGreaterThan(work0 / 3n);
    expect(half).toBeLessThan((work0 * 2n) / 3n);
  });

  test('required zero bits grow with Moore day schedule', () => {
    expect(requiredZeroBits(0)).toBe(POW_BASE_ZERO_BITS);
    expect(requiredZeroBits(MOORE_DAYS_PER_EXTRA_BIT - 1)).toBe(
      POW_BASE_ZERO_BITS,
    );
    expect(requiredZeroBits(MOORE_DAYS_PER_EXTRA_BIT)).toBe(
      POW_BASE_ZERO_BITS + 1,
    );
    expect(requiredZeroBytes(0)).toBe(1);
  });
});

describe('genesis multi-baton', () => {
  test('default plan has N>=2', () => {
    const plan = buildGenesisPlan();
    expect(plan.powBatonCount).toBeGreaterThanOrEqual(2);
    expect(() => assertMultiBaton(plan)).not.toThrow();
  });

  test('rejects single baton', () => {
    const plan = buildGenesisPlan({ powBatonCount: 1 });
    expect(() => assertMultiBaton(plan)).toThrow(/N >= 2/);
  });
});

describe('Ritual offer economics', () => {
  test('Candle / Incense / Flower ladder + Flower $1 market', async () => {
    const econ = await import('../src/params/testEconomics.js');
    expect(TOKEN_TICKER).toBe('CANDLE');
    expect(TOKEN_DECIMALS).toBe(0);
    expect(BASE_MINT_ATOMS).toBe(100n); // Flower default
    expect(econ.CANDLE_MINT_ATOMS).toBe(10n);
    expect(econ.INCENSE_MINT_ATOMS).toBe(1n);
    expect(econ.PROD_TARGET_USD_PER_TOKEN).toBe(0.01);
    expect(econ.TEST_BASE_ZERO_BITS).toBe(32); // Candle
    expect(econ.PROD_BASE_ZERO_BITS).toBe(59); // Flower $1 sheet
    expect(econ.NWLPOW_BASE_ZERO_BITS).toBe(25); // Incense
    expect(econ.TOKENS_PER_REMINT).toBe(100);
    expect(econ.TEST_POW_BATON_COUNT).toBeGreaterThanOrEqual(2);
    expect(econ.TEST_INITIAL_MINT_ATOMS).toBe(1_000_000n);
  });
});
