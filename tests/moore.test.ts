import {
  approxHalfLifeYears,
  mintAtomsAfterDays,
  mintAtomsAtHostHeight,
  mooreDaysFromHeights,
  mooreStep,
} from '../src/lib/moore.js';
import {
  BASE_MINT_ATOMS,
  MOORE_NUM,
  MOORE_NUM_OBSOLETE,
} from '../src/params/consensus.js';
import {
  assertMultiBaton,
  buildGenesisPlan,
} from '../src/genesis/createGenesis.js';

describe('moore decay (Ergon 99918/100000)', () => {
  test('one step shrinks atoms', () => {
    const next = mooreStep(BASE_MINT_ATOMS);
    expect(next).toBe((BASE_MINT_ATOMS * MOORE_NUM) / 100000n);
    expect(next).toBeLessThan(BASE_MINT_ATOMS);
  });

  test('forbids obsolete 99826 factor', () => {
    expect(() => mooreStep(100n, MOORE_NUM_OBSOLETE)).toThrow(/Obsolete/);
  });

  test('k=0 returns base', () => {
    expect(mintAtomsAfterDays(0)).toBe(BASE_MINT_ATOMS);
  });

  test('day index from heights', () => {
    expect(mooreDaysFromHeights(1000, 1000)).toBe(0);
    expect(mooreDaysFromHeights(1000, 1143)).toBe(0);
    expect(mooreDaysFromHeights(1000, 1144)).toBe(1);
    expect(mooreDaysFromHeights(1000, 1288)).toBe(2);
  });

  test('mint at host height', () => {
    const genesis = 500_000;
    const day1 = mintAtomsAtHostHeight(genesis, genesis + 144);
    expect(day1).toBe(mooreStep(BASE_MINT_ATOMS));
  });

  test('half-life ~2.3 years for 99918/100000', () => {
    const years = approxHalfLifeYears();
    expect(years).toBeGreaterThan(2.2);
    expect(years).toBeLessThan(2.4);
  });

  test('after ~2.3y atoms are near half base (not zero)', () => {
    const days = Math.round(approxHalfLifeYears() * 365.25);
    const half = mintAtomsAfterDays(days);
    expect(half).toBeGreaterThan(BASE_MINT_ATOMS / 3n);
    expect(half).toBeLessThan((BASE_MINT_ATOMS * 2n) / 3n);
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
