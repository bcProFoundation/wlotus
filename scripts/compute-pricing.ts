#!/usr/bin/env tsx
/**
 * Print nWLotus / mWLotus / WLotus mint-time matrix.
 */
import {
  buildMintTimeTable,
  buildPricingLadder,
  ergonDaysForWorkFactor,
} from '../src/params/pricing.js';

const ladder = buildPricingLadder();
const table = buildMintTimeTable();

console.log('ASIC sheet', ladder.asic);
console.log('Peg:', ladder.peg);
console.log('');
console.log(table.headers.join(' | '));
console.log(table.headers.map(() => '---').join(' | '));
for (const r of table.rows) {
  console.log(
    [
      r.product,
      r.ticker,
      r.bits,
      r.usdPerToken,
      r.usdPerBaton,
      r.phone,
      r.pc,
      r.asic100THs,
    ].join(' | '),
  );
}
console.log('');
console.log(
  JSON.stringify(
    {
      ergonYearsToDoubleWork: ergonDaysForWorkFactor(2) / 365.25,
      rows: table.rows,
    },
    null,
    2,
  ),
);
