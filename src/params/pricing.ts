/**
 * Pricing / difficulty ladder — ritual offer tiers.
 *
 * Prestige (high → low): Flower (WLotus) → Candle → Incense → Prayer.
 * (Unlike Lotus Temple burn amounts, where flower is the cheapest offer.)
 *
 * Two regimes:
 *   - **UX offers** (Prayer / Incense / Candle): wall-clock from Incense
 *     baseline (phone ~3.7 min). Prayer ≈ Incense/10; Candle = Incense×100.
 *   - **Flower (WLotus)**: **ASIC business** — target market **$1/baton**;
 *     D sized so ref. electricity ≈ 25% of that $1 → **~59 bits**
 *     (NOT Incense×10000 — that was a mistaken overwrite of the $1 sheet).
 *
 * Mint atoms / baton: Prayer 1 · Incense 1 · Candle 10 · Flower 100
 * Token peg intent: 100 Incense ≈ 1 Candle; 100 Candle ≈ 1 Flower.
 *
 * See docs/ECONOMICS.md. Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

/** Flower (WLotus) mint atoms — prestige tier. */
export const FLOWER_TOKENS_PER_BATON = 100;
/** @deprecated use FLOWER_TOKENS_PER_BATON */
export const TOKENS_PER_REMINT = FLOWER_TOKENS_PER_BATON;

export const CANDLE_TOKENS_PER_BATON = 10;
export const INCENSE_TOKENS_PER_BATON = 1;
export const PRAYER_TOKENS_PER_BATON = 1;

/** Incense baseline bits — phone ~3.7 min @ 0.15 MH/s. */
export const INCENSE_BASE_ZERO_BITS = 25;

/** Work multiples vs Incense for UX tiers only. */
export const PRAYER_WORK_DIVISOR = 10;
export const CANDLE_WORK_FACTOR = 100;

/** Reference industrial power price. */
export const ASIC_USD_PER_KWH = 0.08;

/** Reference ASIC efficiency (J per terahash). */
export const ASIC_JOULES_PER_TH = 20;

/** Reference machine for projections. */
export const ASIC_HASHRATE_TH_S = 100;

export const UX_PC_HASHRATE_H_S = 850_000;
export const UX_PHONE_HASHRATE_H_S = 150_000;
export const JOULES_PER_KWH = 3.6e6;

/**
 * Flower (WLotus) target **market** price per baton (100 tokens).
 * Revenue a remint is meant to clear at — not pure kWh cost.
 */
export const WLOTUS_TARGET_USD_PER_BATON = 1;
export const WLOTUS_TARGET_USD_PER_TOKEN =
  WLOTUS_TARGET_USD_PER_BATON / FLOWER_TOKENS_PER_BATON;

/**
 * Share of Flower baton market price attributed to **electricity** when
 * sizing Flower D. Remainder ≈ HW + facility + labor + risk margin.
 */
export const WLOTUS_ELECTRICITY_SHARE_OF_PRICE = 0.25;

/**
 * Illustrative $1 Flower baton cost stack (business, not oracle).
 * New/illiquid market → **40%** risk margin (see ECONOMICS.md).
 */
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

/** Hashes so Flower electricity ≈ share × $1 market baton price. */
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

/**
 * Genesis bits: UX tiers from Incense ladder; Flower from $1 ASIC sheet.
 */
export function ritualBits(): {
  prayer: number;
  incense: number;
  candle: number;
  flower: number;
} {
  const incense = INCENSE_BASE_ZERO_BITS;
  const incenseH = expectedHashesFromBits(incense);
  const flowerH = expectedHashesForWlotusBaton();
  return {
    prayer: Math.round(
      bitsFromExpectedHashes(incenseH / PRAYER_WORK_DIVISOR),
    ),
    incense,
    candle: Math.round(
      bitsFromExpectedHashes(incenseH * CANDLE_WORK_FACTOR),
    ),
    flower: Math.round(bitsFromExpectedHashes(flowerH)),
  };
}

export interface TierPlan {
  product: string;
  ticker: string;
  ritual: 'prayer' | 'incense' | 'candle' | 'flower';
  regime: 'ux-offer' | 'asic-business';
  baseZeroBits: number;
  tokensPerBaton: number;
  expectedHashes: number;
  /** Soft / target market $/token. */
  targetUsdPerToken: number;
  /** Soft / target market $/baton. */
  targetUsdPerRemint: number;
  /** Reference ASIC electricity $ at this D (energy cost only). */
  referenceElectricityUsd: number;
  notes: string;
}

