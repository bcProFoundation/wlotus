#!/usr/bin/env tsx
/**
 * Print ASIC / UX pricing ladder (docs/ECONOMICS.md).
 */
import {
  ASIC_HASHRATE_TH_S,
  UX_PC_HASHRATE_H_S,
  UX_PHONE_HASHRATE_H_S,
  buildPricingLadder,
  ergonDaysForWorkFactor,
  wallSeconds,
} from '../src/params/pricing.js';

function fmtSec(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

const ladder = buildPricingLadder();
const asicHps = ASIC_HASHRATE_TH_S * 1e12;

console.log(JSON.stringify({
  asicSheet: ladder.asic,
  peg: ladder.peg,
  tiers: [ladder.nwlpow, ladder.mwlpow, ladder.wlotus].map(t => ({
    ticker: t.ticker,
    regime: t.regime,
    bits: t.baseZeroBits,
    expectedHashes: t.expectedHashes,
    usdPerToken: t.targetUsdPerToken,
    usdPerRemint: t.targetUsdPerRemint,
    wall: {
      phone: fmtSec(wallSeconds(t.expectedHashes, UX_PHONE_HASHRATE_H_S)),
      pcJs: fmtSec(wallSeconds(t.expectedHashes, UX_PC_HASHRATE_H_S)),
      asic100THs: fmtSec(wallSeconds(t.expectedHashes, asicHps)),
    },
    asicElectricityUsd: t.expectedHashes * ladder.asic.usdPerHash,
    notes: t.notes,
  })),
  ergonDaysToDoubleWork: ergonDaysForWorkFactor(2),
  ergonYearsToDoubleWork: ergonDaysForWorkFactor(2) / 365.25,
}, null, 2));
