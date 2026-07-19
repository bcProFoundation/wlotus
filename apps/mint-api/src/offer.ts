/**
 * Dual-mint Prayer offer: device PoW → server fees/sign/broadcast → burn 1.
 *
 *   POST /api/challenge  { installId }     → mining challenge (preimage, bits)
 *   POST /api/submit     { installId, challengeId, nonceHex, note? }
 *                        → remint + burn (server never mines)
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { toHex } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../../../src/network/createChronik.js';
import { getMedianTimePast } from '../../../src/network/medianTimePast.js';
import { createPowRemintMooreTipContract } from '../../../src/covenant/powRemintMooreTipScript.js';
import {
  buildMooreTipRemintChallenge,
  buildMooreTipRemintTxWithNonce,
  MOORE_TIP_NONCE_LENGTH,
  MOORE_TIP_POW_COMMIT,
  parseNonceHex,
  type MooreTipRemintPrepared,
} from '../../../src/miner/remintMooreTip.js';
import { burnOnePrayer } from '../../../src/offering/burnPrayer.js';
import {
  loadMintWallet,
  mintWalletSummary,
} from '../../../src/mint/loadMintWallet.js';

const REMINT_FUEL_SATS = 4_000n;
/** Test dryrun default 20; override with MINT_MAX_OFFERS_PER_DAY. */
const MAX_OFFERS_PER_DAY = Math.max(
  1,
  Number(process.env.MINT_MAX_OFFERS_PER_DAY?.trim() || 20) || 20,
);
const CHALLENGE_TTL_MS = 15 * 60_000;

export interface OfferResult {
  remintTxid: string;
  burnTxid: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  powMs: number;
  hashrateHps: number;
  deskAtomsKept: 1;
  explorerRemint: string;
  explorerBurn: string;
}

