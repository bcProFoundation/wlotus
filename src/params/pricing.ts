/**
 * Pricing / difficulty ladder — ritual offer tiers + XEC fee floor.
 *
 * Prestige (high → low): Flower (WLotus) → Candle → Incense → Prayer.
 *
 * Mint atoms / baton: Prayer **1** · Incense **100** · Candle **100** · Flower **100**
 * Token peg: **1000 Prayer ≈ 1 Incense**; **1000 Incense ≈ 1 Candle**;
 *            **1000 Candle ≈ 1 Flower**.
 *
 * **Fee floor:** every remint pays ~**5.46 XEC**. For easy PoW tiers the fee
 * dominates joules. Amortizing fee over 100 Incense/Candle tokens makes those
 * units cheaper than Prayer (1/baton) — phone users **pray** for ritual UX and
 * **buy** Incense/Candle/Flower on the market to offer.
 *
 * **Flower** stays ASIC-business: **$1/baton** → ~25% electricity → **~59 bits**.
 * Candle work tracks baton value vs Flower (anti-arb where PoW ≫ fee).
 * Incense/Prayer: easy UX PoW; all-in cost ≈ fee (+ tiny elec).
 *
 * See docs/ECONOMICS.md. Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

export const FLOWER_TOKENS_PER_BATON = 100;
/** @deprecated */
export const TOKENS_PER_REMINT = FLOWER_TOKENS_PER_BATON;

export const CANDLE_TOKENS_PER_BATON = 100;
export const INCENSE_TOKENS_PER_BATON = 100;
export const PRAYER_TOKENS_PER_BATON = 1;

/** Token peg factors (units of lower tier per one higher-tier token). */
export const PRAYER_PER_INCENSE = 1000;
export const INCENSE_PER_CANDLE = 1000;
export const CANDLE_PER_FLOWER = 1000;

/** Typical remint relay fee (XEC). */
export const REMINT_FEE_XEC = 5.46;

/** Sheet reference XEC/USD (update periodically). */
export const XEC_USD = 8e-6;

export const REMINT_FEE_USD = REMINT_FEE_XEC * XEC_USD;

/** Prayer UX bits — phone ~30 s @ 0.15 MH/s. */
export const PRAYER_UX_BITS = 22;
/** Incense UX bits — still easy; fee dominates (ex phone-minute tier). */
export const INCENSE_UX_BITS = 25;

export const ASIC_USD_PER_KWH = 0.08;
export const ASIC_JOULES_PER_TH = 20;
export const ASIC_HASHRATE_TH_S = 100;

export const UX_PC_HASHRATE_H_S = 850_000;
export const UX_PHONE_HASHRATE_H_S = 150_000;
export const JOULES_PER_KWH = 3.6e6;

export const WLOTUS_TARGET_USD_PER_BATON = 1;
export const WLOTUS_TARGET_USD_PER_TOKEN =
  WLOTUS_TARGET_USD_PER_BATON / FLOWER_TOKENS_PER_BATON;

export const WLOTUS_ELECTRICITY_SHARE_OF_PRICE = 0.25;

export const WLOTUS_COST_STACK = {
  electricity: 0.25,
  hardwareAmortization: 0.15,
  facilitySpaceCooling: 0.1,
  laborOps: 0.1,
  profitMargin: 0.4,
} as const;

export function asicUsdPerHash(
  usdPerKwh: number = ASIC_USD_PER_KWH,
  joulesPerTh: number = ASIC_JOULES_PER_TH,
): number {
  return (joulesPerTh / 1e12 / JOULES_PER_KWH) * usdPerKwh;
}

export function expectedHashesForAsicUsd(
  usd: number,
  usdPerKwh: number = ASIC_USD_PER_KWH,
  joulesPerTh: number = ASIC_JOULES_PER_TH,
): number {
  return usd / asicUsdPerHash(usdPerKwh, joulesPerTh);
}

export function expectedHashesForWlotusBaton(
  marketUsdPerBaton: number = WLOTUS_TARGET_USD_PER_BATON,
  electricityShare: number = WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
): number {
  return expectedHashesForAsicUsd(marketUsdPerBaton * electricityShare);
}

export function bitsFromExpectedHashes(expectedHashes: number): number {
  return Math.log2(expectedHashes);
}

export function expectedHashesFromBits(bits: number): number {
  return 2 ** bits;
}

export function wallSeconds(
  expectedHashes: number,
  hashesPerSec: number,
): number {
  return expectedHashes / hashesPerSec;
}

/** Soft token prices from Flower $0.01 and 1000∶1 peg. */
export function pegTokenPricesUsd(): {
  flower: number;
  candle: number;
  incense: number;
  prayer: number;
} {
  const flower = WLOTUS_TARGET_USD_PER_TOKEN;
  const candle = flower / CANDLE_PER_FLOWER;
  const incense = candle / INCENSE_PER_CANDLE;
  const prayer = incense / PRAYER_PER_INCENSE;
  return { flower, candle, incense, prayer };
}

