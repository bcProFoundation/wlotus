/**
 * Dual-mint Prayer offer: remint 2 → burn 1 (memorial) → keep 1 on desk.
 * Server pays XEC fee and performs MooreTip PoW (phone client PoW later).
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { toHex } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../../../src/network/createChronik.js';
import { getMedianTimePast } from '../../../src/network/medianTimePast.js';
import { createPowRemintMooreTipContract } from '../../../src/covenant/powRemintMooreTipScript.js';
import { buildMinedMooreTipRemintTx } from '../../../src/miner/remintMooreTip.js';
import { burnOnePrayer } from '../../../src/offering/burnPrayer.js';
import {
  loadMintWallet,
  mintWalletSummary,
} from '../../../src/mint/loadMintWallet.js';

const REMINT_FUEL_SATS = 4_000n;
const MAX_OFFERS_PER_DAY = 2;

export interface OfferResult {
  remintTxid: string;
  burnTxid: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  deskAtomsKept: 1;
  explorerRemint: string;
  explorerBurn: string;
}

interface BatonTip {
  index: number;
  tipLocktime: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface DryrunDep {
  tier?: string;
  tokenId: string;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
  tipLocktime?: number;
  powAddress?: string;
  mintAtomsPerRemint: string;
  batonTips?: BatonTip[];
  redeemScriptHex?: string;
  codeHashHex?: string;
}

/** installId → unix-day → count */
const offerCounts = new Map<string, Map<number, number>>();
let chainLock: Promise<void> = Promise.resolve();

function utcDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

export function remainingOffersToday(installId: string): number {
  const day = utcDay();
  const used = offerCounts.get(installId)?.get(day) ?? 0;
  return Math.max(0, MAX_OFFERS_PER_DAY - used);
}

function consumeOfferSlot(installId: string): void {
  const day = utcDay();
  let byDay = offerCounts.get(installId);
  if (!byDay) {
    byDay = new Map();
    offerCounts.set(installId, byDay);
  }
  const used = byDay.get(day) ?? 0;
  if (used >= MAX_OFFERS_PER_DAY) {
    throw new Error('Daily limit reached (2 Prayer offerings per device).');
  }
  byDay.set(day, used + 1);
}

function loadDep(): { path: string; dep: DryrunDep } {
  const candidates = [
    'deployments/mainnet-dryrun-prayer.json',
    'deployments/mainnet-dryrun-active.json',
  ];
  for (const rel of candidates) {
    const path = resolve(process.cwd(), rel);
    if (existsSync(path)) {
      return { path, dep: JSON.parse(readFileSync(path, 'utf8')) as DryrunDep };
    }
  }
  throw new Error('Missing Prayer dryrun deployment');
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
    throw new Error(`Need XEC ≥ ${Number(REMINT_FUEL_SATS) / 100} for remint fee`);
  }

  const { payment } = await import('ecash-lib');
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: wallet.script }],
  };
  const resp = await wallet.action(action).build().broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Fuel split failed: ${JSON.stringify(resp)}`);
  }
  await wallet.sync();
}

async function offerOnce(opts: {
  installId: string;
  note: string;
}): Promise<OfferResult> {
  consumeOfferSlot(opts.installId);

  const { path: depPath, dep } = loadDep();
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  if (mintAtoms < 2n) {
    throw new Error(
      `Deployment mintAtoms=${mintAtoms}; dual-mint Prayer requires 2. Create a new dryrun token.`,
    );
  }

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
  const tipRec = tips[0]!;

  const contract = await createPowRemintMooreTipContract({
    tokenId: dep.tokenId,
    mintAtoms,
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    tipLocktime: tipRec.tipLocktime,
  });

  const chronik = await createChronik('closest');
  const mint = await loadMintWallet(chronik);
  console.log('mint wallet', JSON.stringify(mintWalletSummary(mint)));
  const wallet = mint.wallet;
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
  ).filter(u => u.token?.tokenId === dep.tokenId && u.token?.isMintBaton);
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
  if (!fuelUtxo) throw new Error('No fuel UTXO');

  const { mtp } = await getMedianTimePast(chronik);
  const locktime = Math.max(tipRec.tipLocktime, mtp - 1);
  if (locktime < tipRec.tipLocktime) {
    throw new Error(`locktime ${locktime} < tipLocktime ${tipRec.tipLocktime}`);
  }
  if (locktime >= mtp) {
    throw new Error(`locktime ${locktime} ≥ MTP ${mtp}`);
  }

  const built = await buildMinedMooreTipRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: fuelUtxo.outpoint,
      sats: fuelUtxo.sats,
      outputScript: wallet.script,
    },
    miner: { sk: mint.sk, pk: mint.pk },
    locktime,
  });

  const broadcast = await chronik.broadcastTx(built.txHex);
  const remintTxid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;

  const nextTips = tips.map(t =>
    t.index === tipRec.index
      ? {
          ...t,
          tipLocktime: built.tip.locktime,
          powAddress: built.nextContract.address,
          lastRemintTxid: remintTxid,
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
  const active = resolve(process.cwd(), 'deployments/mainnet-dryrun-active.json');
  if (existsSync(active)) {
    writeFileSync(active, `${JSON.stringify(updated, null, 2)}\n`);
  }

  // Wait briefly for indexer, then burn 1 (desk keeps the other).
  for (let i = 0; i < 8; i++) {
    await wallet.sync();
    const atoms = wallet.utxos
      .filter(u => u.token?.tokenId === dep.tokenId && !u.token.isMintBaton)
      .reduce((s, u) => s + (u.token?.atoms ?? 0n), 0n);
    if (atoms >= 1n) break;
    await new Promise(r => setTimeout(r, 800));
  }

  const { txid: burnTxid } = await burnOnePrayer({
    wallet,
    tokenId: dep.tokenId,
    note: opts.note,
  });

  return {
    remintTxid,
    burnTxid,
    tokenId: dep.tokenId,
    bits: built.tip.bits,
    powAttempts: built.powAttempts,
    deskAtomsKept: 1,
    explorerRemint: `https://explorer.e.cash/tx/${remintTxid}`,
    explorerBurn: `https://explorer.e.cash/tx/${burnTxid}`,
  };
}

/** Serialize chain offers (single baton contention). */
export function enqueueOffer(opts: {
  installId: string;
  note: string;
}): Promise<OfferResult> {
  const run = chainLock.then(() => offerOnce(opts));
  chainLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function publicStatus(): {
  tokenId: string | null;
  mintAtoms: string | null;
  ticker: string;
  maxOffersPerDay: number;
  /** Covenant base difficulty (Moore tip may add bits later). */
  baseZeroBits: number | null;
} {
  try {
    const { dep } = loadDep();
    return {
      tokenId: dep.tokenId,
      mintAtoms: dep.mintAtomsPerRemint,
      ticker: 'dPRAYER',
      maxOffersPerDay: MAX_OFFERS_PER_DAY,
      baseZeroBits: dep.baseZeroBits,
    };
  } catch {
    return {
      tokenId: null,
      mintAtoms: null,
      ticker: 'dPRAYER',
      maxOffersPerDay: MAX_OFFERS_PER_DAY,
      baseZeroBits: null,
    };
  }
}
