#!/usr/bin/env tsx
/**
 * Mine one remint against a test Prayer tip (tPRAYTIP) baton.
 *
 * Fixed 1-byte PoW. Scale = pick BATON_INDEX across N tips.
 * Reads deployments/mainnet-prayer-tip-test.json.
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, payment, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { createPowRemintPrayerTipContract } from '../src/covenant/powRemintPrayerTipScript.js';
import { computePrayerTipState } from '../src/covenant/wlpt.js';
import {
  buildMinedPrayerTipRemintTx,
  prayerTipMinerBanner,
} from '../src/miner/remintPrayerTip.js';
import { PRAYER_MINT_ATOMS } from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

/**
 * Covenant hashOutputs is exactly 3 outs (no change). Excess fuel is fee.
 * Keep fuel UTXOs small (~2k sats).
 */
const REMINT_FUEL_SATS = 2_000n;

interface BatonTip {
  index: number;
  tipLocktime: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface PrayerTipDep {
  tokenId: string;
  genesisUnix: number;
  tipLocktime?: number;
  powAddress?: string;
  mintAtomsPerRemint?: string;
  batonTips?: BatonTip[];
}

async function ensureFuel(wallet: Wallet): Promise<void> {
  await wallet.sync();
  const sized = wallet.utxos.find(
    u =>
      !u.token &&
      u.sats >= REMINT_FUEL_SATS &&
      u.sats <= REMINT_FUEL_SATS + 1_000n,
  );
  if (sized) return;

  const big = wallet.utxos
    .filter(u => !u.token && u.sats > REMINT_FUEL_SATS + 2_000n)
    .sort((a, b) => (a.sats < b.sats ? 1 : -1))[0];
  if (!big) {
    const any = wallet.utxos.find(u => !u.token && u.sats >= REMINT_FUEL_SATS);
    if (any) return; // usable but oversized → excess becomes fee
    throw new Error(
      `Need a pure XEC UTXO ≥ ${REMINT_FUEL_SATS} sats for remint fees (covenant has no change out)`,
    );
  }

  console.log(
    `Splitting fuel: ${big.sats} → ${REMINT_FUEL_SATS} (no covenant change out)`,
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

function loadDep(): { path: string; dep: PrayerTipDep } {
  const path = resolve(
    process.cwd(),
    'deployments/mainnet-prayer-tip-test.json',
  );
  if (!existsSync(path)) {
    throw new Error(
      'Missing deployments/mainnet-prayer-tip-test.json — run create-prayer-tip-pow-token',
    );
  }
  return { path, dep: JSON.parse(readFileSync(path, 'utf8')) as PrayerTipDep };
}

async function main(): Promise<void> {
  const { path: depPath, dep } = loadDep();
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const tokenId = process.env.TOKEN_ID?.trim() || dep.tokenId;
  const mintAtoms = BigInt(dep.mintAtomsPerRemint ?? PRAYER_MINT_ATOMS);
  const batonIndex = Number(process.env.BATON_INDEX?.trim() || 0);
  const tips =
    dep.batonTips && dep.batonTips.length > 0
      ? dep.batonTips
      : [
          {
            index: 0,
            tipLocktime: dep.tipLocktime ?? dep.genesisUnix,
            powAddress: dep.powAddress ?? '',
            lastRemintTxid: null,
          },
        ];
  const tipRec = tips.find(t => t.index === batonIndex) ?? tips[0]!;

  const contract = await createPowRemintPrayerTipContract({
    tokenId,
    mintAtoms,
    genesisUnix: dep.genesisUnix,
    tipLocktime: tipRec.tipLocktime,
  });
  console.log(prayerTipMinerBanner(contract));

  if (tipRec.powAddress && tipRec.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: tip=${tipRec.powAddress} computed=${contract.address}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureFuel(wallet);

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

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  // Prefer tipLocktime when still final; else advance toward MTP−1.
  const locktime = Number(
    process.env.PRAYER_TIP_LOCKTIME?.trim() ||
      (tipRec.tipLocktime < mtp
        ? tipRec.tipLocktime
        : Math.max(tipRec.tipLocktime, mtp - 1)),
  );
  if (locktime >= mtp) {
    throw new Error(
      `locktime ${locktime} ≥ MTP ${mtp} (tip ${tipHeight} @ ${tipUnix}) — non-final (need locktime < MTP)`,
    );
  }
  if (locktime < tipRec.tipLocktime) {
    throw new Error(
      `locktime ${locktime} < tipLocktime ${tipRec.tipLocktime} — rewind blocked`,
    );
  }

  const preview = computePrayerTipState(locktime, contract.params);
  console.log(
    JSON.stringify(
      {
        tokenId,
        batonIndex,
        powAddress: contract.address,
        baton: `${baton.txid}:${baton.vout}`,
        locktime,
        mtp,
        tipLocktime: tipRec.tipLocktime,
        zeroBytes: preview.zeroBytes,
        expectedHashes: Math.pow(2, preview.bits),
      },
      null,
      2,
    ),
  );

  const built = await buildMinedPrayerTipRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: fuelUtxo.outpoint,
      sats: fuelUtxo.sats,
      outputScript: wallet.script,
    },
    miner: { sk: wallet.sk, pk: wallet.pk },
    locktime,
  });

  const broadcast = await chronik.broadcastTx(built.txHex);
  const txid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;

  const nextTips = tips.map(t =>
    t.index === tipRec.index
      ? {
          ...t,
          tipLocktime: built.tip.locktime,
          powAddress: built.nextContract.address,
          lastRemintTxid: txid,
        }
      : t,
  );
  const updated = {
    ...dep,
    tipLocktime: nextTips[0]?.tipLocktime ?? built.tip.locktime,
    powAddress: nextTips[0]?.powAddress ?? built.nextContract.address,
    redeemScriptHex: built.nextContract.redeemHex,
    batonTips: nextTips,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(depPath, `${JSON.stringify(updated, null, 2)}\n`);

  const remintPath = resolve(
    process.cwd(),
    'deployments/mainnet-last-prayer-tip-remint.json',
  );
  writeFileSync(
    remintPath,
    `${JSON.stringify(
      {
        tokenId,
        txid,
        batonIndex: tipRec.index,
        powAttempts: built.powAttempts,
        nonceHex: built.nonceHex,
        mintAtoms: built.mintAtoms,
        tip: built.tip,
        locktime: built.locktime,
        nextPowAddress: built.nextContract.address,
        nextTipLocktime: built.tip.locktime,
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
        batonIndex: tipRec.index,
        nextPowAddress: built.nextContract.address,
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