export function pegBatonPricesUsd(): {
  flower: number;
  candle: number;
  incense: number;
  prayer: number;
} {
  const t = pegTokenPricesUsd();
  return {
    flower: t.flower * FLOWER_TOKENS_PER_BATON,
    candle: t.candle * CANDLE_TOKENS_PER_BATON,
    incense: t.incense * INCENSE_TOKENS_PER_BATON,
    prayer: t.prayer * PRAYER_TOKENS_PER_BATON,
  };
}

/**
 * All-in remint cost ≈ fee + ASIC electricity at D.
 * (Flower also has full business stack in docs; here elec+fee for compare.)
 */
export function remintAllInUsd(opts: {
  expectedHashes: number;
  feeUsd?: number;
}): { feeUsd: number; electricityUsd: number; allInUsd: number } {
  const feeUsd = opts.feeUsd ?? REMINT_FEE_USD;
  const electricityUsd = opts.expectedHashes * asicUsdPerHash();
  return {
    feeUsd,
    electricityUsd,
    allInUsd: feeUsd + electricityUsd,
  };
}

/**
 * Bits: Flower from $1 sheet; Candle from baton-value ratio (PoW ≫ fee);
 * Incense/Prayer = UX easy (fee floor carries anti-spam / unit cost).
 */
export function ritualBits(): {
  prayer: number;
  incense: number;
  candle: number;
  flower: number;
} {
  const flowerH = expectedHashesForWlotusBaton();
  const flower = Math.round(bitsFromExpectedHashes(flowerH));
  const batons = pegBatonPricesUsd();
  // Size Candle PoW so elec ≈ share of (baton market), same sheet idea.
  const candleElec = batons.candle * WLOTUS_ELECTRICITY_SHARE_OF_PRICE;
  const candleH = Math.max(
    expectedHashesForAsicUsd(candleElec),
    // never easier than incense UX
    expectedHashesFromBits(INCENSE_UX_BITS),
  );
  return {
    flower,
    candle: Math.round(bitsFromExpectedHashes(candleH)),
    incense: INCENSE_UX_BITS,
    prayer: PRAYER_UX_BITS,
  };
}

export interface TierPlan {
  product: string;
  ticker: string;
  ritual: 'prayer' | 'incense' | 'candle' | 'flower';
  regime: 'phone-ritual' | 'fee-floor' | 'asic-business';
  baseZeroBits: number;
  tokensPerBaton: number;
  expectedHashes: number;
  targetUsdPerToken: number;
  targetUsdPerRemint: number;
  feeUsd: number;
  referenceElectricityUsd: number;
  allInUsd: number;
  /** Fee as fraction of soft baton market (can be ≫1 when fee dominates). */
  feeOverMarket: number;
  notes: string;
}

