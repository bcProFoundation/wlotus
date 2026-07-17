/**
 * Pricing / difficulty ladder — ritual offer tiers.
 *
 * Prestige (high → low): Flower (WLotus) → Candle → Incense → Prayer.
 *
 * **Anti-ASIC-arbitrage:** work must track token value. If ASICs can sell
 * Incense/Candle near the peg into Flower value, then
 *   Flower baton work ≈ Incense × 10_000
 *   Candle baton work ≈ Incense × 100
 *   Prayer baton work ≈ Incense / 10
 * Otherwise ASICs mint the easiest tier and ignore Flower.
 *
 * **Anchor:** Flower target market **$1/baton** → electricity share 25% on
 * the ref. ASIC sheet → **~59 bits**. UX tiers are **derived downward**
 * (Incense ≈ 59 − log2(10000) ≈ 46 bits). Phone-minute Incense is
 * incompatible with both $1 Flower and anti-arbitrage.
 *
 * Mint: Prayer 1 · Incense 1 · Candle 10 · Flower 100
 * Peg: 100 Incense ≈ 1 Candle; 100 Candle ≈ 1 Flower.
 *
 * See docs/ECONOMICS.md. Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

export const FLOWER_TOKENS_PER_BATON = 100;
/** @deprecated use FLOWER_TOKENS_PER_BATON */
export const TOKENS_PER_REMINT = FLOWER_TOKENS_PER_BATON;

export const CANDLE_TOKENS_PER_BATON = 10;
export const INCENSE_TOKENS_PER_BATON = 1;
export const PRAYER_TOKENS_PER_BATON = 1;

/** Work multiples vs Incense baton (anti-arbitrage). */
export const PRAYER_WORK_DIVISOR = 10;
export const CANDLE_WORK_FACTOR = 100;
export const FLOWER_WORK_FACTOR_FROM_INCENSE = 10_000;

/** Reference industrial power price. */
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

/** Flower hashes from $1 × electricity share (ASIC business sheet). */
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
 * Bits: Flower from $1 sheet; Incense/Candle/Prayer from ×10000 ladder.
 */
export function ritualBits(): {
  prayer: number;
  incense: number;
  candle: number;
  flower: number;
} {
  const flowerH = expectedHashesForWlotusBaton();
  const flower = Math.round(bitsFromExpectedHashes(flowerH));
  const incenseH = flowerH / FLOWER_WORK_FACTOR_FROM_INCENSE;
  return {
    flower,
    incense: Math.round(bitsFromExpectedHashes(incenseH)),
    candle: Math.round(
      bitsFromExpectedHashes(incenseH * CANDLE_WORK_FACTOR),
    ),
    prayer: Math.round(
      bitsFromExpectedHashes(incenseH / PRAYER_WORK_DIVISOR),
    ),
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
  targetUsdPerToken: number;
  targetUsdPerRemint: number;
  referenceElectricityUsd: number;
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
  const incenseHashes = flowerHashes / FLOWER_WORK_FACTOR_FROM_INCENSE;

  const flowerTok = WLOTUS_TARGET_USD_PER_TOKEN;
  const candleTok = flowerTok / 100;
  const incenseTok = candleTok / 100;
  const prayerTok = incenseTok / PRAYER_WORK_DIVISOR;

  // Soft baton market ≈ Flower $1 scaled by work factor (anti-arb).
  const incenseBatonUsd = marketBaton / FLOWER_WORK_FACTOR_FROM_INCENSE;
  const candleBatonUsd = incenseBatonUsd * CANDLE_WORK_FACTOR;
  const prayerBatonUsd = incenseBatonUsd / PRAYER_WORK_DIVISOR;

  const prayer: TierPlan = {
    product: 'Prayer',
    ticker: 'PRAYER',
    ritual: 'prayer',
    regime: 'ux-offer',
    baseZeroBits: bits.prayer,
    tokensPerBaton: PRAYER_TOKENS_PER_BATON,
    expectedHashes: incenseHashes / PRAYER_WORK_DIVISOR,
    targetUsdPerToken: prayerTok,
    targetUsdPerRemint: prayerBatonUsd,
    referenceElectricityUsd:
      (incenseHashes / PRAYER_WORK_DIVISOR) * usdPerHash,
    notes: 'Incense/10 work — anti-arb with Flower $1 sheet.',
  };

  const incense: TierPlan = {
    product: 'Incense',
    ticker: 'INCENSE',
    ritual: 'incense',
    regime: 'ux-offer',
    baseZeroBits: bits.incense,
    tokensPerBaton: INCENSE_TOKENS_PER_BATON,
    expectedHashes: incenseHashes,
    targetUsdPerToken: incenseTok,
    targetUsdPerRemint: incenseBatonUsd,
    referenceElectricityUsd: incenseHashes * usdPerHash,
    notes:
      'Flower/10000 work. Soft $1/10000 baton. Not phone-minute D (that enables ASIC arb).',
  };

  const candle: TierPlan = {
    product: 'Candle',
    ticker: 'CANDLE',
    ritual: 'candle',
    regime: 'ux-offer',
    baseZeroBits: bits.candle,
    tokensPerBaton: CANDLE_TOKENS_PER_BATON,
    expectedHashes: incenseHashes * CANDLE_WORK_FACTOR,
    targetUsdPerToken: candleTok,
    targetUsdPerRemint: candleBatonUsd,
    referenceElectricityUsd:
      incenseHashes * CANDLE_WORK_FACTOR * usdPerHash,
    notes: 'Incense×100 work — anti-arb mid tier.',
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
      '$1/baton · ~59 bits · Incense×10000 work so ASICs are indifferent across the peg.',
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
      'Prayer ≈ Incense/10 · Candle = Incense×100 · Flower = Incense×10000 (= $1 ASIC sheet ~59 bits)',
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
