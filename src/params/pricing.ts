/**
 * Pricing / difficulty ladder.
 *
 * WLotus **target market price** = $1 / baton ($0.01 / token).
 * That is a business revenue target (Ergon-style: mine for operating profit),
 * NOT “electricity alone = $1”. Difficulty is set so reference-ASIC
 * **electricity** is only a share of that $1; the rest covers hardware,
 * space, labor, and margin.
 *
 * See docs/ECONOMICS.md. Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

export const TOKENS_PER_REMINT = 100;

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
 * WLotus target **market** price per baton (100 tokens).
 * Revenue a remint is meant to clear at — not pure kWh cost.
 */
export const WLOTUS_TARGET_USD_PER_BATON = 1;
export const WLOTUS_TARGET_USD_PER_TOKEN =
  WLOTUS_TARGET_USD_PER_BATON / TOKENS_PER_REMINT;

/**
 * Share of baton market price attributed to **electricity** when sizing D.
 * Remainder ≈ hardware + facility/space + labor + risk margin.
 * Ergon-style: mining is a normal business, not NGU speculation.
 *
 * New / illiquid markets typically need a **~30–50%** risk margin (vs ~10%
 * thin commodity nets). We use **40%** — see WLOTUS_COST_STACK.
 */
export const WLOTUS_ELECTRICITY_SHARE_OF_PRICE = 0.25;

/**
 * Illustrative $1 baton cost stack (business, not oracle).
 *
 * Margin rationale: mature liquid mining often clears ~30–45% mining margin
 * in good times; a **new** token market has thinner books and demand risk,
 * so target the upper half of the early-market **30–50%** band → **40%**.
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

/** Hashes so electricity cost ≈ share × market baton price. */
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

export interface TierPlan {
  product: string;
  ticker: string;
  regime: 'ux-effort' | 'asic-business';
  baseZeroBits: number;
  expectedHashes: number;
  /** Target market $/token (not electricity-only). */
  targetUsdPerToken: number;
  /** Target market $/baton. */
  targetUsdPerRemint: number;
  /** Reference ASIC electricity $ at this D (energy cost only). */
  referenceElectricityUsd: number;
  notes: string;
}

export function buildPricingLadder(): {
  nwlotus: TierPlan;
  mwlotus: TierPlan;
  wlotus: TierPlan;
  peg: string;
  wlotusBusiness: {
    marketUsdPerBaton: number;
    marketUsdPerToken: number;
    electricityShare: number;
    costStack: typeof WLOTUS_COST_STACK;
    electricityUsdAtReference: number;
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
  const wlotusHashes = expectedHashesForWlotusBaton();
  const wlotusBits = Math.round(bitsFromExpectedHashes(wlotusHashes));

  const nBits = 25;
  const mBits = 30;

  return {
    asic: {
      usdPerKwh: ASIC_USD_PER_KWH,
      joulesPerTh: ASIC_JOULES_PER_TH,
      hashrateThs: ASIC_HASHRATE_TH_S,
      usdPerHash,
    },
    peg: '1_000_000 nWLotus ≈ 1_000 mWLotus ≈ 1 WLotus',
    wlotusBusiness: {
      marketUsdPerBaton: marketBaton,
      marketUsdPerToken: WLOTUS_TARGET_USD_PER_TOKEN,
      electricityShare: WLOTUS_ELECTRICITY_SHARE_OF_PRICE,
      costStack: WLOTUS_COST_STACK,
      electricityUsdAtReference: elecUsd,
    },
    nwlotus: {
      product: 'nWLotus',
      ticker: 'nWLOTUS',
      regime: 'ux-effort',
      baseZeroBits: nBits,
      expectedHashes: expectedHashesFromBits(nBits),
      targetUsdPerToken: 1e-8,
      targetUsdPerRemint: 1e-8 * TOKENS_PER_REMINT,
      referenceElectricityUsd:
        expectedHashesFromBits(nBits) * usdPerHash,
      notes: 'Launch — phone/PC wall-clock. Soft market price; not ASIC business D.',
    },
    mwlotus: {
      product: 'mWLotus',
      ticker: 'mWLOTUS',
      regime: 'ux-effort',
      baseZeroBits: mBits,
      expectedHashes: expectedHashesFromBits(mBits),
      targetUsdPerToken: 1e-5,
      targetUsdPerRemint: 1e-5 * TOKENS_PER_REMINT,
      referenceElectricityUsd:
        expectedHashesFromBits(mBits) * usdPerHash,
      notes: 'Incubation — PC minutes. Soft market price; ASICs still cheap.',
    },
    wlotus: {
      product: 'WLotus',
      ticker: 'WLOTUS',
      regime: 'asic-business',
      baseZeroBits: wlotusBits,
      expectedHashes: wlotusHashes,
      targetUsdPerToken: WLOTUS_TARGET_USD_PER_TOKEN,
      targetUsdPerRemint: marketBaton,
      referenceElectricityUsd: elecUsd,
      notes:
        'Production — $1/baton market price; D sized so ~25% is electricity on reference ASIC; ~40% risk margin for new-market demand risk.',
    },
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
  const tiers = [ladder.nwlotus, ladder.mwlotus, ladder.wlotus];
  return {
    headers: [
      'Product',
      'Ticker',
      'Bits',
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
