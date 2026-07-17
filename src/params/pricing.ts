/**
 * Pricing / difficulty ladder — ASIC energy vs UX effort.
 *
 * See docs/ECONOMICS.md. Recompute: `npm run pricing`.
 */

import { MOORE_NUM, MOORE_DEN } from './consensus.js';

/** Tokens minted per remint (all tiers). */
export const TOKENS_PER_REMINT = 100;

/** Reference industrial power price for WLOTUS energy floor. */
export const ASIC_USD_PER_KWH = 0.08;

/** Reference ASIC efficiency (J per terahash). */
export const ASIC_JOULES_PER_TH = 20;

/** User-cited class of machine for projections. */
export const ASIC_HASHRATE_TH_S = 100;

/** Rough laptop/VM JS hashrate for UX timing (H/s). */
export const UX_PC_HASHRATE_H_S = 850_000;

/** Rough phone JS hashrate for UX timing (H/s). */
export const UX_PHONE_HASHRATE_H_S = 150_000;

export const JOULES_PER_KWH = 3.6e6;

/** USD per SHA-256d hash at reference ASIC sheet. */
export function asicUsdPerHash(
  usdPerKwh: number = ASIC_USD_PER_KWH,
  joulesPerTh: number = ASIC_JOULES_PER_TH,
): number {
  const joulesPerHash = joulesPerTh / 1e12;
  return (joulesPerHash / JOULES_PER_KWH) * usdPerKwh;
}

/** Expected hashes so ASIC electricity ≈ usd (pure energy, no margin). */
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
  ticker: string;
  name: string;
  regime: 'ux-effort' | 'asic-energy';
  /** Genesis leading-zero bits (compact target may realize the same E[H]). */
  baseZeroBits: number;
  expectedHashes: number;
  targetUsdPerToken: number;
  targetUsdPerRemint: number;
  notes: string;
}

/**
 * Adjusted launch ladder.
 * n/m = UX-timed; WLOTUS = ASIC $1/token energy floor ($100/remint).
 */
export function buildPricingLadder(): {
  nwlpow: TierPlan;
  mwlpow: TierPlan;
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
  const wlotusUsdPerToken = 1;
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
    peg: '1_000_000 nWLPOW ≈ 1_000 mWLPOW ≈ 1 WLOTUS',
    nwlpow: {
      ticker: 'nWLPOW',
      name: 'nano White Lotus PoW',
      regime: 'ux-effort',
      baseZeroBits: nBits,
      expectedHashes: expectedHashesFromBits(nBits),
      targetUsdPerToken: 1e-6,
      targetUsdPerRemint: 1e-6 * TOKENS_PER_REMINT,
      notes: 'Phone/PC launch: ~minutes on phone, <1 min on PC. Not ASIC-priced.',
    },
    mwlpow: {
      ticker: 'mWLPOW',
      name: 'milli White Lotus PoW',
      regime: 'ux-effort',
      baseZeroBits: mBits,
      expectedHashes: expectedHashesFromBits(mBits),
      targetUsdPerToken: 1e-3,
      targetUsdPerRemint: 1e-3 * TOKENS_PER_REMINT,
      notes: 'Normal PC: ~tens of minutes. ASICs still print cheaply — ritual tier.',
    },
    wlotus: {
      ticker: 'WLOTUS',
      name: 'White Lotus',
      regime: 'asic-energy',
      baseZeroBits: wlotusBits,
      expectedHashes: wlotusHashes,
      targetUsdPerToken: wlotusUsdPerToken,
      targetUsdPerRemint: wlotusUsdPerRemint,
      notes:
        'ASIC electricity floor ≈ $1/token ($100/remint) at 20 J/TH, $0.08/kWh. ~26d on 100 TH/s.',
    },
  };
}

/** Days for Ergon δ to multiply work by `factor`. */
export function ergonDaysForWorkFactor(
  factor: number,
  num: bigint = MOORE_NUM,
  den: bigint = MOORE_DEN,
): number {
  const delta = Number(num) / Number(den);
  // work_{k+1} = work_k / delta  if we shrink target by δ, required hashes grow by 1/δ
  const growth = 1 / delta;
  return Math.log(factor) / Math.log(growth);
}
