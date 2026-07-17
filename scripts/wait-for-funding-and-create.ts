#!/usr/bin/env tsx
/**
 * Poll genesis address until funded, then run create-test-token logic.
 * Usage: npm run wait-create-test-token -- --timeout-min 30
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { spawn } from 'node:child_process';
import { Wallet } from 'ecash-wallet';
import { fromHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

function parseTimeoutMin(argv: string[]): number {
  const i = argv.indexOf('--timeout-min');
  if (i === -1 || !argv[i + 1]) return 45;
  return Number.parseInt(argv[i + 1], 10);
}

async function main(): Promise<void> {
  const timeoutMin = parseTimeoutMin(process.argv.slice(2));
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing — run npm run new-wallet first');
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  const needSats = 8_000n;
  const deadline = Date.now() + timeoutMin * 60_000;

  console.log(
    JSON.stringify(
      {
        polling: wallet.address,
        needSats: needSats.toString(),
        timeoutMin,
      },
      null,
      2,
    ),
  );

  while (Date.now() < deadline) {
    await wallet.sync();
    console.log(
      `[${new Date().toISOString()}] balanceSats=${wallet.balanceSats}`,
    );
    if (wallet.balanceSats >= needSats) {
      console.log('Funded — creating test token…');
      const child = spawn('npm', ['run', 'create-test-token'], {
        stdio: 'inherit',
        cwd: process.cwd(),
        shell: true,
      });
      const code: number = await new Promise(resolve =>
        child.on('close', resolve),
      );
      process.exit(code ?? 1);
    }
    await new Promise(r => setTimeout(r, 20_000));
  }

  console.error(`Timed out after ${timeoutMin}m waiting for funding`);
  process.exit(2);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
