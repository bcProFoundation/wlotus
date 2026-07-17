#!/usr/bin/env tsx
/**
 * Print nWLotus / mWLotus / WLotus matrix (market price vs electricity).
 */
import {
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
} from '../src/params/pricing.js';

const ladder = buildPricingLadder();
const table = buildMintTimeTable();

console.log('=== Energy cost vs market price ===');
console.log({
  wlotusMarketUsdPerBaton: ladder.wlotusBusiness.marketUsdPerBaton,
  wlotusMarketUsdPerToken: ladder.wlotusBusiness.marketUsdPerToken,
  electricityShare: ladder.wlotusBusiness.electricityShare,
  electricityUsdAtReference: ladder.wlotusBusiness.electricityUsdAtReference,
  costStack: ladder.wlotusBusiness.costStack,
  asicSheet: ladder.asic,
  peg: ladder.peg,
});

console.log('\n=== Mint-time matrix ===');
console.log(table.headers.join(' | '));
console.log(table.headers.map(() => '---').join(' | '));
for (const r of table.rows) {
  console.log(
    [
      r.product,
      r.ticker,
      r.bits,
      r.marketUsdPerToken,
      r.marketUsdPerBaton,
      r.electricityUsd.toExponential(2),
      r.phone,
      r.pc,
      r.asic100THs,
    ].join(' | '),
  );
}

console.log(
  '\n',
  JSON.stringify(
    {
      ergonYearsToDoubleWork: ergonDaysForWorkFactor(2) / 365.25,
      rows: table.rows,
    },
    null,
    2,
  ),
);
