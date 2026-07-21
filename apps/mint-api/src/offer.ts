/**
 * Offer API: device PoW → server fees/sign/broadcast.
 *
 * wLotus (temple): remint mint 108 (1 miner + 107 temple mala) → burn miner 1 with WLBR.
 * Legacy Prayer memo: remint mint 1 with WLBR in OP_RETURN (no burn tx).
 *
 *   POST /api/challenge  { installId, note?, parentBurnTxid? }
 *   POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fromHex, toHex } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../../../src/network/createChronik.js';
import { getMedianTimePast } from '../../../src/network/medianTimePast.js';
import { createPowRemintMooreTipMemoContract } from '../../../src/covenant/powRemintMooreTipMemoScript.js';
import { createPowRemintMooreTipTempleContract } from '../../../src/covenant/powRemintMooreTipTempleScript.js';
import {
  buildMooreTipMemoRemintChallenge,
  buildMooreTipMemoRemintTxWithNonce,
  MOORE_TIP_MEMO_NONCE_LENGTH,
  MOORE_TIP_MEMO_POW_COMMIT,
  parseNonceHex,
  type MooreTipMemoRemintPrepared,
} from '../../../src/miner/remintMooreTipMemo.js';
import {
  buildMooreTipTempleRemintChallenge,
  buildMooreTipTempleRemintTxWithNonce,
  MOORE_TIP_TEMPLE_NONCE_LENGTH,
  MOORE_TIP_TEMPLE_POW_COMMIT,
  type MooreTipTempleRemintPrepared,
} from '../../../src/miner/remintMooreTipTemple.js';
import {
  burnOnePrayer,
  memorialPushdata,
  OFFERING_ID_WLOTUS,
  parseParentBurnTxidHex,
} from '../../../src/offering/burnPrayer.js';
import { WLOTUS_MINT_ATOMS } from '../../../src/params/wlotusMint.js';
import {
  REMINT_FUEL_SATS,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
} from '../../../src/mint/fuelUtxo.js';
import {
  loadTipFeeWallet,
  tipFeeWalletSummary,
} from '../../../src/mint/loadTipFeeWallet.js';
import {
  loadMintWallet,
  mintWalletSummary,
} from '../../../src/mint/loadMintWallet.js';

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
  /** Burn tx (WLotus) or same as remint (legacy Prayer memo). */
  burnTxid: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  powMs: number;
  hashrateHps: number;
  /** 0 when miner atom was burned; 1 for legacy memo-keep. */
  deskAtomsKept: 0 | 1;
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
  commit:
    | typeof MOORE_TIP_MEMO_POW_COMMIT
    | typeof MOORE_TIP_TEMPLE_POW_COMMIT;
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
  /** Per-tip fee wallet that pays remint fuel (and receives mint dust). */
  tipFeeAddress: string;
  mintAtoms: string;
  note: string;
  /** Set when this challenge is a re-offer linked to a prior burn. */
  parentBurnTxid?: string;
}

interface BatonTip {
  index: number;
  tipLocktime: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface DryrunDep {
  tier?: string;
  ticker?: string;
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
  templeScriptHashHex?: string | null;
  /** @deprecated */
  templePkhHex?: string | null;
}

type OfferMode = 'temple' | 'memo';

interface StoredChallenge {
  id: string;
  installId: string;
  createdAt: number;
  expiresAt: number;
  status: 'open' | 'done' | 'expired';
  mode: OfferMode;
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
  /**
   * Prior burn txid (hex). Temple path only — encoded in WLBR v2 on the
   * burn-after-mint tx (empty note). Rejected on memo path (mint memorial budget).
   */
  parentBurnTxid?: string;
  /** Prayer memo path only. */
  memorialHex: string;
  templeScriptHashHex?: string;
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
      `Daily limit reached (${MAX_OFFERS_PER_DAY} offerings per device).`,
    );
  }
  byDay.set(day, used + 1);
}

