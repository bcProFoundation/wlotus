#!/usr/bin/env tsx
/**
 * Mine one remint against a dryrun MooreTip deployment.
 *
 * Reads deployments/mainnet-dryrun-{TIER}.json (default: active / prayer).
 *   TIER=prayer BATON_INDEX=0 npm run mine-dryrun-once
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import { fromHex, payment, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { createPowRemintMooreTipContract } from '../src/covenant/powRemintMooreTipScript.js';
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import { computeMooreTipState } from '../src/covenant/mooreTip.js';
import {
  buildMinedMooreTipRemintTx,
  mooreTipMinerBanner,
} from '../src/miner/remintMooreTip.js';
import {
  buildMinedMooreTipTempleRemintTx,
  mooreTipTempleMinerBanner,
} from '../src/miner/remintMooreTipTemple.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const REMINT_FUEL_SATS = 4_000n;

interface BatonTip {
  index: number;
  tipLocktime: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface DryrunDep {
  tier?: string;
  covenant?: string;
  tokenId: string;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
  tipLocktime?: number;
  powAddress?: string;
  mintAtomsPerRemint: string;
  templeScriptHashHex?: string | null;
  /** @deprecated Prefer templeScriptHashHex (P2SH temple). */
  templePkhHex?: string | null;
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
    if (any) return;
    throw new Error(
      `Need a pure XEC UTXO ≥ ${REMINT_FUEL_SATS} sats for remint fees`,
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

function loadDep(): { path: string; dep: DryrunDep } {
  const tier = process.env.TIER?.trim().toLowerCase();
  const candidates = [
    // Live prod (WLOTUS) then dryrun
    tier === 'wlotus' ? 'deployments/mainnet-wlotus.json' : '',
    tier ? `deployments/mainnet-dryrun-${tier}.json` : '',
    'deployments/mainnet-wlotus.json',
    'deployments/mainnet-dryrun-active.json',
    'deployments/mainnet-dryrun-wlotus.json',
    'deployments/mainnet-dryrun-prayer.json',
  ].filter(Boolean);
  for (const rel of candidates) {
    const path = resolve(process.cwd(), rel);
    if (existsSync(path)) {
      return { path, dep: JSON.parse(readFileSync(path, 'utf8')) as DryrunDep };
    }
  }
  throw new Error(
    'Missing deployment — run create-wlotus-token (TICKER=dWLOTUS|WLOTUS) or TIER=prayer create-dryrun-token',
  );
}

async function main(): Promise<void> {
  const { path: depPath, dep } = loadDep();
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const tokenId = process.env.TOKEN_ID?.trim() || dep.tokenId;
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  const batonIndex = Number(process.env.BATON_INDEX?.trim() || 0);
  const isTemple =
    dep.tier === 'wlotus' ||
    dep.covenant === 'WlotusPowRemintMooreTipTemple';
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

  const templeHashHex = dep.templeScriptHashHex ?? dep.templePkhHex;
  if (isTemple && (!templeHashHex || templeHashHex.length !== 40)) {
    throw new Error(
      'WLotus dryrun missing templeScriptHashHex (20-byte hex)',
    );
  }

  const contract = isTemple
    ? await createPowRemintMooreTipTempleContract({
        tokenId,
        mintAtoms,
        templeScriptHash: fromHex(templeHashHex!),
        genesisUnix: dep.genesisUnix,
        baseZeroBits: dep.baseZeroBits,
        secondsPerExtraBit: dep.secondsPerExtraBit,
        tipLocktime: tipRec.tipLocktime,
      })
    : await createPowRemintMooreTipContract({
        tokenId,
        mintAtoms,
        genesisUnix: dep.genesisUnix,
        baseZeroBits: dep.baseZeroBits,
        secondsPerExtraBit: dep.secondsPerExtraBit,
        tipLocktime: tipRec.tipLocktime,
      });
  console.log(
    isTemple
      ? mooreTipTempleMinerBanner(
          contract as Awaited<
            ReturnType<typeof createPowRemintMooreTipTempleContract>
          >,
        )
      : mooreTipMinerBanner(
          contract as Awaited<
            ReturnType<typeof createPowRemintMooreTipContract>
          >,
        ),
  );
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

  const preferred = tipRec.lastRemintTxid
    ? batonUtxos.find(u => u.outpoint.txid === tipRec.lastRemintTxid)
    : undefined;
  const b = preferred ?? batonUtxos[0]!;
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
    throw new Error('No fuel UTXO');
  }

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  // Prefer MTP-1 so tipLocktime advances each remint (anti-rewind demo).
  const locktime = Number(
    process.env.MOORE_TIP_LOCKTIME?.trim() || Math.max(tipRec.tipLocktime, mtp - 1),
  );
  if (locktime < tipRec.tipLocktime) {
    throw new Error(
      `locktime ${locktime} < tipLocktime ${tipRec.tipLocktime} (rewind)`,
    );
  }
  if (locktime >= mtp) {
    throw new Error(
      `locktime ${locktime} ≥ MTP ${mtp} (tip ${tipHeight} @ ${tipUnix})`,
    );
  }

  const preview = computeMooreTipState(locktime, contract.params);
  console.log(
    JSON.stringify(
      {
        tokenId,
        tier: dep.tier,
        batonIndex,
        powAddress: contract.address,
        baton: `${baton.txid}:${baton.vout}`,
        locktime,
        mtp,
        tipLocktime: tipRec.tipLocktime,
        bits: preview.bits,
        extraBits: preview.extraBits,
        expectedHashes: Math.pow(2, preview.bits),
      },
      null,
      2,
    ),
  );

  const built = isTemple
    ? await buildMinedMooreTipTempleRemintTx({
        contract: contract as Awaited<
          ReturnType<typeof createPowRemintMooreTipTempleContract>
        >,
        baton,
        fuel: {
          outpoint: fuelUtxo.outpoint,
          sats: fuelUtxo.sats,
          outputScript: wallet.script,
        },
        miner: { sk: wallet.sk, pk: wallet.pk },
        locktime,
      })
    : await buildMinedMooreTipRemintTx({
        contract: contract as Awaited<
          ReturnType<typeof createPowRemintMooreTipContract>
        >,
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
    codeHashHex: toHex(built.nextContract.codeHash),
    batonTips: nextTips,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(depPath, `${JSON.stringify(updated, null, 2)}\n`);
  if (existsSync(resolve(process.cwd(), 'deployments/mainnet-dryrun-active.json'))) {
    writeFileSync(
      resolve(process.cwd(), 'deployments/mainnet-dryrun-active.json'),
      `${JSON.stringify(updated, null, 2)}\n`,
    );
  }

  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-dryrun-remint.json'),
    `${JSON.stringify(
      {
        tokenId,
        txid,
        batonIndex: tipRec.index,
        powAttempts: built.powAttempts,
        bits: built.tip.bits,
        extraBits: built.tip.extraBits,
        tip: built.tip,
        nextPowAddress: built.nextContract.address,
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
        bits: built.tip.bits,
        powAttempts: built.powAttempts,
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