export function buildPricingLadder(): {
  prayer: TierPlan;
  incense: TierPlan;
  candle: TierPlan;
  flower: TierPlan;
  /** @deprecated alias → incense */
  nwlotus: TierPlan;
  /** @deprecated alias → candle */
  mwlotus: TierPlan;
  /** @deprecated alias → flower */
  wlotus: TierPlan;
  peg: string;
  workLadder: string;
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
  const marketBaton = WLOTUS_TARGET_USD_PER_BATON;
  const elecUsd = marketBaton * WLOTUS_ELECTRICITY_SHARE_OF_PRICE;
  const bits = ritualBits();
  const flowerHashes = expectedHashesForWlotusBaton();

  // Soft token prices from Flower $0.01 and 100∶1 peg intent.
  const flowerTok = WLOTUS_TARGET_USD_PER_TOKEN;
  const candleTok = flowerTok / 100;
  const incenseTok = candleTok / 100;
  const prayerTok = incenseTok / PRAYER_WORK_DIVISOR;

  const prayer: TierPlan = {
    product: 'Prayer',
    ticker: 'PRAYER',
    ritual: 'prayer',
    regime: 'ux-offer',
    baseZeroBits: bits.prayer,
    tokensPerBaton: PRAYER_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.prayer),
    targetUsdPerToken: prayerTok,
    targetUsdPerRemint: prayerTok * PRAYER_TOKENS_PER_BATON,
    referenceElectricityUsd:
      expectedHashesFromBits(bits.prayer) * usdPerHash,
    notes: 'Quick offer — ~1/10 Incense wall-clock (~30 s phone).',
  };

  const incense: TierPlan = {
    product: 'Incense',
    ticker: 'INCENSE',
    ritual: 'incense',
    regime: 'ux-offer',
    baseZeroBits: bits.incense,
    tokensPerBaton: INCENSE_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.incense),
    targetUsdPerToken: incenseTok,
    targetUsdPerRemint: incenseTok * INCENSE_TOKENS_PER_BATON,
    referenceElectricityUsd:
      expectedHashesFromBits(bits.incense) * usdPerHash,
    notes: 'Launch offer — phone ~3.7 min (ex-nWLotus). 1 token/baton.',
  };

  const candle: TierPlan = {
    product: 'Candle',
    ticker: 'CANDLE',
    ritual: 'candle',
    regime: 'ux-offer',
    baseZeroBits: bits.candle,
    tokensPerBaton: CANDLE_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.candle),
    targetUsdPerToken: candleTok,
    targetUsdPerRemint: candleTok * CANDLE_TOKENS_PER_BATON,
    referenceElectricityUsd:
      expectedHashesFromBits(bits.candle) * usdPerHash,
    notes: 'Mid offer — Incense × 100 work (ex-mWLotus). 10 tokens/baton.',
  };

  const flower: TierPlan = {
    product: 'Flower',
    ticker: 'WLOTUS',
    ritual: 'flower',
    regime: 'asic-business',
    baseZeroBits: bits.flower,
    tokensPerBaton: FLOWER_TOKENS_PER_BATON,
    expectedHashes: flowerHashes,
    targetUsdPerToken: flowerTok,
    targetUsdPerRemint: marketBaton,
    referenceElectricityUsd: elecUsd,
    notes:
      'Prestige Flower (WLotus) — $1/baton market; D from ~25% electricity on ref. ASIC (~59 bits); 40% risk margin. Not Incense×10000.',
  };

  return {
    asic: {
      usdPerKwh: ASIC_USD_PER_KWH,
      joulesPerTh: ASIC_JOULES_PER_TH,
      hashrateThs: ASIC_HASHRATE_TH_S,
      usdPerHash,
    },
    peg: '10_000 Incense ≈ 100 Candle ≈ 1 Flower (WLotus); Prayer ≈ Incense/10',
    workLadder:
      'UX: Prayer ≈ Incense/10 · Candle = Incense×100 · Flower = $1 ASIC sheet (~59 bits), not Incense×10000',
    wlotusBusiness: {
      marketUsdPerBaton: marketBaton,
      marketUsdPerToken: WLOTUS_TARGET_USD_PER_TOKEN,
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
    electricityUsd: number;
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
      'ASIC elec. $ (ref)',
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
      electricityUsd: t.referenceElectricityUsd,
      phone: formatDuration(
        wallSeconds(t.expectedHashes, UX_PHONE_HASHRATE_H_S),
      ),
      pc: formatDuration(wallSeconds(t.expectedHashes, UX_PC_HASHRATE_H_S)),
      asic100THs: formatDuration(wallSeconds(t.expectedHashes, asicHps)),
    })),
  };
}
