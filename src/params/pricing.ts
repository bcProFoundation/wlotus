/**
 * Pricing / difficulty ladder — ritual offer tiers.
 *
 * Prestige: Flower (WLotus) → Candle → (Incense / Prayer = non-economic).
 *
 * **Non-economic (ritual chrome):**
 *   Prayer — phone ~30 s PoW + fee (intention / presence)
 *   Incense — fee-only / trivial PoW, **no MoE**, no peg into Candle/Flower
 *
 * **Economic:**
 *   Flower — **$1/baton**, 100 tokens, ASIC sheet → ~59 bits
 *   Candle — **~1/10 Flower token price** (temple-sensible, not 1/1000);
 *            fewer tokens/baton so weak machines finish quickly.
 *   Fine grain → future **mFlower**, not a tiny Candle peg.
 *
 * Fee ~5.46 XEC / remint (eCash miners). See docs/ECONOMICS.md.
 * Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

export const FLOWER_TOKENS_PER_BATON = 100;
/** @deprecated */
export const TOKENS_PER_REMINT = FLOWER_TOKENS_PER_BATON;

/**
 * Candle mint — keep small so baton work ≪ Flower (weak hardware UX).
 * 10 tokens × ($0.01/10) = $0.01/baton ≈ Flower/100 work.
 */
export const CANDLE_TOKENS_PER_BATON = 10;

/** Non-economic ritual mints. */
export const INCENSE_TOKENS_PER_BATON = 100;
export const PRAYER_TOKENS_PER_BATON = 1;

/**
 * Economic token peg: 1 Flower token ≈ **10 Candle** tokens.
 * (1/100 or 1/1000 underprices candles vs real offerings; use mFlower later.)
 */
export const CANDLES_PER_FLOWER_TOKEN = 10;

export const REMINT_FEE_XEC = 5.46;
export const XEC_USD = 8e-6;
export const REMINT_FEE_USD = REMINT_FEE_XEC * XEC_USD;

/** Prayer UX — phone ~30 s. */
export const PRAYER_UX_BITS = 22;
/** Incense — trivial / instant; fee is the only real cost. */
export const INCENSE_UX_BITS = 8;

export const ASIC_USD_PER_KWH = 0.08;
export const ASIC_JOULES_PER_TH = 20;
export const ASIC_HASHRATE_TH_S = 100;

export const UX_PC_HASHRATE_H_S = 850_000;
export const UX_PHONE_HASHRATE_H_S = 150_000;
/** “Weak” machine for Candle projections (~1 TH/s class / strong hobby). */
export const WEAK_HASHRATE_TH_S = 1;
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

/** Economic soft prices only (Prayer/Incense are non-priced). */
export function economicTokenPricesUsd(): {
  flower: number;
  candle: number;
} {
  const flower = WLOTUS_TARGET_USD_PER_TOKEN;
  return {
    flower,
    candle: flower / CANDLES_PER_FLOWER_TOKEN,
  };
}

export function economicBatonPricesUsd(): {
  flower: number;
  candle: number;
} {
  const t = economicTokenPricesUsd();
  return {
    flower: t.flower * FLOWER_TOKENS_PER_BATON,
    candle: t.candle * CANDLE_TOKENS_PER_BATON,
  };
}

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
 * Flower from $1 sheet; Candle from baton-value ratio (anti-arb);
 * Prayer/Incense = UX only (non-economic).
 */
