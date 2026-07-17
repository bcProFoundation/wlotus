/**
 * Pricing / difficulty ladder — ASIC energy vs UX effort.
 *
 * Standard: WLotus = $0.01/token = $1/baton (ASIC electricity floor).
 * Launch order: nWLotus → mWLotus → WLotus (all may run in parallel).
 *
 * See docs/ECONOMICS.md. Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

export const TOKENS_PER_REMINT = 100;

/** Reference industrial power price for WLotus energy floor. */
export const ASIC_USD_PER_KWH = 0.08;

/** Reference ASIC efficiency (J per terahash). */
export const ASIC_JOULES_PER_TH = 20;

/** Reference machine for projections. */
export const ASIC_HASHRATE_TH_S = 100;

/** Rough laptop/VM JS hashrate (H/s). */
export const UX_PC_HASHRATE_H_S = 850_000;

/** Rough phone JS hashrate (H/s). */
export const UX_PHONE_HASHRATE_H_S = 150_000;

export const JOULES_PER_KWH = 3.6e6;

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
  regime: 'ux-effort' | 'asic-energy';
  baseZeroBits: number;
  expectedHashes: number;
  targetUsdPerToken: number;
  targetUsdPerRemint: number;
  notes: string;
}

/**
 * Canonical ladder (parallel tokens OK).
 * WLotus: $0.01/token = $1/baton ASIC floor → ~61 bits.
 */
export function buildPricingLadder(): {
  nwlotus: TierPlan;
  mwlotus: TierPlan;
  wlotus: TierPlan;
  peg: string;
  asic: {
    usdPerKwh: number;
    joulesPerTh: number;
    hashrateThs: number;
    usdPerHash: number;
  };
} {
  const usdPerHash = asicUsdPerHash();
  /** Standard: $0.01/token ⇒ $1/remint. */
  const wlotusUsdPerToken = 0.01;
  const wlotusUsdPerRemint = wlotusUsdPerToken * TOKENS_PER_REMINT;
  const wlotusHashes = expectedHashesForAsicUsd(wlotusUsdPerRemint);
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
    nwlotus: {
      product: 'nWLotus',
      ticker: 'nWLOTUS',
      regime: 'ux-effort',
      baseZeroBits: nBits,
      expectedHashes: expectedHashesFromBits(nBits),
      targetUsdPerToken: 1e-8,
      targetUsdPerRemint: 1e-8 * TOKENS_PER_REMINT,
      notes: 'Launch tier — phone/PC. Start here. Not ASIC-priced.',
    },
    mwlotus: {
      product: 'mWLotus',
      ticker: 'mWLOTUS',
      regime: 'ux-effort',
      baseZeroBits: mBits,
      expectedHashes: expectedHashesFromBits(mBits),
      targetUsdPerToken: 1e-5,
      targetUsdPerRemint: 1e-5 * TOKENS_PER_REMINT,
      notes: 'Incubation — normal PC minutes. ASICs still cheap; ritual tier.',
    },
    wlotus: {
      product: 'WLotus',
      ticker: 'WLOTUS',
      regime: 'asic-energy',
      baseZeroBits: wlotusBits,
      expectedHashes: wlotusHashes,
      targetUsdPerToken: wlotusUsdPerToken,
      targetUsdPerRemint: wlotusUsdPerRemint,
      notes:
        'Production — ASIC electricity ≈ $0.01/token ($1/baton). ~6.3h on 100 TH/s.',
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

/** Mint-time matrix: product × device. */
export function buildMintTimeTable(): {
  headers: string[];
  rows: {
    product: string;
    ticker: string;
    bits: number;
    usdPerToken: number;
    usdPerBaton: number;
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
      '$/token',
      '$/baton',
      'Phone (~0.15 MH/s)',
      'PC (~0.85 MH/s)',
      'ASIC (100 TH/s)',
    ],
    rows: tiers.map(t => ({
      product: t.product,
      ticker: t.ticker,
      bits: t.baseZeroBits,
      usdPerToken: t.targetUsdPerToken,
      usdPerBaton: t.targetUsdPerRemint,
      phone: formatDuration(
        wallSeconds(t.expectedHashes, UX_PHONE_HASHRATE_H_S),
      ),
      pc: formatDuration(wallSeconds(t.expectedHashes, UX_PC_HASHRATE_H_S)),
      asic100THs: formatDuration(wallSeconds(t.expectedHashes, asicHps)),
    })),
  };
}
