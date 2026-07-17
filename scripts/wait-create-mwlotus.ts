#!/usr/bin/env tsx
/**
 * Wait until genesis wallet has enough pure XEC, then create mWLOTUS + mine once.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { spawn } from 'node:child_process';
import { Wallet } from 'ecash-wallet';
import { fromHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const NEED_SATS = 10_000n; // ~100 XEC headroom
const POLL_MS = 15_000;

function run(script: string): Promise<void> {
  return new Promise((resolveP, reject) => {
    const child = spawn('npx', ['tsx', script], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', code => {
      if (code === 0) resolveP();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex) throw new Error('GENESIS_SK_HEX missing');

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);

  console.log('Waiting for ≥', Number(NEED_SATS) / 100, 'XEC at', wallet.address);
  for (;;) {
    await wallet.sync();
    const pure = wallet.utxos
      .filter(u => !u.token)
      .reduce((a, u) => a + u.sats, 0n);
    console.log(new Date().toISOString(), 'pureSats', pure.toString());
    if (pure >= NEED_SATS) break;
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  await run('scripts/create-pow-token.ts');
  await run('scripts/mine-once.ts');
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