export function ritualBits(): {
  prayer: number;
  incense: number;
  candle: number;
  flower: number;
} {
  const flowerH = expectedHashesForWlotusBaton();
  const flower = Math.round(bitsFromExpectedHashes(flowerH));
  const batons = economicBatonPricesUsd();
  const candleElec = batons.candle * WLOTUS_ELECTRICITY_SHARE_OF_PRICE;
  const candleH = expectedHashesForAsicUsd(candleElec);
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
  regime: 'non-economic' | 'asic-business';
  baseZeroBits: number;
  tokensPerBaton: number;
  expectedHashes: number;
  /** Soft market; 0 = non-economic ritual chrome. */
  targetUsdPerToken: number;
  targetUsdPerRemint: number;
  feeUsd: number;
  referenceElectricityUsd: number;
  allInUsd: number;
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
    candlePerFlowerToken: number;
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
  const tokens = economicTokenPricesUsd();
  const batons = economicBatonPricesUsd();
  const flowerHashes = expectedHashesForWlotusBaton();
  const candleHashes = expectedHashesForAsicUsd(
    batons.candle * WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
  );
  const elecUsd = batons.flower * WLOTUS_ELECTRICITY_SHARE_OF_PRICE;

  function tier(
    partial: Omit<
      TierPlan,
      'feeUsd' | 'referenceElectricityUsd' | 'allInUsd'
    >,
  ): TierPlan {
    const costs = remintAllInUsd({ expectedHashes: partial.expectedHashes });
    return {
      ...partial,
      feeUsd: costs.feeUsd,
      referenceElectricityUsd: costs.electricityUsd,
      allInUsd: costs.allInUsd,
    };
  }

  const prayer = tier({
    product: 'Prayer',
    ticker: 'PRAYER',
    ritual: 'prayer',
    regime: 'non-economic',
    baseZeroBits: bits.prayer,
    tokensPerBaton: PRAYER_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.prayer),
    targetUsdPerToken: 0,
    targetUsdPerRemint: 0,
    notes: 'Non-economic — phone intention (~30 s) + fee. Not MoE.',
  });

  const incense = tier({
    product: 'Incense',
    ticker: 'INCENSE',
    ritual: 'incense',
    regime: 'non-economic',
    baseZeroBits: bits.incense,
    tokensPerBaton: INCENSE_TOKENS_PER_BATON,
    expectedHashes: expectedHashesFromBits(bits.incense),
    targetUsdPerToken: 0,
    targetUsdPerRemint: 0,
    notes:
      'Non-economic everyday thắp hương — fee-only / trivial PoW. No peg into Candle/Flower.',
  });

  const candle = tier({
    product: 'Candle',
    ticker: 'CANDLE',
    ritual: 'candle',
    regime: 'asic-business',
    baseZeroBits: bits.candle,
    tokensPerBaton: CANDLE_TOKENS_PER_BATON,
    expectedHashes: candleHashes,
    targetUsdPerToken: tokens.candle,
    targetUsdPerRemint: batons.candle,
    notes:
      'Economic — ~1/10 Flower token; 10/baton → ~$0.01/baton (~Flower/100 work). Weak HW quick mint.',
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
    notes: 'Economic prestige — $1/baton · ~59 bits · 40% risk margin.',
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
    peg: '10 Candle ≈ 1 Flower (token); Prayer/Incense non-economic (no peg). Fine grain → mFlower later.',
    workLadder:
      'Prayer/Incense = non-economic UX · Candle ≈ Flower/100 baton work · Flower = $1 → 59 bits',
    wlotusBusiness: {
      marketUsdPerBaton: batons.flower,
      marketUsdPerToken: tokens.flower,
      electricityShare: WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
      costStack: WLOTUS_COST_STACK,
      electricityUsdAtReference: elecUsd,
      flowerBitsFromMarket: bits.flower,
      candlePerFlowerToken: CANDLES_PER_FLOWER_TOKEN,
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
    marketUsdPerToken: number | string;
    marketUsdPerBaton: number | string;
    feeUsd: number;
    electricityUsd: number;
    allInUsd: number;
    phone: string;
    weak1THs: string;
    asic100THs: string;
  }[];
} {
  const ladder = buildPricingLadder();
  const asicHps = ASIC_HASHRATE_TH_S * 1e12;
  const weakHps = WEAK_HASHRATE_TH_S * 1e12;
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
      'All-in $',
      'Phone',
      'Weak 1 TH/s',
      'ASIC 100 TH/s',
    ],
    rows: tiers.map(t => ({
      product: t.product,
      ticker: t.ticker,
      bits: t.baseZeroBits,
      tokensPerBaton: t.tokensPerBaton,
      marketUsdPerToken:
        t.regime === 'non-economic' ? '—' : t.targetUsdPerToken,
      marketUsdPerBaton:
        t.regime === 'non-economic' ? '—' : t.targetUsdPerRemint,
      feeUsd: t.feeUsd,
      electricityUsd: t.referenceElectricityUsd,
      allInUsd: t.allInUsd,
      phone: formatDuration(
        wallSeconds(t.expectedHashes, UX_PHONE_HASHRATE_H_S),
      ),
      weak1THs: formatDuration(wallSeconds(t.expectedHashes, weakHps)),
      asic100THs: formatDuration(wallSeconds(t.expectedHashes, asicHps)),
    })),
  };
}
