/**
 * Prayer offer: device PoW → server fees/sign/broadcast (mint 1 + on-chain memorial).
 * No separate burn tx — the mint OP_RETURN carries WLBR.
 *
 *   POST /api/challenge  { installId, note? }
 *   POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { toHex } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../../../src/network/createChronik.js';
import { getMedianTimePast } from '../../../src/network/medianTimePast.js';
import { createPowRemintMooreTipMemoContract } from '../../../src/covenant/powRemintMooreTipMemoScript.js';
import {
  buildMooreTipMemoRemintChallenge,
  buildMooreTipMemoRemintTxWithNonce,
  MOORE_TIP_MEMO_NONCE_LENGTH,
  MOORE_TIP_MEMO_POW_COMMIT,
  parseNonceHex,
  type MooreTipMemoRemintPrepared,
} from '../../../src/miner/remintMooreTipMemo.js';
import { memorialPushdata } from '../../../src/offering/burnPrayer.js';
import {
  loadMintWallet,
  mintWalletSummary,
} from '../../../src/mint/loadMintWallet.js';

const REMINT_FUEL_SATS = 4_000n;
const MAX_OFFERS_PER_DAY = Math.max(
  1,
  Number(process.env.MINT_MAX_OFFERS_PER_DAY?.trim() || 20) || 20,
);
/** Cap concurrent open challenges (server CPU for building preimages). */
const MAX_OPEN_CHALLENGES = Math.max(
  1,
  Number(process.env.MINT_MAX_OPEN_CHALLENGES?.trim() || 32) || 32,
);
/**
 * How many baton tips the desk serves (PoC default 2 — matches live dPRAYER).
 * Launch tokens still genesis at POW_BATON_COUNT=28; raise this later.
 */
const SERVING_TIP_COUNT = Math.max(
  1,
  Number(process.env.MINT_SERVING_TIP_COUNT?.trim() || 2) || 2,
);
const CHALLENGE_TTL_MS = 15 * 60_000;

export interface OfferResult {
  remintTxid: string;
  /** Same as remint for memo mint (no separate burn). */
  burnTxid: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  powMs: number;
  hashrateHps: number;
  deskAtomsKept: 1;
  note: string;
  explorerRemint: string;
  explorerBurn: string;
}

export interface ChallengePublic {
  ok: true;
  challengeId: string;
  expiresAt: string;
  tokenId: string;
  bits: number;
  commit: typeof MOORE_TIP_MEMO_POW_COMMIT;
  nonceLength: number;
  preimageHex: string;
  powPrefixHex: string;
  locktime: number;
  tipLocktime: number;
  /** Baton outpoint — informational. */
  tipKey: string;
  /** Changes when the serving tip is reminted; clients should restart. */
  tipEpoch: string;
  tipIndex: number;
  mintAtoms: string;
  note: string;
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
  powBatonCount?: number;
  handoffTxids?: string[];
  batonTips?: BatonTip[];
  redeemScriptHex?: string;
  codeHashHex?: string;
  covenant?: string;
  mode?: string;
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
  baton: { txid: string; outIdx: number; sats: string };
  fuel: { txid: string; outIdx: number; sats: string };
  locktime: number;
  bits: number;
  preimageHex: string;
  powPrefixHex: string;
  mintAtoms: string;
  minerPkHex: string;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
  note: string;
  memorialHex: string;
}

const offerCounts = new Map<string, Map<number, number>>();
const challenges = new Map<string, StoredChallenge>();
let chainLock: Promise<void> = Promise.resolve();

function utcDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

function fuelKey(txid: string, outIdx: number): string {
  return `${txid}:${outIdx}`;
}

function tipKey(txid: string, outIdx: number): string {
  return fuelKey(txid, outIdx);
}

function tipEpochOf(tipRec: BatonTip): string {
  return tipRec.lastRemintTxid ?? `genesis:${tipRec.index}:${tipRec.tipLocktime}`;
}


function countOpenChallenges(): number {
  expireStaleChallenges();
  let n = 0;
  for (const ch of challenges.values()) {
    if (ch.status === 'open') n++;
  }
  return n;
}

/** After a tip remint, expire every other open job on that baton UTXO. */
function expireOpenOnBaton(
  batonTxid: string,
  batonOutIdx: number,
  exceptId?: string,
): number {
  let n = 0;
  for (const ch of challenges.values()) {
    if (ch.status !== 'open') continue;
    if (exceptId && ch.id === exceptId) continue;
    if (ch.baton.txid === batonTxid && ch.baton.outIdx === batonOutIdx) {
      ch.status = 'expired';
      n++;
    }
  }
  return n;
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
    }
  }
}

function cancelOpenChallengesForInstall(installId: string): void {
  for (const ch of challenges.values()) {
    if (ch.installId === installId && ch.status === 'open') {
      ch.status = 'expired';
    }
  }
}