export function buildPricingLadder(): {
  prayer: TierPlan;
  incense: TierPlan;
  candle: TierPlan;
  flower: TierPlan;
  nwlotus: TierPlan;
  mwlotus: TierPlan;
  wlotus: TierPlan;
  peg: string;
  workLadder: string;
  fee: { xec: number; usdPerXec: number; usd: number };
  wlotusBusiness: {
    marketUsdPerBaton: number;
    marketUsdPerToken: number;
    electricityShare: number;
    costStack: typeof WLOTUS_COST_STACK;
    electricityUsdAtReference: number;
    flowerBitsFromMarket: number;
  };
  asic: {
    usdPerKwh: number;
    joulesPerTh: number;
    hashrateThs: number;
    usdPerHash: number;
  };
} {
  const usdPerHash = asicUsdPerHash();
  const bits = ritualBits();
  const tokens = pegTokenPricesUsd();
  const batons = pegBatonPricesUsd();
  const flowerHashes = expectedHashesForWlotusBaton();
  const elecUsd = batons.flower * WLOTUS_ELECTRICITY_SHARE_OF_PRICE;

  function tier(
    partial: Omit<
      TierPlan,
      'feeUsd' | 'referenceElectricityUsd' | 'allInUsd' | 'feeOverMarket'
    >,
  ): TierPlan {
    const costs = remintAllInUsd({ expectedHashes: partial.expectedHashes });
    return {
      ...partial,
      feeUsd: costs.feeUsd,
      referenceElectricityUsd: costs.electricityUsd,
      allInUsd: costs.allInUsd,
      feeOverMarket:
        partial.targetUsdPerRemint > 0
          ? costs.feeUsd / partial.targetUsdPerRemint
          : Number.POSITIVE_INFINITY,
    };
  }

  const prayer = tier({
    product: 'Prayer',
    ticker: 'PRAYER',
    ritual: 'prayer',
    regime: 'phone-ritual',
    baseZeroBits: bits.prayer,
    tokensPerBaton: PRAYER_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.prayer),
    targetUsdPerToken: tokens.prayer,
    targetUsdPerRemint: batons.prayer,
    notes:
      'Phone-only ritual (~30 s). Fee ≫ soft peg — pray for devotion; buy Incense to offer.',
  });

  const incense = tier({
    product: 'Incense',
    ticker: 'INCENSE',
    ritual: 'incense',
    regime: 'fee-floor',
    baseZeroBits: bits.incense,
    tokensPerBaton: INCENSE_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.incense),
    targetUsdPerToken: tokens.incense,
    targetUsdPerRemint: batons.incense,
    notes:
      '100/baton amortizes fee. Fee still dominates soft peg — market clears ≥ fee/100.',
  });

  const candle = tier({
    product: 'Candle',
    ticker: 'CANDLE',
    ritual: 'candle',
    regime: 'asic-business',
    baseZeroBits: bits.candle,
    tokensPerBaton: CANDLE_TOKENS_PER_BATON,
    expectedHashes: expectedHashesForAsicUsd(
      batons.candle * WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
    ),
    targetUsdPerToken: tokens.candle,
    targetUsdPerRemint: batons.candle,
    notes:
      '100/baton · peg 1000 Candle ≈ 1 Flower · PoW sized to baton value (fee small).',
  });

  const flower = tier({
    product: 'Flower',
    ticker: 'WLOTUS',
    ritual: 'flower',
    regime: 'asic-business',
    baseZeroBits: bits.flower,
    tokensPerBaton: FLOWER_TOKENS_PER_BATON,
    expectedHashes: flowerHashes,
    targetUsdPerToken: tokens.flower,
    targetUsdPerRemint: batons.flower,
    notes:
      '$1/baton · ~59 bits · fee negligible · 40% risk margin stack.',
  });

  return {
    asic: {
      usdPerKwh: ASIC_USD_PER_KWH,
      joulesPerTh: ASIC_JOULES_PER_TH,
      hashrateThs: ASIC_HASHRATE_TH_S,
      usdPerHash,
    },
    fee: {
      xec: REMINT_FEE_XEC,
      usdPerXec: XEC_USD,
      usd: REMINT_FEE_USD,
    },
    peg: '1000 Prayer ≈ 1 Incense ≈ 0.001 Candle ≈ 0.000001 Flower (token); batons mint 1/100/100/100',
    workLadder:
      'Prayer/Incense = UX + fee floor · Candle/Flower = $ value ASIC sheet (Flower $1 → 59 bits)',
    wlotusBusiness: {
      marketUsdPerBaton: batons.flower,
      marketUsdPerToken: tokens.flower,
      electricityShare: WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
      costStack: WLOTUS_COST_STACK,
      electricityUsdAtReference: elecUsd,
      flowerBitsFromMarket: bits.flower,
    },
    prayer,
    incense,
    candle,
    flower,
    nwlotus: incense,
    mwlotus: candle,
    wlotus: flower,
  };
}

export function ergonDaysForWorkFactor(
  factor: number,
  num: bigint = MOORE_NUM,
  den: bigint = MOORE_DEN,
): number {
  const growth = Number(den) / Number(num);
  return Math.log(factor) / Math.log(growth);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds > 1e12) return '—';
  if (seconds < 0.001) return '<1 ms';
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds < 365.25 * 86400) return `${(seconds / 86400).toFixed(1)} d`;
  return `${(seconds / 365.25 / 86400).toFixed(1)} y`;
}

export function buildMintTimeTable(): {
  headers: string[];
  rows: {
    product: string;
    ticker: string;
    bits: number;
    tokensPerBaton: number;
    marketUsdPerToken: number;
    marketUsdPerBaton: number;
    feeUsd: number;
    electricityUsd: number;
    allInUsd: number;
    phone: string;
    pc: string;
    asic100THs: string;
  }[];
} {
  const ladder = buildPricingLadder();
  const asicHps = ASIC_HASHRATE_TH_S * 1e12;
  const tiers = [ladder.prayer, ladder.incense, ladder.candle, ladder.flower];
  return {
    headers: [
      'Product',
      'Ticker',
      'Bits',
      'Tokens/baton',
      'Market $/token',
      'Market $/baton',
      'Fee $',
      'ASIC elec. $',
      'All-in $ (fee+elec)',
      'Phone',
      'PC',
      'ASIC 100 TH/s',
    ],
    rows: tiers.map(t => ({
      product: t.product,
      ticker: t.ticker,
      bits: t.baseZeroBits,
      tokensPerBaton: t.tokensPerBaton,
      marketUsdPerToken: t.targetUsdPerToken,
      marketUsdPerBaton: t.targetUsdPerRemint,
      feeUsd: t.feeUsd,
      electricityUsd: t.referenceElectricityUsd,
      allInUsd: t.allInUsd,
      phone: formatDuration(
        wallSeconds(t.expectedHashes, UX_PHONE_HASHRATE_H_S),
      ),
      pc: formatDuration(wallSeconds(t.expectedHashes, UX_PC_HASHRATE_H_S)),
      asic100THs: formatDuration(wallSeconds(t.expectedHashes, asicHps)),
    })),
  };
}
