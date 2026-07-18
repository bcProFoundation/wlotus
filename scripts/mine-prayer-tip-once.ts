#!/usr/bin/env tsx
/**
 * Mine one remint against a test Prayer tip (tPRAYTIP) baton.
 *
 * Reads deployments/mainnet-prayer-tip-test.json.
 * Default locktime = MTP (may cool or stay). Set PRAYER_TIP_RAPID=1 to use
 * tipLocktime (gap=0) so activity bumps — proves concurrent-pray difficulty.
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

const REMINT_FUEL_SATS = 3_000n;

interface BatonTip {
  index: number;
  tipLocktime: number;
  tipActivity: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface PrayerTipDep {
  tokenId: string;
  genesisUnix: number;
  baseZeroBits: number;
  minGapSeconds: number;
  coolGapSeconds: number;
  tipLocktime?: number;
  tipActivity?: number;
  powAddress?: string;
  mintAtomsPerRemint?: string;
  batonTips?: BatonTip[];
}

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
            tipActivity: dep.tipActivity ?? 0,
            powAddress: dep.powAddress ?? '',
            lastRemintTxid: null,
          },
        ];
  const tipRec = tips.find(t => t.index === batonIndex) ?? tips[0]!;

  const contract = await createPowRemintPrayerTipContract({
    tokenId,
    mintAtoms,
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    minGapSeconds: dep.minGapSeconds,
    coolGapSeconds: dep.coolGapSeconds,
    tipLocktime: tipRec.tipLocktime,
    tipActivity: tipRec.tipActivity,
  });
  console.log(prayerTipMinerBanner(contract));

  if (tipRec.powAddress && tipRec.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: tip=${tipRec.powAddress} computed=${contract.address}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await ensureSmallFuel(wallet);

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
  const rapid = process.env.PRAYER_TIP_RAPID?.trim() === '1';
  const locktime = Number(
    process.env.PRAYER_TIP_LOCKTIME?.trim() ||
      (rapid
        ? tipRec.tipLocktime
        : Math.max(tipRec.tipLocktime, Math.min(mtp, tipRec.tipLocktime + dep.minGapSeconds))),
  );
  if (locktime > mtp) {
    throw new Error(
      `locktime ${locktime} > MTP ${mtp} (tip ${tipHeight} @ ${tipUnix}) — non-final`,
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
        rapid,
        gap: preview.gap,
        tipActivity: tipRec.tipActivity,
        activityPrime: preview.activityPrime,
        bits: preview.bits,
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

  // Persist next tip for this baton (address moves with tip').
  const nextTips = tips.map(t =>
    t.index === tipRec.index
      ? {
          ...t,
          tipLocktime: built.tip.locktime,
          tipActivity: built.tip.activityPrime,
          powAddress: built.nextContract.address,
          lastRemintTxid: txid,
        }
      : t,
  );
  const updated = {
    ...dep,
    tipLocktime: nextTips[0]?.tipLocktime ?? built.tip.locktime,
    tipActivity: nextTips[0]?.tipActivity ?? built.tip.activityPrime,
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
        nextTipActivity: built.tip.activityPrime,
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
        bits: built.tip.bits,
        activityPrime: built.tip.activityPrime,
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
