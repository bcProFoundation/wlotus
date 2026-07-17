#!/usr/bin/env tsx
/**
 * Mine one Moore-bit PoW remint against mWLPOW batons.
 *
 * Reads deployments/mainnet-moore-mwlpow.json (or TOKEN_ID + params).
 * Sets nLockTime + sequence so locktime-derived bits apply.
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, payment, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { createPowRemintMooreContract } from '../src/covenant/powRemintMooreScript.js';
import { computeMooreBits } from '../src/covenant/wldf.js';
import {
  buildMinedMooreRemintTx,
  mooreMinerBanner,
} from '../src/miner/remintMoore.js';
import { BASE_MINT_ATOMS, POW_BASE_ZERO_BITS } from '../src/params/consensus.js';
import { TEST_MOORE_SECONDS_PER_EXTRA_BIT } from '../src/covenant/wldf.js';

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

  console.log(
    `Splitting fuel: ${big.sats} → ${REMINT_FUEL_SATS} + change at ${wallet.address}`,
  );
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

interface MooreDep {
  tokenId: string;
  powAddress?: string;
  genesisUnix: number;
  baseZeroBits?: number;
  secondsPerExtraBit?: number;
  mintAtomsPerRemint?: string;
}

function loadDep(): MooreDep {
  const moorePath = resolve(process.cwd(), 'deployments/mainnet-moore-mwlpow.json');
  const fallback = resolve(process.cwd(), 'deployments/mainnet-pow-token.json');
  const path = existsSync(moorePath) ? moorePath : fallback;
  if (!existsSync(path)) {
    throw new Error(
      'Missing deployments/mainnet-moore-mwlpow.json — run npm run create-moore-pow-token',
    );
  }
  const dep = JSON.parse(readFileSync(path, 'utf8')) as MooreDep;
  if (dep.genesisUnix === undefined) {
    throw new Error(`${path} missing genesisUnix (not a Moore deployment)`);
  }
  return dep;
}

async function main(): Promise<void> {
  const dep = loadDep();
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const tokenId = process.env.TOKEN_ID?.trim() || dep.tokenId;
  const genesisUnix = Number(
    process.env.MOORE_GENESIS_UNIX?.trim() || dep.genesisUnix,
  );
  const baseZeroBits = Number(
    process.env.MOORE_BASE_ZERO_BITS?.trim() ||
      dep.baseZeroBits ||
      POW_BASE_ZERO_BITS,
  );
  const secondsPerExtraBit = Number(
    process.env.MOORE_SECONDS_PER_EXTRA_BIT?.trim() ||
      dep.secondsPerExtraBit ||
      TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  );
  const mintAtoms = dep.mintAtomsPerRemint
    ? BigInt(dep.mintAtomsPerRemint)
    : BASE_MINT_ATOMS;

  const contract = await createPowRemintMooreContract({
    tokenId,
    mintAtoms,
    genesisUnix,
    baseZeroBits,
    secondsPerExtraBit,
  });
  console.log(mooreMinerBanner(contract));

  if (dep.powAddress && dep.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: dep=${dep.powAddress} computed=${contract.address}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureSmallFuel(wallet);

  const scriptHex = toHex(contract.scriptHash);
  const scriptUtxos = await chronik.script('p2sh', scriptHex).utxos();
  const list = Array.isArray(scriptUtxos)
    ? scriptUtxos
    : (scriptUtxos.utxos ?? []);
  const batonUtxos = list.filter(
    (u: { token?: { tokenId?: string; isMintBaton?: boolean } }) =>
      u.token?.tokenId === tokenId && u.token?.isMintBaton,
  );
  if (batonUtxos.length === 0) {
    throw new Error(`No PoW batons at ${contract.address}`);
  }

  const b = batonUtxos[0];
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid as string,
    vout: b.outpoint.outIdx as number,
  };

  const fuelUtxo = wallet.utxos
    .filter(u => !u.token && u.sats >= REMINT_FUEL_SATS)
    .sort((a, b) => (a.sats < b.sats ? -1 : 1))[0];
  if (!fuelUtxo) {
    throw new Error(`Need a ≥${REMINT_FUEL_SATS} pure XEC UTXO for fees`);
  }

  // Slightly behind wall clock so nLockTime ≤ MTP / tip time.
  const locktime = Number(
    process.env.MOORE_LOCKTIME?.trim() ||
      Math.max(genesisUnix, Math.floor(Date.now() / 1000) - 60),
  );
  const preview = computeMooreBits(locktime, contract.params);

  console.log(
    JSON.stringify(
      {
        tokenId,
        powAddress: contract.address,
        baton: `${baton.txid}:${baton.vout}`,
        fuelSats: fuelUtxo.sats.toString(),
        locktime,
        bits: preview.bits,
        extraBits: preview.extraBits,
        expectedHashes: Math.pow(2, preview.bits),
      },
      null,
      2,
    ),
  );

  const built = await buildMinedMooreRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: {
        txid: fuelUtxo.outpoint.txid,
        outIdx: fuelUtxo.outpoint.outIdx,
      },
      sats: fuelUtxo.sats,
      outputScript: wallet.script,
    },
    miner: { sk: fromHex(skHex), pk: wallet.pk },
    locktime,
  });

  console.log(
    JSON.stringify(
      {
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        mintAtoms: built.mintAtoms,
        moore: built.moore,
        txSize: built.txHex.length / 2,
      },
      null,
      2,
    ),
  );

  const broadcast = await chronik.broadcastTx(built.txHex);
  console.log('\nMoore remint OK', broadcast.txid);
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-moore-remint.json'),
    `${JSON.stringify(
      {
        tokenId,
        txid: broadcast.txid,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        mintAtoms: built.mintAtoms,
        moore: built.moore,
        locktime: built.locktime,
        minedAt: new Date().toISOString(),
        explorer: `https://explorer.e.cash/tx/${broadcast.txid}`,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
