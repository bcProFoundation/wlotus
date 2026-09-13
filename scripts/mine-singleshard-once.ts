#!/usr/bin/env tsx
/**
 * Mine one single-shard δ remint against deployments/mainnet-ulotus.json.
 *
 *   npm run mine-singleshard-once
 *
 * Env: UDELTA_LOCKTIME (default max(genesisUnix, MTP-60)).
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { DEFAULT_DUST_SATS, fromHex, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { createSingleShardDeltaContract } from '../src/covenant/singleShardDeltaScript.js';
import { deriveTwoShardState } from '../src/covenant/twoShardMath.js';
import {
  buildMinedUdeltaRemintTx,
  udeltaMinerBanner,
} from '../src/miner/remintSingleShard.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

// Fuel sizing: the remint has NO change output (raw TxBuilder with fixed
// outputs only), so the ENTIRE fuel UTXO minus dust flows to fees. Tx is
// ~1.6KB (single covenant input); eCash min relay is 1000 sats/KB.
// Target ~2600 (fee ~2050 ≈ 1280 sats/KB — comfortable margin).
const REMINT_FUEL_SATS = 2600n;
/** Use a fuel UTXO as-is at or below this; split bigger ones down. */
const REMINT_FUEL_SPLIT_ABOVE = 3200n;
/** Floor: below this the build can't cover outputs + 1000/KB min relay. */
const REMINT_FUEL_MIN = 2300n;

async function ensureSmallFuel(wallet: Wallet): Promise<void> {
  await wallet.sync();
  const pure = wallet.utxos
    .filter(u => !u.token && u.sats >= REMINT_FUEL_MIN)
    .sort((a, b) => (a.sats < b.sats ? -1 : 1));
  if (pure.length === 0) {
    throw new Error(
      `Need a pure XEC UTXO ≥ ${REMINT_FUEL_MIN} sats for remint fuel`,
    );
  }
  if (pure[0]!.sats <= REMINT_FUEL_SPLIT_ABOVE) return;
  const big = pure[0]!;
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
  const depPath = resolve(process.cwd(), 'deployments/mainnet-ulotus.json');
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-ulotus.json');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8'));
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const shard = createSingleShardDeltaContract({
    tokenId: dep.tokenId,
    mintAtoms: BigInt(dep.mintAtomsPerRemint),
    genesisUnix: dep.genesisUnix,
    daySeconds: dep.daySeconds,
    genesisTarget: dep.genesisTarget,
    tipDay: dep.tipDay,
    tipTarget: dep.tipTarget,
  });
  console.log(udeltaMinerBanner(shard));
  if (dep.powAddress && dep.powAddress !== shard.address) {
    throw new Error(
      `Shard address mismatch: dep=${dep.powAddress} computed=${shard.address}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureSmallFuel(wallet);

  const scriptUtxos = await chronik
    .script('p2sh', toHex(shard.scriptHash))
    .utxos();
  const list = Array.isArray(scriptUtxos)
    ? scriptUtxos
    : ((scriptUtxos as { utxos?: unknown[] }).utxos ?? []);
  const batons = (
    list as {
      token?: { tokenId?: string; isMintBaton?: boolean };
      outpoint: { txid: string; outIdx: number };
      sats: number | bigint;
    }[]
  ).filter(u => u.token?.tokenId === dep.tokenId && u.token?.isMintBaton);
  if (batons.length === 0) {
    throw new Error(`No PoW batons at ${shard.address}`);
  }
  const b = batons[0]!;
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid,
    vout: b.outpoint.outIdx,
  };
  console.log(
    JSON.stringify(
      { baton: `${baton.txid}:${baton.vout} (${baton.sats} sats)` },
      null,
      2,
    ),
  );

  await wallet.sync();
  const fuelUtxo = wallet.utxos
    .filter(u => !u.token && u.sats >= REMINT_FUEL_MIN)
    .sort((a, c) => (a.sats < c.sats ? -1 : 1))[0];
  if (!fuelUtxo) throw new Error('Need remint fuel UTXO');

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  void tipHeight;
  void tipUnix;
  const locktime = Number(
    process.env.UDELTA_LOCKTIME?.trim() ||
      Math.max(dep.genesisUnix, mtp - 60),
  );
  if (locktime > mtp) {
    throw new Error(`locktime ${locktime} > MTP ${mtp}`);
  }
  const preview = deriveTwoShardState(
    {
      genesisUnix: dep.genesisUnix,
      daySeconds: dep.daySeconds,
      genesisTarget: dep.genesisTarget,
    },
    { tipDay: dep.tipDay, target: dep.tipTarget },
    locktime,
  );
  console.log(
    JSON.stringify(
      { tokenId: dep.tokenId, powAddress: shard.address, mtp, ...preview },
      null,
      2,
    ),
  );

  const built = await buildMinedUdeltaRemintTx({
    contract: shard,
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

  const txSize = built.txHex.length / 2;
  // No change output: fee is inputs minus the fixed dust outputs.
  const feeSats = baton.sats + fuelUtxo.sats - DEFAULT_DUST_SATS * 2n;
  console.log(
    JSON.stringify(
      {
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        derived: built.derived,
        txSize,
        feeSats: feeSats.toString(),
        feePerKb: Math.round((Number(feeSats) * 1000) / txSize),
        nextPowAddress: built.nextContract.address,
      },
      null,
      2,
    ),
  );

  const broadcast = await chronik.broadcastTx(built.txHex);
  console.log('\nULOTUS remint OK', broadcast.txid);

  const updated = {
    ...dep,
    tipDay: built.derived.newDay,
    tipTarget: built.derived.newTarget,
    powAddress: built.nextContract.address,
    redeemScriptHex: built.nextContract.redeemHex,
    lastRemintTxid: broadcast.txid,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(depPath, `${JSON.stringify(updated, null, 2)}\n`);
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-ulotus-remint.json'),
    `${JSON.stringify(
      {
        tokenId: dep.tokenId,
        txid: broadcast.txid,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        derived: built.derived,
        locktime: built.locktime,
        nextPowAddress: built.nextContract.address,
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
