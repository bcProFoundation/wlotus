#!/usr/bin/env tsx
/**
 * Mine one remint against the test Prayer (tPRAYER) baton.
 * Reads deployments/mainnet-prayer-test.json for tokenId + mintAtoms.
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, payment, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { createPowRemintContract } from '../src/covenant/powRemintScript.js';
import { buildMinedRemintTx, minerBanner } from '../src/miner/remint.js';
import { PRAYER_MINT_ATOMS } from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const REMINT_FUEL_SATS = 3_000n;

async function ensureSmallFuel(wallet: Wallet): Promise<void> {
  await wallet.sync();
  const small = wallet.utxos.find(
    u =>
      !u.token &&
      u.sats >= REMINT_FUEL_SATS &&
      u.sats <= REMINT_FUEL_SATS + 2_000n,
  );
  if (small) return;

  const big = wallet.utxos
    .filter(u => !u.token && u.sats > REMINT_FUEL_SATS + 5_000n)
    .sort((a, b) => (a.sats < b.sats ? 1 : -1))[0];
  if (!big) {
    throw new Error(
      `Need a pure XEC UTXO ≥ ${REMINT_FUEL_SATS + 5_000n} sats to split remint fuel`,
    );
  }

  console.log(`Splitting fuel: ${big.sats} → ${REMINT_FUEL_SATS}`);
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: wallet.script }],
  };
  const resp = await wallet.action(action).build().broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Fuel split failed: ${JSON.stringify(resp)}`);
  }
  console.log('Fuel split tx', resp.broadcasted[0]);
  await wallet.sync();
}

async function main(): Promise<void> {
  console.log(minerBanner());
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const depPath = resolve(process.cwd(), 'deployments/mainnet-prayer-test.json');
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-prayer-test.json — run create-prayer-pow-token');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8')) as {
    tokenId: string;
    powAddress?: string;
    mintAtomsPerRemint?: string;
    difficultyLeadingZeroBytes?: number;
  };
  const tokenId = process.env.TOKEN_ID?.trim() || dep.tokenId;
  const mintAtoms = BigInt(dep.mintAtomsPerRemint ?? PRAYER_MINT_ATOMS);
  const powBytes = dep.difficultyLeadingZeroBytes ?? 1;

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureSmallFuel(wallet);

  const contract = await createPowRemintContract({
    tokenId,
    mintAtoms,
    difficultyLeadingZeroBytes: powBytes,
  });
  if (dep.powAddress && dep.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: dep=${dep.powAddress} computed=${contract.address}`,
    );
  }

  const scriptHex = toHex(contract.scriptHash);
  const scriptUtxos = await chronik.script('p2sh', scriptHex).utxos();
  const list = Array.isArray(scriptUtxos)
    ? scriptUtxos
    : ((scriptUtxos as { utxos?: unknown[] }).utxos ?? []);
  const batonUtxos = (
    list as {
      token?: { tokenId?: string; isMintBaton?: boolean };
      outpoint: { txid: string; outIdx: number };
      sats: number | bigint;
    }[]
  ).filter(
    u => u.token?.tokenId === tokenId && u.token?.isMintBaton,
  );
  if (batonUtxos.length === 0) {
    throw new Error(`No PoW batons at ${contract.address}`);
  }

  const b = batonUtxos[0]!;
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid,
    vout: b.outpoint.outIdx,
  };

  await wallet.sync();
  const fuelUtxo = wallet.utxos
    .filter(u => !u.token && u.sats >= REMINT_FUEL_SATS)
    .sort((a, c) => (a.sats < c.sats ? -1 : 1))[0];
  if (!fuelUtxo) {
    throw new Error('No fuel UTXO after split');
  }

  const built = await buildMinedRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: fuelUtxo.outpoint,
      sats: fuelUtxo.sats,
      outputScript: wallet.script,
    },
    miner: { sk: wallet.sk, pk: wallet.pk },
  });

  const broadcast = await chronik.broadcastTx(built.txHex);
  const txid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;

  const remintPath = resolve(
    process.cwd(),
    'deployments/mainnet-last-prayer-remint.json',
  );
  writeFileSync(
    remintPath,
    `${JSON.stringify(
      {
        tokenId,
        txid,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        mintAtoms: built.mintAtoms,
        explorer: `https://explorer.e.cash/tx/${txid}`,
        minedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        txid,
        mintAtoms: built.mintAtoms,
        powAttempts: built.powAttempts,
        explorer: `https://explorer.e.cash/tx/${txid}`,
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