export interface ChallengePublic {
  ok: true;
  challengeId: string;
  expiresAt: string;
  tokenId: string;
  bits: number;
  commit: typeof MOORE_TIP_POW_COMMIT;
  nonceLength: number;
  preimageHex: string;
  powPrefixHex: string;
  locktime: number;
  tipLocktime: number;
  mintAtoms: string;
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

interface StoredChallenge {
  id: string;
  installId: string;
  createdAt: number;
  expiresAt: number;
  status: 'open' | 'done' | 'expired';
  tokenId: string;
  tipIndex: number;
  tipLocktime: number;
  baton: {
    txid: string;
    outIdx: number;
    sats: string;
  };
  fuel: {
    txid: string;
    outIdx: number;
    sats: string;
  };
  locktime: number;
  bits: number;
  preimageHex: string;
  powPrefixHex: string;
  mintAtoms: string;
  /** Serializable snapshot to rebuild prepared (without sk). */
  minerPkHex: string;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
}

/** installId → unix-day → count */
const offerCounts = new Map<string, Map<number, number>>();
const challenges = new Map<string, StoredChallenge>();
/** Reserved fuel outpoints while a challenge is open. */
const reservedFuel = new Set<string>();
let chainLock: Promise<void> = Promise.resolve();

function utcDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

function fuelKey(txid: string, outIdx: number): string {
  return `${txid}:${outIdx}`;
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
    throw new Error(
      `Daily limit reached (${MAX_OFFERS_PER_DAY} Prayer offerings per device).`,
    );
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

function expireStaleChallenges(now = Date.now()): void {
  for (const ch of challenges.values()) {
    if (ch.status === 'open' && ch.expiresAt <= now) {
      ch.status = 'expired';
      reservedFuel.delete(fuelKey(ch.fuel.txid, ch.fuel.outIdx));
    }
  }
}

function cancelOpenChallengesForInstall(installId: string): void {
  for (const ch of challenges.values()) {
    if (ch.installId === installId && ch.status === 'open') {
      ch.status = 'expired';
      reservedFuel.delete(fuelKey(ch.fuel.txid, ch.fuel.outIdx));
    }
  }
}

/** Only one open baton challenge at a time (single-tip contention). */
function hasOpenBatonChallenge(): boolean {
  expireStaleChallenges();
  for (const ch of challenges.values()) {
    if (ch.status === 'open') return true;
  }
  return false;
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

async function createChallengeOnce(opts: {
  installId: string;
}): Promise<ChallengePublic> {
  expireStaleChallenges();
  if (remainingOffersToday(opts.installId) <= 0) {
    throw new Error(
      `Daily limit reached (${MAX_OFFERS_PER_DAY} Prayer offerings per device).`,
    );
  }
  if (hasOpenBatonChallenge()) {
    throw new Error(
      'Another Prayer mint is in progress. Try again in a few minutes.',
    );
  }

  cancelOpenChallengesForInstall(opts.installId);

  const { dep } = loadDep();
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  if (mintAtoms < 2n) {
    throw new Error(
      `Deployment mintAtoms=${mintAtoms}; dual-mint Prayer requires 2.`,
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
    .filter(
      u =>
        !u.token &&
        u.sats >= REMINT_FUEL_SATS &&
        !reservedFuel.has(fuelKey(u.outpoint.txid, u.outpoint.outIdx)),
    )
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

  const prepared = await buildMooreTipRemintChallenge({
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

  const now = Date.now();
  const id = randomUUID();
  const stored: StoredChallenge = {
    id,
    installId: opts.installId,
    createdAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    status: 'open',
    tokenId: dep.tokenId,
    tipIndex: tipRec.index,
    tipLocktime: tipRec.tipLocktime,
    baton: {
      txid: baton.outpoint.txid,
      outIdx: baton.outpoint.outIdx,
      sats: baton.sats.toString(),
    },
    fuel: {
      txid: fuelUtxo.outpoint.txid,
      outIdx: fuelUtxo.outpoint.outIdx,
      sats: fuelUtxo.sats.toString(),
    },
    locktime,
    bits: prepared.tip.bits,
    preimageHex: prepared.preimageHex,
    powPrefixHex: prepared.powPrefixHex,
    mintAtoms: prepared.contract.params.mintAtoms.toString(),
    minerPkHex: toHex(mint.pk),
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
  };
  challenges.set(id, stored);
  reservedFuel.add(fuelKey(stored.fuel.txid, stored.fuel.outIdx));

  return {
    ok: true,
    challengeId: id,
    expiresAt: new Date(stored.expiresAt).toISOString(),
    tokenId: dep.tokenId,
    bits: prepared.tip.bits,
    commit: MOORE_TIP_POW_COMMIT,
    nonceLength: MOORE_TIP_NONCE_LENGTH,
    preimageHex: prepared.preimageHex,
    powPrefixHex: prepared.powPrefixHex,
    locktime,
    tipLocktime: tipRec.tipLocktime,
    mintAtoms: stored.mintAtoms,
  };
}

async function rebuildPrepared(
  ch: StoredChallenge,
): Promise<{ prepared: MooreTipRemintPrepared; depPath: string; dep: DryrunDep; tips: BatonTip[]; tipRec: BatonTip }> {
  const { path: depPath, dep } = loadDep();
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
  const tipRec = tips.find(t => t.index === ch.tipIndex) ?? tips[0]!;

  const chronik = await createChronik('closest');
  const mint = await loadMintWallet(chronik);
  if (toHex(mint.pk) !== ch.minerPkHex) {
    throw new Error('Mint wallet changed; challenge is invalid. Request a new one.');
  }

  const contract = await createPowRemintMooreTipContract({
    tokenId: ch.tokenId,
    mintAtoms: BigInt(ch.mintAtoms),
    genesisUnix: ch.genesisUnix,
    baseZeroBits: ch.baseZeroBits,
    secondsPerExtraBit: ch.secondsPerExtraBit,
    tipLocktime: ch.tipLocktime,
  });

  const prepared = await buildMooreTipRemintChallenge({
    contract,
    baton: {
      outpoint: { txid: ch.baton.txid, outIdx: ch.baton.outIdx },
      sats: BigInt(ch.baton.sats),
      txid: ch.baton.txid,
      vout: ch.baton.outIdx,
    },
    fuel: {
      outpoint: { txid: ch.fuel.txid, outIdx: ch.fuel.outIdx },
      sats: BigInt(ch.fuel.sats),
      outputScript: mint.wallet.script,
    },
    miner: { sk: mint.sk, pk: mint.pk },
    locktime: ch.locktime,
  });

  if (prepared.preimageHex !== ch.preimageHex) {
    throw new Error('Challenge preimage no longer matches tip state');
  }

  return { prepared, depPath, dep, tips, tipRec };
}

async function submitChallengeOnce(opts: {
  installId: string;
  challengeId: string;
  nonceHex: string;
  note: string;
  powMs?: number;
  powAttempts?: number;
}): Promise<OfferResult> {
  expireStaleChallenges();
  const ch = challenges.get(opts.challengeId);
  if (!ch) throw new Error('Unknown challenge');
  if (ch.installId !== opts.installId) {
    throw new Error('challengeId does not match installId');
  }
  if (ch.status !== 'open') {
    throw new Error(`Challenge is ${ch.status}`);
  }
  if (ch.expiresAt <= Date.now()) {
    ch.status = 'expired';
    reservedFuel.delete(fuelKey(ch.fuel.txid, ch.fuel.outIdx));
    throw new Error('Challenge expired; request a new one');
  }

  const nonce = parseNonceHex(opts.nonceHex);
  const { prepared, depPath, dep, tips, tipRec } = await rebuildPrepared(ch);

  const built = await buildMooreTipRemintTxWithNonce({ prepared, nonce });

  const chronik = await createChronik('closest');
  const mint = await loadMintWallet(chronik);
  const wallet = mint.wallet;

  const broadcast = await chronik.broadcastTx(built.txHex);
  const remintTxid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;

  consumeOfferSlot(opts.installId);

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

  ch.status = 'done';
  reservedFuel.delete(fuelKey(ch.fuel.txid, ch.fuel.outIdx));

  const powMs =
    opts.powMs != null && opts.powMs > 0 ? Math.round(opts.powMs) : 0;
  const powAttempts =
    opts.powAttempts != null && opts.powAttempts > 0
      ? Math.round(opts.powAttempts)
      : 0;
  const hashrateHps =
    powMs > 0 && powAttempts > 0
      ? Math.round(powAttempts / (powMs / 1000))
      : 0;

  return {
    remintTxid,
    burnTxid,
    tokenId: dep.tokenId,
    bits: built.tip.bits,
    powAttempts,
    powMs,
    hashrateHps,
    deskAtomsKept: 1,
    explorerRemint: `https://explorer.e.cash/tx/${remintTxid}`,
    explorerBurn: `https://explorer.e.cash/tx/${burnTxid}`,
  };
}

function withChainLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chainLock.then(fn);
  chainLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function enqueueChallenge(opts: {
  installId: string;
}): Promise<ChallengePublic> {
  return withChainLock(() => createChallengeOnce(opts));
}

export function enqueueSubmit(opts: {
  installId: string;
  challengeId: string;
  nonceHex: string;
  note: string;
  powMs?: number;
  powAttempts?: number;
}): Promise<OfferResult> {
  return withChainLock(() => submitChallengeOnce(opts));
}

export function publicStatus(): {
  tokenId: string | null;
  mintAtoms: string | null;
  ticker: string;
  maxOffersPerDay: number;
  baseZeroBits: number | null;
  clientPow: true;
} {
  try {
    const { dep } = loadDep();
    return {
      tokenId: dep.tokenId,
      mintAtoms: dep.mintAtomsPerRemint,
      ticker: 'dPRAYER',
      maxOffersPerDay: MAX_OFFERS_PER_DAY,
      baseZeroBits: dep.baseZeroBits,
      clientPow: true,
    };
  } catch {
    return {
      tokenId: null,
      mintAtoms: null,
      ticker: 'dPRAYER',
      maxOffersPerDay: MAX_OFFERS_PER_DAY,
      baseZeroBits: null,
      clientPow: true,
    };
  }
}
