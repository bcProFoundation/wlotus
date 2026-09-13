#!/usr/bin/env tsx
/**
 * Mine one two-shard (C+M) remint against deployments/mainnet-twoshard-shard.json.
 *
 *   npm run mine-twoshard-once
 *
 * Env: TWOSHARD_LOCKTIME (default max(genesisUnix, MTP-60)).
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { createTwoShardPair } from '../src/covenant/twoShardScript.js';
import { deriveTwoShardState } from '../src/covenant/twoShardMath.js';
import {
  buildMinedTwoShardRemintTx,
  twoShardMinerBanner,
} from '../src/miner/remintTwoShard.js';

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
  const depPath = resolve(
    process.cwd(),
    'deployments/mainnet-twoshard-shard.json',
  );
  if (!existsSync(depPath)) {
    throw new Error('Missing deployments/mainnet-twoshard-shard.json');
  }
  const dep = JSON.parse(readFileSync(depPath, 'utf8'));
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const pair = await createTwoShardPair({
    tokenId: dep.tokenId,
    mintAtoms: BigInt(dep.mintAtomsPerRemint),
    genesisUnix: dep.genesisUnix,
    daySeconds: dep.daySeconds,
    genesisTarget: dep.genesisTarget,
    tipDay: dep.tipDay,
    tipTarget: dep.tipTarget,
  });
  console.log(twoShardMinerBanner(pair));
  if (dep.powAddressC && dep.powAddressC !== pair.c.address) {
    throw new Error(
      `C address mismatch: dep=${dep.powAddressC} computed=${pair.c.address}`,
    );
  }
  if (dep.powAddressM && dep.powAddressM !== pair.m.address) {
    throw new Error(
      `M address mismatch: dep=${dep.powAddressM} computed=${pair.m.address}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureSmallFuel(wallet);

  async function findBaton(shard: 'C' | 'M'): Promise<{
    outpoint: { txid: string; outIdx: number };
    sats: bigint;
    txid: string;
    vout: number;
  }> {
    const target = shard === 'C' ? pair.c : pair.m;
    const scriptUtxos = await chronik
      .script('p2sh', toHex(target.scriptHash))
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
    ).filter(
      u => u.token?.tokenId === dep.tokenId && u.token?.isMintBaton,
    );
    if (batons.length === 0) {
      throw new Error(`No PoW batons at ${shard} ${target.address}`);
    }
    const b = batons[0]!;
    return {
      outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
      sats: BigInt(b.sats),
      txid: b.outpoint.txid,
      vout: b.outpoint.outIdx,
    };
  }

  const batonC = await findBaton('C');
  const batonM = await findBaton('M');
  console.log(
    JSON.stringify(
      {
        batonC: `${batonC.txid}:${batonC.vout} (${batonC.sats} sats)`,
        batonM: `${batonM.txid}:${batonM.vout} (${batonM.sats} sats)`,
      },
      null,
      2,
    ),
  );

  await wallet.sync();
  const fuelUtxo = wallet.utxos
    .filter(u => !u.token && u.sats >= REMINT_FUEL_SATS)
    .sort((a, c) => (a.sats < c.sats ? -1 : 1))[0];
  if (!fuelUtxo) throw new Error('Need remint fuel UTXO');

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  void tipHeight;
  void tipUnix;
  const locktime = Number(
    process.env.TWOSHARD_LOCKTIME?.trim() ||
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
      {
        tokenId: dep.tokenId,
        powAddressC: pair.c.address,
        powAddressM: pair.m.address,
        locktime,
        mtp,
        ...preview,
      },
      null,
      2,
    ),
  );

  const built = await buildMinedTwoShardRemintTx({
    pair,
    batonC,
    batonM,
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
        derived: built.derived,
        txSize: built.txHex.length / 2,
        nextPowAddressC: built.nextPair.c.address,
        nextPowAddressM: built.nextPair.m.address,
      },
      null,
      2,
    ),
  );

  const broadcast = await chronik.broadcastTx(built.txHex);
  console.log('\nTwoShard remint OK', broadcast.txid);

  const updated = {
    ...dep,
    tipDay: built.derived.newDay,
    tipTarget: built.derived.newTarget,
    powAddressC: built.nextPair.c.address,
    powAddressM: built.nextPair.m.address,
    redeemScriptHexC: built.nextPair.c.redeemHex,
    redeemScriptHexM: built.nextPair.m.redeemHex,
    lastRemintTxid: broadcast.txid,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(depPath, `${JSON.stringify(updated, null, 2)}\n`);
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-twoshard-remint.json'),
    `${JSON.stringify(
      {
        tokenId: dep.tokenId,
        txid: broadcast.txid,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        derived: built.derived,
        locktime: built.locktime,
        nextPowAddressC: built.nextPair.c.address,
        nextPowAddressM: built.nextPair.m.address,
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
