#!/usr/bin/env tsx
/**
 * Create the low-difficulty White Lotus *test* ALP token on eCash mainnet.
 *
 * Usage:
 *   1. npm run new-wallet          # writes .env with GENESIS_WIF + address
 *   2. Send ≥ 200 XEC to that address (~$0.001)
 *   3. npm run create-test-token   # broadcasts GENESIS
 *
 * Chronik fleet: chronik.e.cash, xec.paybutton.org, chronik.pay2stay.com/xec
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import {
  TEST_TARGET_USD_PER_TOKEN,
  PROD_TARGET_USD_PER_TOKEN,
  TEST_POW_LEADING_ZERO_BYTES,
} from '../src/params/testEconomics.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

function requireGenesisSk(): Uint8Array {
  const hex = process.env.GENESIS_SK_HEX?.trim();
  const wifNote = process.env.GENESIS_WIF?.trim();
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return fromHex(hex);
  }
  if (wifNote) {
    throw new Error(
      'GENESIS_WIF is set but this script expects GENESIS_SK_HEX (32-byte hex). ' +
        'Run `npm run new-wallet` to regenerate, or set GENESIS_SK_HEX.',
    );
  }
  throw new Error(
    'Missing GENESIS_SK_HEX. Run `npm run new-wallet` first, fund the address, then re-run.',
  );
}

async function main(): Promise<void> {
  const chronik = await createChronik('closest');
  const tip = await chronik.blockchainInfo();
  const wallet = Wallet.fromSk(requireGenesisSk(), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        network: 'mainnet',
        tipHeight: tip.tipHeight,
        genesisAddress: wallet.address,
        balanceSats: wallet.balanceSats.toString(),
        balanceXec: (Number(wallet.balanceSats) / 100).toFixed(2),
        targetUsdPerToken: TEST_TARGET_USD_PER_TOKEN,
        futureUsdPerToken: PROD_TARGET_USD_PER_TOKEN,
        powLeadingZeroBytes: TEST_POW_LEADING_ZERO_BYTES,
      },
      null,
      2,
    ),
  );

  const result = await broadcastAlpGenesis(wallet);

  const outDir = resolve(process.cwd(), 'deployments');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'mainnet-test-token.json');
  const payload = {
    ...result,
    createdAt: new Date().toISOString(),
    tipHeightAtGenesis: tip.tipHeight,
    chronikExplorerHint: `https://explorer.e.cash/tx/${result.tokenId}`,
    cashtabTokenHint: `https://cashtab.com/#/token/${result.tokenId}`,
    notes: [
      'Custodial mint batons held by genesis wallet until PoW covenant is live.',
      `Test economics target ~$${TEST_TARGET_USD_PER_TOKEN}/token; raise PoW for ~$${PROD_TARGET_USD_PER_TOKEN}.`,
    ],
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log('\nGenesis OK');
  console.log(JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
