#!/usr/bin/env tsx
/**
 * Print Prayer / Incense / Candle / Flower (WLotus) mint-time matrix.
 */
import {
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
} from '../src/params/pricing.js';

const ladder = buildPricingLadder();
const table = buildMintTimeTable();

console.log('=== Ritual offer ladder ===');
console.log({
  workLadder: ladder.workLadder,
  peg: ladder.peg,
  flowerMarketUsdPerBaton: ladder.wlotusBusiness.marketUsdPerBaton,
  flowerMarketUsdPerToken: ladder.wlotusBusiness.marketUsdPerToken,
  electricityShare: ladder.wlotusBusiness.electricityShare,
  costStack: ladder.wlotusBusiness.costStack,
  asicSheetBitsIfPricedFromElecShare:
    ladder.wlotusBusiness.asicSheetBitsIfPricedFromElecShare,
  asicSheet: ladder.asic,
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
      r.tokensPerBaton,
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