function openChallengesOnTip(tipIndex: number): StoredChallenge[] {
  expireStaleChallenges();
  return [...challenges.values()].filter(
    ch => ch.status === 'open' && ch.tipIndex === tipIndex,
  );
}

function servingTips(tips: BatonTip[]): BatonTip[] {
  const sorted = [...tips].sort((a, b) => a.index - b.index);
  return sorted.slice(0, Math.min(SERVING_TIP_COUNT, sorted.length));
}

/** Load-balance across served tips (fewest open racers wins). */
function pickTipRec(tips: BatonTip[]): BatonTip {
  const pool = servingTips(tips);
  if (pool.length === 0) throw new Error('No baton tips in deployment');
  let best = pool[0]!;
  let bestOpen = openChallengesOnTip(best.index).length;
  for (let i = 1; i < pool.length; i++) {
    const t = pool[i]!;
    const n = openChallengesOnTip(t.index).length;
    if (n < bestOpen) {
      best = t;
      bestOpen = n;
    }
  }
  return best;
}

function tipAnchorTxid(dep: DryrunDep, tipRec: BatonTip): string | null {
  return tipRec.lastRemintTxid ?? dep.handoffTxids?.[tipRec.index] ?? null;
}

/**
 * One fee UTXO per tip: racers on the same tip share it (only the winner broadcasts).
 * Different tips need distinct fee coins.
 */
function fuelsBoundToOtherTips(tipIndex: number): Set<string> {
  const used = new Set<string>();
  for (const ch of challenges.values()) {
    if (ch.status !== 'open') continue;
    if (ch.tipIndex === tipIndex) continue;
    used.add(fuelKey(ch.fuel.txid, ch.fuel.outIdx));
  }
  return used;
}

