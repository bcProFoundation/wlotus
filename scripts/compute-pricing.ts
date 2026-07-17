#!/usr/bin/env tsx
/**
 * Print Prayer / Incense / Candle / Flower matrix (fee floor + PoW).
 */
import {
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
} from '../src/params/pricing.js';

const ladder = buildPricingLadder();
const table = buildMintTimeTable();

console.log('=== Fee floor + ritual ladder ===');
console.log({
  fee: ladder.fee,
  workLadder: ladder.workLadder,
  peg: ladder.peg,
  flowerMarketUsdPerBaton: ladder.wlotusBusiness.marketUsdPerBaton,
  costStack: ladder.wlotusBusiness.costStack,
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
      r.feeUsd.toExponential(2),
      r.electricityUsd.toExponential(2),
      r.allInUsd.toExponential(2),
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
