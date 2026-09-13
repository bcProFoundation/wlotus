#!/usr/bin/env tsx
/**
 * ONE-SHOT: burn the three dead-SHARD premine UTXOs (genesis 1–3, whose
 * shards are bricked) to free their 3×546 dust sats for genesis 4.
 * The atoms are worthless (dead tokens); the sats fund the experiment.
 */
import { resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { ALP_TOKEN_TYPE_STANDARD, fromHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }
  // Collect dead SHARD tokenIds from live + archived twoshard dep records.
  const depDir = resolve(process.cwd(), 'deployments');
  const tokenIds: string[] = [];
  for (const f of readdirSync(depDir)) {
    if (!/^mainnet-twoshard-shard(-archived-\d+)?\.json$/.test(f)) continue;
    const dep = JSON.parse(readFileSync(resolve(depDir, f), 'utf8'));
    if (dep.tokenId && !tokenIds.includes(dep.tokenId)) {
      tokenIds.push(dep.tokenId);
    }
  }
  if (tokenIds.length === 0) throw new Error('no twoshard dep records');
  console.log(`Burning premine of ${tokenIds.length} dead tokens`);

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();
  console.log(`Balance before: ${wallet.balanceSats} sats`);

  const resp = await wallet
    .action({
      outputs: [{ sats: 0n }, { sats: 1000n, script: wallet.script }],
      tokenActions: tokenIds.map(tokenId => ({
        type: 'BURN' as const,
        tokenId,
        burnAtoms: 1000n,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
      })),
    })
    .build()
    .broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Burn failed: ${JSON.stringify(resp)}`);
  }
  console.log('Burn tx', resp.broadcasted[0]);
  await wallet.sync();
  console.log(`Balance after: ${wallet.balanceSats} sats`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
