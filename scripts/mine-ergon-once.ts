#!/usr/bin/env tsx
/**
 * Mine one Ergon daily-δ PoW remint (compact target + WLDF v2).
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, payment, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { createPowRemintErgonContract } from '../src/covenant/powRemintErgonScript.js';
import { computeErgonState } from '../src/covenant/ergon.js';
import {
  buildMinedErgonRemintTx,
  ergonMinerBanner,
} from '../src/miner/remintErgon.js';
import { BASE_MINT_ATOMS } from '../src/params/consensus.js';
import {
  ERGON_DAY_SECONDS_DEFAULT,
  ERGON_GENESIS_TARGET,
} from '../src/covenant/ergon.js';

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
  const resp = await wallet
    .action({
      outputs: [{ sats: REMINT_FUEL_SATS, script: wallet.script }],
    })
    .build()
    .broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Fuel split failed: ${JSON.stringify(resp)}`);
  }
  console.log('Fuel split tx', resp.broadcasted[0]);
  await wallet.sync();
}

async function main(): Promise<void> {
  const depPath = resolve(process.cwd(), 'deployments/mainnet-ergon-mwlpow.json');
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-ergon-mwlpow.json');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8'));
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const tokenId = process.env.TOKEN_ID?.trim() || dep.tokenId;
  const genesisUnix = Number(process.env.ERGON_GENESIS_UNIX?.trim() || dep.genesisUnix);
  const daySeconds = Number(
    process.env.ERGON_DAY_SECONDS?.trim() || dep.daySeconds || ERGON_DAY_SECONDS_DEFAULT,
  );
  const genesisTarget = Number(
    process.env.ERGON_GENESIS_TARGET?.trim() ||
      dep.genesisTarget ||
      ERGON_GENESIS_TARGET,
  );

  const contract = await createPowRemintErgonContract({
    tokenId,
    mintAtoms: dep.mintAtomsPerRemint
      ? BigInt(dep.mintAtomsPerRemint)
      : BASE_MINT_ATOMS,
    genesisUnix,
    daySeconds,
    genesisTarget,
  });
  console.log(ergonMinerBanner(contract));
  if (dep.powAddress && dep.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: dep=${dep.powAddress} computed=${contract.address}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureSmallFuel(wallet);

  const scriptUtxos = await chronik
    .script('p2sh', toHex(contract.scriptHash))
    .utxos();
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
    .sort((a, c) => (a.sats < c.sats ? -1 : 1))[0];
  if (!fuelUtxo) throw new Error('Need remint fuel UTXO');

  const { mtp } = await getMedianTimePast(chronik);
  const locktime = Number(
    process.env.ERGON_LOCKTIME?.trim() || Math.max(genesisUnix, mtp - 60),
  );
  if (locktime > mtp) {
    throw new Error(`locktime ${locktime} > MTP ${mtp}`);
  }
  const preview = computeErgonState(locktime, contract.params);
  console.log(
    JSON.stringify(
      {
        tokenId,
        powAddress: contract.address,
        baton: `${baton.txid}:${baton.vout}`,
        locktime,
        days: preview.days,
        target: preview.target,
        genesisTarget,
      },
      null,
      2,
    ),
  );

  const built = await buildMinedErgonRemintTx({
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
        ergon: built.ergon,
        txSize: built.txHex.length / 2,
      },
      null,
      2,
    ),
  );

  const broadcast = await chronik.broadcastTx(built.txHex);
  console.log('\nErgon remint OK', broadcast.txid);
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-ergon-remint.json'),
    `${JSON.stringify(
      {
        tokenId,
        txid: broadcast.txid,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        ergon: built.ergon,
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
