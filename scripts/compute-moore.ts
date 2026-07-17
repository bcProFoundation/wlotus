#!/usr/bin/env tsx
/**
 * Print Moore-adjusted mint atoms after K wall-days.
 * Usage: npm run moore -- --days 365
 */
import { mintAtomsAfterDays, approxHalfLifeYears } from '../src/lib/moore.js';
import { BASE_MINT_ATOMS, MOORE_NUM, MOORE_DEN } from '../src/params/consensus.js';

function parseDays(argv: string[]): number {
  const i = argv.indexOf('--days');
  if (i === -1 || !argv[i + 1]) return 0;
  return Number.parseInt(argv[i + 1], 10);
}

const days = parseDays(process.argv.slice(2));
if (!Number.isFinite(days) || days < 0) {
  console.error('Usage: npm run moore -- --days <non-negative-int>');
  process.exit(1);
}

const atoms = mintAtomsAfterDays(days);
console.log(
  JSON.stringify(
    {
      days,
      baseMintAtoms: BASE_MINT_ATOMS.toString(),
      mintAtoms: atoms.toString(),
      delta: `${MOORE_NUM}/${MOORE_DEN}`,
      approxHalfLifeYears: Number(approxHalfLifeYears().toFixed(4)),
    },
    null,
    2,
  ),
);