/** Ensure at least one spendable fee coin exists (not one-per-racer). */
async function ensureOneFuel(wallet: Wallet): Promise<void> {
  await wallet.sync();
  const has = wallet.utxos.some(u => !u.token && u.sats >= REMINT_FUEL_SATS);
  if (has) return;

  const big = wallet.utxos
    .filter(u => !u.token && u.sats > REMINT_FUEL_SATS + 2_000n)
    .sort((a, b) => (a.sats < b.sats ? 1 : -1))[0];
  if (!big) {
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

type FuelCoin = { txid: string; outIdx: number; sats: string };

function resolveFuelForTip(
  wallet: Wallet,
  tipIndex: number,
  batonTxid: string,
  batonOutIdx: number,
): FuelCoin {
  // Reuse the fee coin already bound to racers on this tip/baton.
  const sibling =
    openChallengesOnTip(tipIndex).find(
      ch => ch.baton.txid === batonTxid && ch.baton.outIdx === batonOutIdx,
    ) ?? openChallengesOnTip(tipIndex)[0];
  if (sibling) {
    return { ...sibling.fuel };
  }

  const blocked = fuelsBoundToOtherTips(tipIndex);
  const fuelUtxo = wallet.utxos
    .filter(
      u =>
        !u.token &&
        u.sats >= REMINT_FUEL_SATS &&
        !blocked.has(fuelKey(u.outpoint.txid, u.outpoint.outIdx)),
    )
    .sort((a, c) => (a.sats < c.sats ? -1 : 1))[0];
  if (!fuelUtxo) {
    throw new Error(
      'Mint desk needs a free fee UTXO for this tip. Try again shortly.',
    );
  }
  return {
    txid: fuelUtxo.outpoint.txid,
    outIdx: fuelUtxo.outpoint.outIdx,
    sats: fuelUtxo.sats.toString(),
  };
}

async function createChallengeOnce(opts: {
  installId: string;
  note: string;
}): Promise<ChallengePublic> {
  expireStaleChallenges();
  if (remainingOffersToday(opts.installId) <= 0) {
    throw new Error(
      `Daily limit reached (${MAX_OFFERS_PER_DAY} Prayer offerings per device).`,
    );
  }
  // Same device replaces its own open job; others may keep racing tips.
  cancelOpenChallengesForInstall(opts.installId);
  expireStaleChallenges();
  if (countOpenChallenges() >= MAX_OPEN_CHALLENGES) {
    throw new Error(
      `Mint desk is at capacity (${MAX_OPEN_CHALLENGES} concurrent miners). Try again shortly.`,
    );
  }

  const { dep } = loadDep();
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  if (mintAtoms !== 1n) {
    throw new Error(
      `Deployment mintAtoms=${mintAtoms}; memorial Prayer requires mint 1. Create a new dryrun (TIER=prayer).`,
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
  const tipRec = pickTipRec(tips);
  const note = opts.note.trim().slice(0, 80);
  const memorial = memorialPushdata(note);

  const contract = await createPowRemintMooreTipMemoContract({
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
  await ensureOneFuel(wallet);

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

  const anchor = tipAnchorTxid(dep, tipRec);
  const preferred = anchor
    ? batonUtxos.find(u => u.outpoint.txid === anchor)
    : undefined;
  const b = preferred ?? batonUtxos[tipRec.index] ?? batonUtxos[0]!;
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid,
    vout: b.outpoint.outIdx,
  };

  await wallet.sync();
  // If this tip has no sibling yet, we may need a second fee coin (1 per tip).
  let fuelCoin: FuelCoin;
  try {
    fuelCoin = resolveFuelForTip(
      wallet,
      tipRec.index,
      baton.outpoint.txid,
      baton.outpoint.outIdx,
    );
  } catch {
    await ensureOneFuel(wallet);
    // Force-split an extra sized coin when the only fee is bound to another tip.
    const blocked = fuelsBoundToOtherTips(tipRec.index);
    const free = wallet.utxos.some(
      u =>
        !u.token &&
        u.sats >= REMINT_FUEL_SATS &&
        !blocked.has(fuelKey(u.outpoint.txid, u.outpoint.outIdx)),
    );
    if (!free) {
      const big = wallet.utxos
        .filter(u => !u.token && u.sats > REMINT_FUEL_SATS + 2_000n)
        .sort((a, c) => (a.sats < c.sats ? 1 : -1))[0];
      if (!big) {
        throw new Error(
          `Need XEC ≥ ${Number(REMINT_FUEL_SATS) / 100} for a fee UTXO per tip`,
        );
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
    fuelCoin = resolveFuelForTip(
      wallet,
      tipRec.index,
      baton.outpoint.txid,
      baton.outpoint.outIdx,
    );
  }

  const { mtp } = await getMedianTimePast(chronik);
  const locktime = Math.max(tipRec.tipLocktime, mtp - 1);
  if (locktime < tipRec.tipLocktime) {
    throw new Error(`locktime ${locktime} < tipLocktime ${tipRec.tipLocktime}`);
  }
  if (locktime >= mtp) {
    throw new Error(`locktime ${locktime} ≥ MTP ${mtp}`);
  }

  const prepared = await buildMooreTipMemoRemintChallenge({
    contract,
    baton,
    fuel: {
      outpoint: { txid: fuelCoin.txid, outIdx: fuelCoin.outIdx },
      sats: BigInt(fuelCoin.sats),
      outputScript: wallet.script,
    },
    miner: { sk: mint.sk, pk: mint.pk },
    locktime,
    memorial,
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
    fuel: fuelCoin,
    locktime,
    bits: prepared.tip.bits,
    preimageHex: prepared.preimageHex,
    powPrefixHex: prepared.powPrefixHex,
    mintAtoms: prepared.contract.params.mintAtoms.toString(),
    minerPkHex: toHex(mint.pk),
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    note,
    memorialHex: toHex(memorial),
  };
  challenges.set(id, stored);

  return {
    ok: true,
    challengeId: id,
    expiresAt: new Date(stored.expiresAt).toISOString(),
    tokenId: dep.tokenId,
    bits: prepared.tip.bits,
    commit: MOORE_TIP_MEMO_POW_COMMIT,
    nonceLength: MOORE_TIP_MEMO_NONCE_LENGTH,
    preimageHex: prepared.preimageHex,
    powPrefixHex: prepared.powPrefixHex,
    locktime,
    tipLocktime: tipRec.tipLocktime,
    tipKey: tipKey(stored.baton.txid, stored.baton.outIdx),
    tipEpoch: tipEpochOf(tipRec),
    tipIndex: tipRec.index,
    mintAtoms: stored.mintAtoms,
    note,
  };
}

async function rebuildPrepared(ch: StoredChallenge): Promise<{
  prepared: MooreTipMemoRemintPrepared;
  depPath: string;
  dep: DryrunDep;
  tips: BatonTip[];
  tipRec: BatonTip;
}> {
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

  const contract = await createPowRemintMooreTipMemoContract({
    tokenId: ch.tokenId,
    mintAtoms: BigInt(ch.mintAtoms),
    genesisUnix: ch.genesisUnix,
    baseZeroBits: ch.baseZeroBits,
    secondsPerExtraBit: ch.secondsPerExtraBit,
    tipLocktime: ch.tipLocktime,
  });

  const { fromHex } = await import('ecash-lib');
  const memorial = fromHex(ch.memorialHex);

  const prepared = await buildMooreTipMemoRemintChallenge({
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
    memorial,
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
    throw new Error('Challenge expired; request a new one');
  }

  const nonce = parseNonceHex(opts.nonceHex);
  const { prepared, depPath, dep, tips, tipRec } = await rebuildPrepared(ch);
  const built = await buildMooreTipMemoRemintTxWithNonce({ prepared, nonce });

  const chronik = await createChronik('closest');
  let remintTxid: string;
  try {
    const broadcast = await chronik.broadcastTx(built.txHex);
    remintTxid =
      typeof broadcast === 'string'
        ? broadcast
        : (broadcast as { txid: string }).txid;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ch.status = 'expired';
    // Likely lost the tip race (double-spend / missing inputs).
    throw new Error(
      /missing|spent|conflict|txn-mempool|already|orphan|inputs-missing/i.test(
        msg,
      )
        ? 'Someone else offered on this tip first. Pull to refresh and Offer again.'
        : msg,
    );
  }

  consumeOfferSlot(opts.installId);

  // Losers on the same tip restart (shared fee coin is spent by the winner).
  expireOpenOnBaton(ch.baton.txid, ch.baton.outIdx, ch.id);

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

  ch.status = 'done';

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

  const explorer = `https://explorer.e.cash/tx/${remintTxid}`;
  return {
    remintTxid,
    burnTxid: remintTxid,
    tokenId: dep.tokenId,
    bits: built.tip.bits,
    powAttempts,
    powMs,
    hashrateHps,
    deskAtomsKept: 1,
    note: ch.note,
    explorerRemint: explorer,
    explorerBurn: explorer,
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
  note?: string;
}): Promise<ChallengePublic> {
  return withChainLock(() =>
    createChallengeOnce({
      installId: opts.installId,
      note: opts.note ?? '',
    }),
  );
}

export function enqueueSubmit(opts: {
  installId: string;
  challengeId: string;
  nonceHex: string;
  powMs?: number;
  powAttempts?: number;
}): Promise<OfferResult> {
  return withChainLock(() => submitChallengeOnce(opts));
}

/** Release an open challenge (cancel mining / page reload cleanup). */
export function cancelChallenge(opts: {
  installId: string;
  challengeId?: string;
}): { ok: true; cancelled: number } {
  expireStaleChallenges();
  let cancelled = 0;
  for (const ch of challenges.values()) {
    if (ch.status !== 'open') continue;
    if (ch.installId !== opts.installId) continue;
    if (opts.challengeId && ch.id !== opts.challengeId) continue;
    ch.status = 'expired';
    cancelled++;
  }
  return { ok: true, cancelled };
}

export function enqueueCancel(opts: {
  installId: string;
  challengeId?: string;
}): Promise<{ ok: true; cancelled: number }> {
  return withChainLock(async () => cancelChallenge(opts));
}

export function publicStatus(): {
  tokenId: string | null;
  mintAtoms: string | null;
  ticker: string;
  maxOffersPerDay: number;
  maxOpenChallenges: number;
  openChallenges: number;
  servingTipCount: number;
  tipEpochs: Record<string, string>;
  /** @deprecated use tipEpochs — kept for older clients */
  tipEpoch: string | null;
  tipKey: string | null;
  powBatonCount: number | null;
  raceOpen: true;
  baseZeroBits: number | null;
  clientPow: true;
  memorialOnMint: true;
} {
  try {
    const { dep } = loadDep();
    const tips =
      dep.batonTips && dep.batonTips.length > 0 ? dep.batonTips : [];
    const served = servingTips(tips);
    const tipEpochs: Record<string, string> = {};
    for (const t of served) {
      tipEpochs[String(t.index)] = tipEpochOf(t);
    }
    const primary = served[0] ?? null;
    return {
      tokenId: dep.tokenId,
      mintAtoms: dep.mintAtomsPerRemint,
      ticker: 'dPRAYER',
      maxOffersPerDay: MAX_OFFERS_PER_DAY,
      maxOpenChallenges: MAX_OPEN_CHALLENGES,
      openChallenges: countOpenChallenges(),
      servingTipCount: SERVING_TIP_COUNT,
      tipEpochs,
      tipEpoch: primary ? tipEpochOf(primary) : null,
      tipKey: primary ? tipEpochOf(primary) : null,
      powBatonCount: dep.powBatonCount ?? (tips.length || null),
      raceOpen: true,
      baseZeroBits: dep.baseZeroBits,
      clientPow: true,
      memorialOnMint: true,
    };
  } catch {
    return {
      tokenId: null,
      mintAtoms: null,
      ticker: 'dPRAYER',
      maxOffersPerDay: MAX_OFFERS_PER_DAY,
      maxOpenChallenges: MAX_OPEN_CHALLENGES,
      openChallenges: countOpenChallenges(),
      servingTipCount: SERVING_TIP_COUNT,
      tipEpochs: {},
      tipEpoch: null,
      tipKey: null,
      powBatonCount: null,
      raceOpen: true,
      baseZeroBits: null,
      clientPow: true,
      memorialOnMint: true,
    };
  }
}