function loadDep(): { path: string; dep: DryrunDep } {
  const candidates = [
    'deployments/mainnet-dryrun-wlotus.json',
    'deployments/mainnet-dryrun-active.json',
    'deployments/mainnet-dryrun-prayer.json',
  ];
  for (const rel of candidates) {
    const path = resolve(process.cwd(), rel);
    if (existsSync(path)) {
      return { path, dep: JSON.parse(readFileSync(path, 'utf8')) as DryrunDep };
    }
  }
  throw new Error('Missing dryrun deployment (wlotus / active / prayer)');
}

function isTempleDep(dep: DryrunDep): boolean {
  return (
    dep.tier === 'wlotus' ||
    dep.covenant === 'WlotusPowRemintMooreTipTemple' ||
    dep.mode === 'moore-tip-temple-hard-bind'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** After temple remint, burn the miner 1 atom from the tip fee wallet. */
async function burnMinerAtomAfterMint(opts: {
  wallet: Wallet;
  tokenId: string;
  note: string;
  parentBurnTxid?: string;
}): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    await opts.wallet.sync();
    const has = opts.wallet.utxos.some(
      u =>
        u.token?.tokenId === opts.tokenId &&
        u.token.atoms != null &&
        BigInt(u.token.atoms) >= 1n,
    );
    if (!has) {
      await sleep(400 + attempt * 200);
      continue;
    }
    try {
      const burned = await burnOnePrayer({
        wallet: opts.wallet,
        tokenId: opts.tokenId,
        note: opts.note,
        offeringId: OFFERING_ID_WLOTUS,
        parentBurnTxid: opts.parentBurnTxid,
      });
      return burned.txid;
    } catch (e) {
      lastErr = e;
      await sleep(400 + attempt * 200);
    }
  }
  throw new Error(
    `Burn after mint failed: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'no atoms')
    }`,
  );
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

type FuelCoin = { txid: string; outIdx: number; sats: string };

/**
 * Peel one REMINT_FUEL_SATS coin from an oversized UTXO on `wallet`.
 * Remint has no change out — oversized fuel would burn almost entirely as fee.
 */
async function splitSizedFuel(wallet: Wallet): Promise<void> {
  await wallet.sync();
  if (pickSizedFuelUtxo(wallet.utxos)) return;
  const big = pickSplitSourceUtxo(wallet.utxos);
  if (!big) {
    throw new Error(
      `Need XEC ≥ ${Number(REMINT_FUEL_SATS) / 100} for a sized remint fee UTXO`,
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
  console.log(
    `fuel split ${resp.broadcasted[0]} → ${REMINT_FUEL_SATS} sats (refused oversized fuel)`,
  );
  await wallet.sync();
}

/**
 * Send one sized fuel coin from the main desk → tip fee wallet.
 * Used when the tip account is empty but the desk still has treasury XEC.
 */
async function topUpTipFuelFromDesk(
  desk: Wallet,
  tipWallet: Wallet,
): Promise<void> {
  await desk.sync();
  const source =
    pickSizedFuelUtxo(desk.utxos) ?? pickSplitSourceUtxo(desk.utxos);
  if (!source) {
    throw new Error(
      `Tip fee wallet ${tipWallet.address} is empty and desk has no XEC to fund it. ` +
        `Run: npm run fund-tip-fee-wallets`,
    );
  }
  // If desk only has oversized coins, peel a sized one onto the tip directly.
  const { payment } = await import('ecash-lib');
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: tipWallet.script }],
  };
  const resp = await desk.action(action).build().broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Desk→tip fuel top-up failed: ${JSON.stringify(resp)}`);
  }
  console.log(
    `desk→tip fuel ${resp.broadcasted[0]} ${REMINT_FUEL_SATS} sats → ${tipWallet.address}`,
  );
  await tipWallet.sync();
}

/**
 * One sized fee UTXO per tip wallet. Racers on the same tip share it
 * (only the winner broadcasts). Tips use separate HD accounts so they
 * cannot spend each other's fuel.
 */
function resolveFuelForTip(
  wallet: Wallet,
  tipIndex: number,
  batonTxid: string,
  batonOutIdx: number,
): FuelCoin {
  const sibling =
    openChallengesOnTip(tipIndex).find(
      ch => ch.baton.txid === batonTxid && ch.baton.outIdx === batonOutIdx,
    ) ?? openChallengesOnTip(tipIndex)[0];
  if (sibling) {
    return { ...sibling.fuel };
  }

  const fuelUtxo = pickSizedFuelUtxo(wallet.utxos);
  if (!fuelUtxo) {
    throw new Error(
      'Tip fee wallet needs a sized fee UTXO. Try again shortly.',
    );
  }
  return {
    txid: fuelUtxo.outpoint.txid,
    outIdx: fuelUtxo.outpoint.outIdx,
    sats: fuelUtxo.sats.toString(),
  };
}

async function ensureTipSizedFuel(
  desk: Wallet,
  tipWallet: Wallet,
  tipIndex: number,
  batonTxid: string,
  batonOutIdx: number,
): Promise<FuelCoin> {
  // Reuse sibling binding without syncing / splitting.
  try {
    return resolveFuelForTip(tipWallet, tipIndex, batonTxid, batonOutIdx);
  } catch {
    /* need to provision */
  }

  await tipWallet.sync();
  try {
    return resolveFuelForTip(tipWallet, tipIndex, batonTxid, batonOutIdx);
  } catch {
    /* continue */
  }

  if (pickSplitSourceUtxo(tipWallet.utxos)) {
    await splitSizedFuel(tipWallet);
  } else {
    await topUpTipFuelFromDesk(desk, tipWallet);
    // Top-up sends exactly REMINT_FUEL_SATS; if desk spent an oversized coin
    // with change, tip already has a sized coin. If tip somehow got a lump,
    // split again.
    if (!pickSizedFuelUtxo(tipWallet.utxos)) {
      await splitSizedFuel(tipWallet);
    }
  }

  return resolveFuelForTip(tipWallet, tipIndex, batonTxid, batonOutIdx);
}

async function createChallengeOnce(opts: {
  installId: string;
  note: string;
  parentBurnTxid?: string;
}): Promise<ChallengePublic> {
  expireStaleChallenges();
  if (remainingOffersToday(opts.installId) <= 0) {
    throw new Error(
      `Daily limit reached (${MAX_OFFERS_PER_DAY} offerings per device).`,
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
  const temple = isTempleDep(dep);
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  if (temple) {
    if (mintAtoms !== WLOTUS_MINT_ATOMS) {
      throw new Error(
        `wLotus deployment mintAtoms=${mintAtoms}; expected ${WLOTUS_MINT_ATOMS}`,
      );
    }
  } else if (mintAtoms !== 1n) {
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
  const parentBurnTxid = opts.parentBurnTxid
    ? parseParentBurnTxidHex(opts.parentBurnTxid)
    : undefined;
  // Re-offer: empty on-chain note; link via parentBurnTxid (WLBR v2 on burn).
  const note = parentBurnTxid ? '' : opts.note.trim().slice(0, 80);
  if (parentBurnTxid && !temple) {
    throw new Error(
      'parentBurnTxid (re-offer) requires the wLotus temple burn path',
    );
  }
  const memorial = memorialPushdata(note);
  const templeHashHex = dep.templeScriptHashHex ?? dep.templePkhHex;
  if (temple && (!templeHashHex || templeHashHex.length !== 40)) {
    throw new Error('wLotus deployment missing templeScriptHashHex');
  }

  const contract = temple
    ? await createPowRemintMooreTipTempleContract({
        tokenId: dep.tokenId,
        mintAtoms,
        templeScriptHash: fromHex(templeHashHex!),
        genesisUnix: dep.genesisUnix,
        baseZeroBits: dep.baseZeroBits,
        secondsPerExtraBit: dep.secondsPerExtraBit,
        tipLocktime: tipRec.tipLocktime,
      })
    : await createPowRemintMooreTipMemoContract({
        tokenId: dep.tokenId,
        mintAtoms,
        genesisUnix: dep.genesisUnix,
        baseZeroBits: dep.baseZeroBits,
        secondsPerExtraBit: dep.secondsPerExtraBit,
        tipLocktime: tipRec.tipLocktime,
      });

  const chronik = await createChronik('closest');
  const desk = await loadMintWallet(chronik);
  const tipFee = await loadTipFeeWallet(chronik, tipRec.index);
  console.log('mint desk', JSON.stringify(mintWalletSummary(desk)));
  console.log('tip fee', JSON.stringify(tipFeeWalletSummary(tipRec.index, tipFee)));

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

  const fuelCoin = await ensureTipSizedFuel(
    desk.wallet,
    tipFee.wallet,
    tipRec.index,
    baton.outpoint.txid,
    baton.outpoint.outIdx,
  );

  const { mtp } = await getMedianTimePast(chronik);
  const locktime = Math.max(tipRec.tipLocktime, mtp - 1);
  if (locktime < tipRec.tipLocktime) {
    throw new Error(`locktime ${locktime} < tipLocktime ${tipRec.tipLocktime}`);
  }
  if (locktime >= mtp) {
    throw new Error(`locktime ${locktime} ≥ MTP ${mtp}`);
  }

  const prepared = temple
    ? await buildMooreTipTempleRemintChallenge({
        contract: contract as Awaited<
          ReturnType<typeof createPowRemintMooreTipTempleContract>
        >,
        baton,
        fuel: {
          outpoint: { txid: fuelCoin.txid, outIdx: fuelCoin.outIdx },
          sats: BigInt(fuelCoin.sats),
          outputScript: tipFee.wallet.script,
        },
        miner: { sk: tipFee.sk, pk: tipFee.pk },
        locktime,
      })
    : await buildMooreTipMemoRemintChallenge({
        contract: contract as Awaited<
          ReturnType<typeof createPowRemintMooreTipMemoContract>
        >,
        baton,
        fuel: {
          outpoint: { txid: fuelCoin.txid, outIdx: fuelCoin.outIdx },
          sats: BigInt(fuelCoin.sats),
          outputScript: tipFee.wallet.script,
        },
        miner: { sk: tipFee.sk, pk: tipFee.pk },
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
    mode: temple ? 'temple' : 'memo',
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
    minerPkHex: toHex(tipFee.pk),
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    note,
    parentBurnTxid,
    memorialHex: toHex(memorial),
    templeScriptHashHex: temple ? templeHashHex! : undefined,
  };
  challenges.set(id, stored);

  return {
    ok: true,
    challengeId: id,
    expiresAt: new Date(stored.expiresAt).toISOString(),
    tokenId: dep.tokenId,
    bits: prepared.tip.bits,
    commit: temple ? MOORE_TIP_TEMPLE_POW_COMMIT : MOORE_TIP_MEMO_POW_COMMIT,
    nonceLength: temple
      ? MOORE_TIP_TEMPLE_NONCE_LENGTH
      : MOORE_TIP_MEMO_NONCE_LENGTH,
    preimageHex: prepared.preimageHex,
    powPrefixHex: prepared.powPrefixHex,
    locktime,
    tipLocktime: tipRec.tipLocktime,
    tipKey: tipKey(stored.baton.txid, stored.baton.outIdx),
    tipEpoch: tipEpochOf(tipRec),
    tipIndex: tipRec.index,
    tipFeeAddress: tipFee.address,
    mintAtoms: stored.mintAtoms,
    note,
    parentBurnTxid,
  };
}

async function rebuildPrepared(ch: StoredChallenge): Promise<{
  prepared: MooreTipMemoRemintPrepared | MooreTipTempleRemintPrepared;
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
  const tipFee = await loadTipFeeWallet(chronik, ch.tipIndex);
  if (toHex(tipFee.pk) !== ch.minerPkHex) {
    throw new Error('Tip fee wallet changed; challenge is invalid. Request a new one.');
  }

  const baton = {
    outpoint: { txid: ch.baton.txid, outIdx: ch.baton.outIdx },
    sats: BigInt(ch.baton.sats),
    txid: ch.baton.txid,
    vout: ch.baton.outIdx,
  };
  const fuel = {
    outpoint: { txid: ch.fuel.txid, outIdx: ch.fuel.outIdx },
    sats: BigInt(ch.fuel.sats),
    outputScript: tipFee.wallet.script,
  };
  const miner = { sk: tipFee.sk, pk: tipFee.pk };

  let prepared: MooreTipMemoRemintPrepared | MooreTipTempleRemintPrepared;
  if (ch.mode === 'temple') {
    if (!ch.templeScriptHashHex || ch.templeScriptHashHex.length !== 40) {
      throw new Error('Temple challenge missing templeScriptHashHex');
    }
    const contract = await createPowRemintMooreTipTempleContract({
      tokenId: ch.tokenId,
      mintAtoms: BigInt(ch.mintAtoms),
      templeScriptHash: fromHex(ch.templeScriptHashHex),
      genesisUnix: ch.genesisUnix,
      baseZeroBits: ch.baseZeroBits,
      secondsPerExtraBit: ch.secondsPerExtraBit,
      tipLocktime: ch.tipLocktime,
    });
    prepared = await buildMooreTipTempleRemintChallenge({
      contract,
      baton,
      fuel,
      miner,
      locktime: ch.locktime,
    });
  } else {
    const contract = await createPowRemintMooreTipMemoContract({
      tokenId: ch.tokenId,
      mintAtoms: BigInt(ch.mintAtoms),
      genesisUnix: ch.genesisUnix,
      baseZeroBits: ch.baseZeroBits,
      secondsPerExtraBit: ch.secondsPerExtraBit,
      tipLocktime: ch.tipLocktime,
    });
    prepared = await buildMooreTipMemoRemintChallenge({
      contract,
      baton,
      fuel,
      miner,
      locktime: ch.locktime,
      memorial: fromHex(ch.memorialHex),
    });
  }

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
  const built =
    ch.mode === 'temple'
      ? await buildMooreTipTempleRemintTxWithNonce({
          prepared: prepared as MooreTipTempleRemintPrepared,
          nonce,
        })
      : await buildMooreTipMemoRemintTxWithNonce({
          prepared: prepared as MooreTipMemoRemintPrepared,
          nonce,
        });

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
    // Clients auto-retry; TIP_RACE_LOST is the stable signal (do not ask users to refresh).
    throw new Error(
      /missing|spent|conflict|txn-mempool|already|orphan|inputs-missing/i.test(
        msg,
      )
        ? 'TIP_RACE_LOST'
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
  // Keep wlotus json in sync when active was the load path
  const wlotusPath = resolve(process.cwd(), 'deployments/mainnet-dryrun-wlotus.json');
  if (existsSync(wlotusPath) && depPath !== wlotusPath && isTempleDep(dep)) {
    writeFileSync(wlotusPath, `${JSON.stringify(updated, null, 2)}\n`);
  }

  ch.status = 'done';

  let burnTxid = remintTxid;
  let deskAtomsKept: 0 | 1 = 1;
  if (ch.mode === 'temple') {
    const tipFee = await loadTipFeeWallet(chronik, ch.tipIndex);
    burnTxid = await burnMinerAtomAfterMint({
      wallet: tipFee.wallet,
      tokenId: ch.tokenId,
      note: ch.note,
      parentBurnTxid: ch.parentBurnTxid,
    });
    deskAtomsKept = 0;
  }

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
    deskAtomsKept,
    note: ch.note,
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
  note?: string;
  parentBurnTxid?: string;
}): Promise<ChallengePublic> {
  return withChainLock(() =>
    createChallengeOnce({
      installId: opts.installId,
      note: opts.note ?? '',
      parentBurnTxid: opts.parentBurnTxid,
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

/** Serialize cancel with challenge/submit so a re-Offer cannot race a stale lock. */
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
  /** Legacy Prayer memo path. */
  memorialOnMint: boolean;
  /** WLotus: burn miner atom after remint. */
  memorialOnBurn: boolean;
  /** Per-tip HD fee accounts (tip i → BIP44 account i+1). */
  tipFeeAccounts: true;
} {
  try {
    const { dep } = loadDep();
    const temple = isTempleDep(dep);
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
      ticker: dep.ticker ?? (temple ? 'dWLOTUS' : 'dPRAYER'),
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
      memorialOnMint: !temple,
      memorialOnBurn: temple,
      tipFeeAccounts: true,
    };
  } catch {
    return {
      tokenId: null,
      mintAtoms: null,
      ticker: 'dWLOTUS',
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
      memorialOnMint: false,
      memorialOnBurn: true,
      tipFeeAccounts: true,
    };
  }
}
