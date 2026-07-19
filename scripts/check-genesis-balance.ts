#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
import { fromHex } from 'ecash-lib';
import { Wallet } from 'ecash-wallet';
import { createChronik } from '../src/network/createChronik.js';

config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const sk = process.env.GENESIS_SK_HEX?.trim();
  if (!sk) throw new Error('no sk');
  const chronik = await createChronik('closest');
  const w = Wallet.fromSk(fromHex(sk), chronik);
  await w.sync();
  console.log(
    JSON.stringify({
      address: w.address,
      xec: Number(w.balanceSats) / 100,
      utxos: w.utxos.length,
    }),
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
