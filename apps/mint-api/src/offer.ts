/**
 * Offer API: device PoW → server fees/sign/broadcast.
 *
 * wLotus (temple 102/6 or felt no-tax 108): remint → burn miner atoms with DANA
 * (1 flower normally; more on active temple specials — ghosts/heroes).
 * Legacy Prayer memo: remint mint 1 with DANA memorial in OP_RETURN (no burn tx).
 *
 * Challenge lookup follows the mint baton on Chronik (`spentBy` from
 * lastRemintTxid / handoff). JSON powAddress is a cache — open miners move the tip.
 *
 *   POST /api/challenge  { installId, note?, parentBurnTxid? }
 *   POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
 *                        → remint immediately; temple path returns burnPending
 *   POST /api/burn       { installId, remintTxid, burnToken } — capability from submit
 *   POST /api/cancel     { installId, challengeId?, remintTxid?, burnToken? }
 *                        — abandon pending burn requires remintTxid + burnToken
 */
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fromHex, toHex, Script } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../../../src/network/createChronik.js';
import { getMedianTimePast } from '../../../src/network/medianTimePast.js';
import { createPowRemintMooreTipMemoContract } from '../../../src/covenant/powRemintMooreTipMemoScript.js';
import { createPowRemintMooreTipTempleContract } from '../../../src/covenant/powRemintMooreTipTempleScript.js';
import { createPowRemintMooreTipContract } from '../../../src/covenant/powRemintMooreTipScript.js';
import { createPowRemintGlotusTipContract } from '../../../src/covenant/powRemintGlotusTipScript.js';
import { expectedGlotusMintOpReturnScript } from '../../../src/covenant/powRemintGlotusTipOutputs.js';
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
  buildMooreTipRemintChallenge,
  buildMooreTipRemintTxWithNonce,
  MOORE_TIP_NONCE_LENGTH,
  MOORE_TIP_POW_COMMIT,
  type MooreTipRemintPrepared,
} from '../../../src/miner/remintMooreTip.js';
import {
  burnOnePrayer,
  explorerTx,
  memorialPushdata,
  OFFERING_ID_PRAYER,
  OFFERING_ID_WLOTUS,
  parseParentBurnTxidHex,
} from '../../../src/offering/burnPrayer.js';
import {
  memorialNoteMaxBytes,
  prepareDanaNote,
  truncateUtf8Bytes,
  isDeathDateAmendNote,
  isRelationshipAmendNote,
} from '../../../src/offering/altarFields.js';
import {
  WLOTUS_FELT_MINER_ATOMS,
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_SOFT_TEMPLE_ATOMS,
  isWlotusFeltCovenant,
  isWlotusMooreTipCovenant,
  isWlotusTempleCovenant,
} from '../../../src/params/wlotusMint.js';
import {
  AbandonedDeskError,
  assertDeskTokenId,
} from '../../../src/params/wlotusTokens.js';
import { resolveTempleSinkFromEnv } from '../../../src/offering/templeSink.js';
import {
  loadTempleSpecialsFromEnv,
  loadTempleSpecialsGlobalConfig,
  resolveOfferBurnAtoms,
  resolveTempleSpecialsStatus,
  NORMAL_FLOWER_BURN_ATOMS,
} from '../../../src/params/templeSpecials.js';
import {
  DESK_TOPUP_RESERVE_SATS,
  OFFERING_PAIR_SATS,
  REMINT_FUEL_SATS,
  pickBurnPostageUtxo,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
  pureXecBalance,
} from '../../../src/mint/fuelUtxo.js';
import {
  peelOfferingPair,
  sendOfferingPairFromDesk,
} from '../../../src/mint/peelSizedFuel.js';
import {
  loadTipFeeWallet,
  tipFeeWalletSummary,
} from '../../../src/mint/loadTipFeeWallet.js';
import {
  loadMintWallet,
  mintWalletSummary,
} from '../../../src/mint/loadMintWallet.js';
import {
  resolveLiveMintBaton,
  matchCovenantToBaton,
} from '../../../src/mint/followMintBaton.js';
import {
  parseServingTipCount,
  parseServingTipOffset,
  selectServingTips,
} from '../../../src/mint/servingTips.js';
import { createDailyCounter, createRollingWindowCounter, normalizeClientIp } from '../../../src/lib/rateLimit.js';
import {
  isKnownRootCreator,
  rememberRootCreator,
  rootCreatorMatch,
} from './rootCreators.js';

const MAX_OFFERS_PER_DAY = Math.max(
  1,
  Number(process.env.MINT_MAX_OFFERS_PER_DAY?.trim() || 20) || 20,
);
/**
 * Coarser secondary cap keyed on client IP (normalized — IPv6 collapses to
 * its /64 prefix; see src/lib/rateLimit.ts). Deliberately looser than the
 * per-installId cap so a household/office sharing one public IPv4 isn't
 * throttled by normal, independent use — it exists only to bound how much
 * sponsored XEC fee a single IP can drain by minting fresh installIds
 * (clearing localStorage costs nothing; this doesn't need to be tight — see
 * the economics note in apps/mint-api/README.md "Limits").
 */
const MAX_OFFERS_PER_DAY_PER_IP = Math.max(
  MAX_OFFERS_PER_DAY,
  Number(process.env.MINT_MAX_OFFERS_PER_DAY_PER_IP?.trim() || 0) ||
    MAX_OFFERS_PER_DAY * 5,
);
/** Cap concurrent open challenges (server CPU for building preimages). */
const MAX_OPEN_CHALLENGES = Math.max(
  1,
  Number(process.env.MINT_MAX_OPEN_CHALLENGES?.trim() || 32) || 32,
);
/** Chronik-heavy challenge builds per IP per minute (nginx also rate-limits). */
const MAX_CHALLENGES_PER_IP_PER_MIN = Math.max(
  1,
  Number(process.env.MINT_MAX_CHALLENGES_PER_IP_PER_MIN?.trim() || 8) || 8,
);
/**
 * Tips this process spends, from `MINT_SERVING_TIP_OFFSET`.
 * Launch: offset **0**, count **1** (tip 0). Same token on test: offset **1**.
 */
const SERVING_TIP_COUNT = parseServingTipCount();
const SERVING_TIP_OFFSET = parseServingTipOffset();
const CHALLENGE_TTL_MS = 15 * 60_000;
/** Pending memorial burns after remint (soft pray window). */
const PENDING_BURN_TTL_MS = 15 * 60_000;

export interface OfferResult {
  remintTxid: string;
  /**
   * Burn tx when complete. Empty string when temple remint succeeded and
   * memorial burn is still pending (`burnPending: true`).
   */
  burnTxid: string;
  /** Temple path: remint done; call POST /api/burn after soft pray (or abandon). */
  burnPending: boolean;
  /**
   * One-time capability for `/api/burn` / abandon. Only returned to the submitter;
   * remintTxid alone is public and insufficient.
   */
  burnToken?: string;
  tokenId: string;
  bits: number;
  powAttempts: number;
  powMs: number;
  hashrateHps: number;
  /**
   * Miner-share atoms retained by the desk after this offer path.
   * Temple + burn complete: WLOTUS_MINER_ATOMS - burnAtoms.
   */
  deskAtomsKept: number;
  /** Atoms burned on the memorial path (1 flower; more on active specials). */
  burnAtoms?: string;
  note: string;
  explorerRemint: string;
  explorerBurn: string;
}

export interface BurnResult {
  remintTxid: string;
  burnTxid: string;
  tokenId: string;
  deskAtomsKept: number;
  burnAtoms: string;
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
    | typeof MOORE_TIP_TEMPLE_POW_COMMIT
    | typeof MOORE_TIP_POW_COMMIT;
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
  /** Set when this challenge is a re-offer linked to the original dedication burn. */
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

type OfferMode = 'temple' | 'felt' | 'moore-tip' | 'memo';

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
  /** Sized burn-postage coin; leftover XEC returns to the desk. */
  postage: { txid: string; outIdx: number; sats: string };
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
   * Original dedication burn txid (hex). Temple path only — encoded in DANA v2
   * on the burn-after-mint tx (optional note + parent). Star topology for explorers.
   * Rejected on memo path (mint memorial budget).
   */
  parentBurnTxid?: string;
  /** Prayer memo path only. */
  memorialHex: string;
  templeScriptHashHex?: string;
}

interface PendingBurn {
  remintTxid: string;
  installId: string;
  /** Secret capability issued only on submit response. */
  burnToken: string;
  createdAt: number;
  expiresAt: number;
  tipIndex: number;
  tokenId: string;
  note: string;
  parentBurnTxid?: string;
}

const installDailyCounter = createDailyCounter(
  MAX_OFFERS_PER_DAY,
  (max) => `Daily limit reached (${max} offerings per device).`,
);
const ipDailyCounter = createDailyCounter(
  MAX_OFFERS_PER_DAY_PER_IP,
  (max) => `Daily limit reached (${max} offerings from this network).`,
);
const challengeIpWindow = createRollingWindowCounter(
  MAX_CHALLENGES_PER_IP_PER_MIN,
  60_000,
  (max) =>
    `Too many challenges from this network (${max} per minute). Try again shortly.`,
);
const challenges = new Map<string, StoredChallenge>();
const pendingBurns = new Map<string, PendingBurn>();
let chainLock: Promise<void> = Promise.resolve();

function fuelKey(txid: string, outIdx: number): string {
  return `${txid}:${outIdx}`;
}

function tipKey(txid: string, outIdx: number): string {
  return fuelKey(txid, outIdx);
}

function tipEpochOf(tipRec: BatonTip): string {
  return tipRec.lastRemintTxid ?? `genesis:${tipRec.index}:${tipRec.tipLocktime}`;
}

function newBurnToken(): string {
  return randomBytes(32).toString('hex');
}

function burnTokenMatches(expected: string, provided: string | undefined): boolean {
  const a = expected;
  const b = (provided ?? '').trim();
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
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

/** Most restrictive of the per-device and per-IP caps still open today. */
export function remainingOffersToday(installId: string, ip?: string): number {
  const installRemaining = installDailyCounter.remaining(installId);
  if (ip === undefined) return installRemaining;
  return Math.min(installRemaining, ipDailyCounter.remaining(normalizeClientIp(ip)));
}

function consumeOfferSlot(installId: string, ip?: string): void {
  installDailyCounter.consume(installId);
  if (ip !== undefined) ipDailyCounter.consume(normalizeClientIp(ip));
}

function loadDep(): { path: string; dep: DryrunDep } {
  const requireLive = /^(1|true|yes)$/i.test(
    process.env.MINT_REQUIRE_LIVE?.trim() || '',
  );
  const explicit = process.env.MINT_DEPLOYMENT_JSON?.trim();
  const candidates = explicit
    ? [explicit]
    : requireLive
      ? ['deployments/mainnet-wlotus.json']
      : [
          // Live prod first (ticker WLOTUS) — Contabo prod after create-wlotus-token
          'deployments/mainnet-wlotus.json',
          'deployments/mainnet-dryrun-wlotus.json',
          'deployments/mainnet-dryrun-active.json',
          'deployments/mainnet-dryrun-prayer.json',
        ];
  for (const rel of candidates) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) continue;
    const dep = JSON.parse(readFileSync(path, 'utf8')) as DryrunDep;
    const ticker = (dep.ticker ?? '').trim().toUpperCase();
    if (requireLive && ticker && ticker !== 'WLOTUS') {
      throw new Error(
        `MINT_REQUIRE_LIVE=1 but ${rel} has ticker=${dep.ticker} (want WLOTUS). ` +
          `Create live genesis: npm run create-wlotus-token`,
      );
    }
    try {
      assertDeskTokenId(String(dep.tokenId || ''));
    } catch (err) {
      if (err instanceof AbandonedDeskError) {
        if (explicit || requireLive) throw err;
        console.warn(`mint-api skipping ${rel}: ${err.message}`);
        continue;
      }
      throw err;
    }
    return { path, dep };
  }
  throw new Error(
    requireLive || explicit
      ? `Missing live deployment JSON (${explicit || 'deployments/mainnet-wlotus.json'}). ` +
        `Run create-wlotus-token on prod (default ticker WLOTUS).`
      : 'Missing deployment JSON (mainnet-wlotus / dryrun-wlotus / active / prayer)',
  );
}

/** Fail mint-api startup when git JSON is an abandoned tokenId. */
export function requireMintDesk(): void {
  loadDep();
}

function isFeltDep(dep: DryrunDep): boolean {
  return isWlotusFeltCovenant(dep);
}

function isMooreTipDep(dep: DryrunDep): boolean {
  return isWlotusMooreTipCovenant(dep);
}

function isTempleDep(dep: DryrunDep): boolean {
  if (isFeltDep(dep) || isMooreTipDep(dep)) return false;
  return isWlotusTempleCovenant(dep) || dep.tier === 'wlotus';
}

/** Memorial-on-burn desk (102/6 temple, WLotus MooreTip, or felt). */
function isWlotusDeskDep(dep: DryrunDep): boolean {
  return isTempleDep(dep) || isFeltDep(dep) || isMooreTipDep(dep);
}

function deskMinerAtoms(dep: DryrunDep): bigint {
  return isFeltDep(dep) || isMooreTipDep(dep)
    ? WLOTUS_FELT_MINER_ATOMS
    : WLOTUS_MINER_ATOMS;
}

function specialsGlobalForDep(dep: DryrunDep) {
  return {
    ...loadTempleSpecialsGlobalConfig(),
    minerAtoms: deskMinerAtoms(dep),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Fire-and-forget: ask dana-index to pull this burn into the public history. */
function notifyDanaIndex(burnTxid: string): void {
  const base = process.env.DANA_INDEX_URL?.trim();
  if (!base) return;
  const url = `${base.replace(/\/$/, '')}/api/notify`;
  const secret = process.env.DANA_INDEX_NOTIFY_SECRET?.trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  void fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ burnTxid }),
  }).catch(err => {
    console.warn('dana-index notify failed', err);
  });
}

/**
 * After temple remint, burn flower atoms from the tip fee (mint) wallet.
 * Fee input is the sized postage coin; leftover XEC returns to the **desk**.
 * Leftover miner inventory → temple P2SH when set, otherwise the desk.
 */
async function burnMinerAtomAfterMint(opts: {
  wallet: Wallet;
  desk: Wallet;
  tokenId: string;
  note: string;
  parentBurnTxid?: string;
  /** Atoms to burn (default 1). Active temple specials may burn more. */
  burnAtoms?: bigint;
  /** Leftover inventory sink (temple address). */
  inventoryScript: Script;
  minInventoryAtoms?: bigint;
}): Promise<{ txid: string; burnAtoms: bigint; inventoryAtoms: bigint }> {
  const burnAtoms = opts.burnAtoms ?? NORMAL_FLOWER_BURN_ATOMS;
  if (burnAtoms < 1n) {
    throw new Error(`burnAtoms must be ≥ 1 (got ${burnAtoms})`);
  }
  const minInventory = opts.minInventoryAtoms ?? 0n;
  const needAtoms = burnAtoms + minInventory;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    await opts.wallet.sync();
    const has = opts.wallet.utxos.some(
      u =>
        u.token?.tokenId === opts.tokenId &&
        u.token.atoms != null &&
        BigInt(u.token.atoms) >= needAtoms,
    );
    if (!has) {
      await sleep(400 + attempt * 200);
      continue;
    }
    try {
      if (!pickBurnPostageUtxo(opts.wallet.utxos)) {
        await topUpOfferingPairFromDesk(opts.desk, opts.wallet);
      }
      const burned = await burnOnePrayer({
        wallet: opts.wallet,
        tokenId: opts.tokenId,
        note: opts.note,
        offeringId: OFFERING_ID_WLOTUS,
        parentBurnTxid: opts.parentBurnTxid,
        burnAtoms,
        changeScript: opts.desk.script,
        inventoryScript: opts.inventoryScript,
        minInventoryAtoms: minInventory,
      });
      return {
        txid: burned.txid,
        burnAtoms: burned.burnAtoms,
        inventoryAtoms: burned.inventoryAtoms,
      };
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
  for (const [id, pb] of pendingBurns) {
    if (pb.expiresAt <= now) pendingBurns.delete(id);
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
  return selectServingTips(tips, {
    count: SERVING_TIP_COUNT,
    offset: SERVING_TIP_OFFSET,
  });
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

function withP2shHex<
  T extends { address: string; p2shScript: { bytecode: Uint8Array } },
>(c: T, tipLocktime: number) {
  return {
    ...c,
    address: c.address,
    p2shScriptHex: toHex(c.p2shScript.bytecode),
    tipLocktime,
  };
}

/** Persist a tip discovered on-chain (open miner moved the baton). */
function persistFollowedTip(
  depPath: string,
  dep: DryrunDep,
  tips: BatonTip[],
  tipIndex: number,
  next: {
    tipLocktime: number;
    powAddress: string;
    lastRemintTxid: string;
    redeemScriptHex: string;
    codeHashHex: string;
  },
): void {
  const nextTips = tips.map(t =>
    t.index === tipIndex
      ? {
          ...t,
          tipLocktime: next.tipLocktime,
          powAddress: next.powAddress,
          lastRemintTxid: next.lastRemintTxid,
        }
      : t,
  );
  const updated = {
    ...dep,
    tipLocktime: nextTips[0]?.tipLocktime ?? next.tipLocktime,
    powAddress: nextTips[0]?.powAddress ?? next.powAddress,
    redeemScriptHex: next.redeemScriptHex,
    codeHashHex: next.codeHashHex,
    batonTips: nextTips,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(depPath, `${JSON.stringify(updated, null, 2)}\n`);
  const active = resolve(process.cwd(), 'deployments/mainnet-dryrun-active.json');
  if (existsSync(active)) {
    writeFileSync(active, `${JSON.stringify(updated, null, 2)}\n`);
  }
  for (const rel of [
    'deployments/mainnet-wlotus.json',
    'deployments/mainnet-dryrun-wlotus.json',
  ]) {
    const sibling = resolve(process.cwd(), rel);
    if (existsSync(sibling) && depPath !== sibling && isWlotusDeskDep(dep)) {
      writeFileSync(sibling, `${JSON.stringify(updated, null, 2)}\n`);
    }
  }
}

type FuelCoin = { txid: string; outIdx: number; sats: string };
type OfferingCoins = { fuel: FuelCoin; postage: FuelCoin };

function toFuelCoin(u: {
  outpoint: { txid: string; outIdx: number };
  sats: bigint;
}): FuelCoin {
  return {
    txid: u.outpoint.txid,
    outIdx: u.outpoint.outIdx,
    sats: u.sats.toString(),
  };
}

/**
 * Desk → tip: remint fuel + burn postage in **one** tx. Remint has no change
 * out, so fuel stays ~40 XEC. Postage leftover returns to the desk on burn.
 */
async function topUpOfferingPairFromDesk(
  desk: Wallet,
  tipWallet: Wallet,
): Promise<void> {
  await desk.sync();
  const pure = pureXecBalance(desk.utxos);
  const available =
    pure > DESK_TOPUP_RESERVE_SATS ? pure - DESK_TOPUP_RESERVE_SATS : 0n;
  if (available < OFFERING_PAIR_SATS) {
    throw new Error(
      `Tip fee wallet ${tipWallet.address} needs remint+postage and desk has no XEC to fund it. ` +
        `Run: npm run fund-tip-fee-wallets`,
    );
  }
  const pair = await sendOfferingPairFromDesk(desk, tipWallet);
  console.log(
    `desk→mint pair ${pair.txid} ` +
      `${Number(REMINT_FUEL_SATS) / 100}+${Number(pair.postage.sats) / 100} XEC ` +
      `${desk.address} → ${tipWallet.address} (change on desk)`,
  );
}

/**
 * One remint fuel + one postage UTXO per tip. Racers on the same tip share
 * them (only the winner broadcasts). Tips cannot spend each other's coins.
 */
function resolveOfferingPair(
  wallet: Wallet,
  tipIndex: number,
  batonTxid: string,
  batonOutIdx: number,
): OfferingCoins {
  const sibling =
    openChallengesOnTip(tipIndex).find(
      ch => ch.baton.txid === batonTxid && ch.baton.outIdx === batonOutIdx,
    ) ?? openChallengesOnTip(tipIndex)[0];
  if (sibling?.fuel && sibling?.postage) {
    return { fuel: { ...sibling.fuel }, postage: { ...sibling.postage } };
  }

  const fuelUtxo = pickSizedFuelUtxo(wallet.utxos);
  const postageUtxo = pickBurnPostageUtxo(wallet.utxos);
  if (!fuelUtxo || !postageUtxo) {
    throw new Error(
      'Tip fee wallet needs remint fuel and burn postage. Try again shortly.',
    );
  }
  return { fuel: toFuelCoin(fuelUtxo), postage: toFuelCoin(postageUtxo) };
}

async function ensureTipOfferingPair(
  desk: Wallet,
  tipWallet: Wallet,
  tipIndex: number,
  batonTxid: string,
  batonOutIdx: number,
): Promise<OfferingCoins> {
  try {
    return resolveOfferingPair(tipWallet, tipIndex, batonTxid, batonOutIdx);
  } catch {
    /* need to provision */
  }

  await tipWallet.sync();
  try {
    return resolveOfferingPair(tipWallet, tipIndex, batonTxid, batonOutIdx);
  } catch {
    /* continue */
  }

  await desk.sync();
  const hasFuel = Boolean(pickSizedFuelUtxo(tipWallet.utxos));
  const hasPostage = Boolean(pickBurnPostageUtxo(tipWallet.utxos));
  if (!hasFuel || !hasPostage) {
    const deskPure = pureXecBalance(desk.utxos);
    const deskAvail =
      deskPure > DESK_TOPUP_RESERVE_SATS
        ? deskPure - DESK_TOPUP_RESERVE_SATS
        : 0n;
    if (deskAvail >= OFFERING_PAIR_SATS) {
      await topUpOfferingPairFromDesk(desk, tipWallet);
    } else if (pickSplitSourceUtxo(tipWallet.utxos)) {
      const peeled = await peelOfferingPair(tipWallet, {
        fuelScript: tipWallet.script,
        changeScript: tipWallet.script,
      });
      if (peeled) {
        console.log(
          `mint local pair ${peeled.txid}: fuel+postage; change on mint receive`,
        );
      }
    } else {
      await topUpOfferingPairFromDesk(desk, tipWallet);
    }
  }

  return resolveOfferingPair(tipWallet, tipIndex, batonTxid, batonOutIdx);
}

async function createChallengeOnce(opts: {
  installId: string;
  note: string;
  parentBurnTxid?: string;
  ip?: string;
}): Promise<ChallengePublic> {
  expireStaleChallenges();
  if (installDailyCounter.remaining(opts.installId) <= 0) {
    throw new Error(
      `Daily limit reached (${MAX_OFFERS_PER_DAY} offerings per device).`,
    );
  }
  if (
    opts.ip !== undefined &&
    ipDailyCounter.remaining(normalizeClientIp(opts.ip)) <= 0
  ) {
    throw new Error(
      `Daily limit reached (${MAX_OFFERS_PER_DAY_PER_IP} offerings from this network).`,
    );
  }
  challengeIpWindow.consume(normalizeClientIp(opts.ip));
  // Same device replaces its own open job; others may keep racing tips.
  cancelOpenChallengesForInstall(opts.installId);
  expireStaleChallenges();
  if (countOpenChallenges() >= MAX_OPEN_CHALLENGES) {
    throw new Error(
      `Mint desk is at capacity (${MAX_OPEN_CHALLENGES} concurrent miners). Try again shortly.`,
    );
  }

  const { path: depPath, dep } = loadDep();
  const temple = isTempleDep(dep);
  const felt = isFeltDep(dep);
  const mooreTip = isMooreTipDep(dep);
  const wlotusDesk = isWlotusDeskDep(dep);
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  if (wlotusDesk) {
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
  // Death-date / relationship star fragments are creator-only (installId).
  if (parentBurnTxid && isDeathDateAmendNote(opts.note)) {
    if (!isKnownRootCreator(parentBurnTxid, opts.installId)) {
      throw new Error(
        'Only the profile creator can record a death date on this dedication',
      );
    }
  }
  if (parentBurnTxid && isRelationshipAmendNote(opts.note)) {
    if (!isKnownRootCreator(parentBurnTxid, opts.installId)) {
      throw new Error(
        'Only the profile creator can edit relationships on this dedication',
      );
    }
  }
  // Re-offer: DANA v2 — optional extra text + parent → original dedication.
  // Packed root altars are stripped to the remembrance slot only.
  const note = truncateUtf8Bytes(
    prepareDanaNote(opts.note, Boolean(parentBurnTxid)),
    memorialNoteMaxBytes(Boolean(parentBurnTxid)),
  );
  if (parentBurnTxid && !wlotusDesk) {
    throw new Error(
      'parentBurnTxid (re-offer) requires the wLotus burn path',
    );
  }
  const memorial = memorialPushdata(
    note,
    wlotusDesk ? OFFERING_ID_WLOTUS : OFFERING_ID_PRAYER,
    parentBurnTxid,
  );
  const templeHashHex = dep.templeScriptHashHex ?? dep.templePkhHex;
  if (temple && (!templeHashHex || templeHashHex.length !== 40)) {
    throw new Error('wLotus temple deployment missing templeScriptHashHex');
  }

  const chronik = await createChronik('closest');
  const startTxid =
    tipAnchorTxid(dep, tipRec) ?? dep.handoffTxids?.[tipRec.index] ?? dep.tokenId;
  const live = await resolveLiveMintBaton(chronik, dep.tokenId, startTxid);
  const locktimeGuesses = [
    tipRec.tipLocktime,
    dep.tipLocktime ?? 0,
    dep.genesisUnix,
  ];
  const contract = temple
    ? await matchCovenantToBaton(live, locktimeGuesses, async tipLocktime => {
        const c = await createPowRemintMooreTipTempleContract({
          tokenId: dep.tokenId,
          mintAtoms,
          templeScriptHash: fromHex(templeHashHex!),
          genesisUnix: dep.genesisUnix,
          baseZeroBits: dep.baseZeroBits,
          secondsPerExtraBit: dep.secondsPerExtraBit,
          tipLocktime,
        });
        return withP2shHex(c, tipLocktime);
      })
    : felt
      ? await matchCovenantToBaton(live, locktimeGuesses, async tipLocktime => {
          const c = await createPowRemintGlotusTipContract({
            tokenId: dep.tokenId,
            mintAtoms,
            genesisUnix: dep.genesisUnix,
            baseZeroBits: dep.baseZeroBits,
            secondsPerExtraBit: dep.secondsPerExtraBit,
            tipLocktime,
          });
          return withP2shHex(c, tipLocktime);
        })
      : mooreTip
        ? await matchCovenantToBaton(live, locktimeGuesses, async tipLocktime => {
            const c = await createPowRemintMooreTipContract({
              tokenId: dep.tokenId,
              mintAtoms,
              genesisUnix: dep.genesisUnix,
              baseZeroBits: dep.baseZeroBits,
              secondsPerExtraBit: dep.secondsPerExtraBit,
              tipLocktime,
            });
            return withP2shHex(c, tipLocktime);
          })
        : await matchCovenantToBaton(live, locktimeGuesses, async tipLocktime => {
            const c = await createPowRemintMooreTipMemoContract({
              tokenId: dep.tokenId,
              mintAtoms,
              genesisUnix: dep.genesisUnix,
              baseZeroBits: dep.baseZeroBits,
              secondsPerExtraBit: dep.secondsPerExtraBit,
              tipLocktime,
            });
            return withP2shHex(c, tipLocktime);
          });

  if (
    live.hops > 0 ||
    (tipRec.lastRemintTxid &&
      tipRec.lastRemintTxid.toLowerCase() !== live.creatingTxid) ||
    (tipRec.powAddress && tipRec.powAddress !== contract.address)
  ) {
    console.log(
      JSON.stringify({
        followedOnChainTip: true,
        hops: live.hops,
        from: startTxid,
        baton: `${live.txid}:${live.outIdx}`,
        address: contract.address,
        tipLocktime: contract.tipLocktime,
      }),
    );
    try {
      persistFollowedTip(depPath, dep, tips, tipRec.index, {
        tipLocktime: contract.tipLocktime,
        powAddress: contract.address,
        lastRemintTxid: live.creatingTxid,
        redeemScriptHex: contract.redeemHex,
        codeHashHex: toHex(contract.codeHash),
      });
    } catch (e) {
      console.warn(
        'Could not persist followed on-chain tip',
        e instanceof Error ? e.message : e,
      );
    }
    tipRec.tipLocktime = contract.tipLocktime;
    tipRec.powAddress = contract.address;
    tipRec.lastRemintTxid = live.creatingTxid;
  }

  const desk = await loadMintWallet(chronik);
  const tipFee = await loadTipFeeWallet(chronik, tipRec.index);
  console.log('mint desk', JSON.stringify(mintWalletSummary(desk)));
  console.log('tip fee', JSON.stringify(tipFeeWalletSummary(tipRec.index, tipFee)));

  const baton = {
    outpoint: { txid: live.txid, outIdx: live.outIdx },
    sats: live.sats,
    txid: live.txid,
    vout: live.outIdx,
  };

  const offering = await ensureTipOfferingPair(
    desk.wallet,
    tipFee.wallet,
    tipRec.index,
    baton.outpoint.txid,
    baton.outpoint.outIdx,
  );
  const fuelCoin = offering.fuel;

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
        contract: contract as unknown as Awaited<
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
    : felt
      ? await (async () => {
          const glotus = contract as Awaited<
            ReturnType<typeof createPowRemintGlotusTipContract>
          >;
          const nextContract = await createPowRemintGlotusTipContract({
            ...glotus.params,
            tipLocktime: locktime,
          });
          return buildMooreTipRemintChallenge({
            contract: glotus,
            baton,
            fuel: {
              outpoint: { txid: fuelCoin.txid, outIdx: fuelCoin.outIdx },
              sats: BigInt(fuelCoin.sats),
              outputScript: tipFee.wallet.script,
            },
            miner: { sk: tipFee.sk, pk: tipFee.pk },
            locktime,
            opReturn: expectedGlotusMintOpReturnScript(dep.tokenId, mintAtoms),
            nextContract,
          });
        })()
      : mooreTip
        ? await buildMooreTipRemintChallenge({
            contract: contract as Awaited<
              ReturnType<typeof createPowRemintMooreTipContract>
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
    mode: temple ? 'temple' : felt ? 'felt' : mooreTip ? 'moore-tip' : 'memo',
    tokenId: dep.tokenId,
    tipIndex: tipRec.index,
    tipLocktime: tipRec.tipLocktime,
    baton: {
      txid: baton.outpoint.txid,
      outIdx: baton.outpoint.outIdx,
      sats: baton.sats.toString(),
    },
    fuel: fuelCoin,
    postage: offering.postage,
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
    commit: temple
      ? MOORE_TIP_TEMPLE_POW_COMMIT
      : felt || mooreTip
        ? MOORE_TIP_POW_COMMIT
        : MOORE_TIP_MEMO_POW_COMMIT,
    nonceLength: temple
      ? MOORE_TIP_TEMPLE_NONCE_LENGTH
      : felt || mooreTip
        ? MOORE_TIP_NONCE_LENGTH
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
  prepared:
    | MooreTipMemoRemintPrepared
    | MooreTipTempleRemintPrepared
    | MooreTipRemintPrepared;
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

  let prepared:
    | MooreTipMemoRemintPrepared
    | MooreTipTempleRemintPrepared
    | MooreTipRemintPrepared;
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
  } else if (ch.mode === 'felt') {
    const contract = await createPowRemintGlotusTipContract({
      tokenId: ch.tokenId,
      mintAtoms: BigInt(ch.mintAtoms),
      genesisUnix: ch.genesisUnix,
      baseZeroBits: ch.baseZeroBits,
      secondsPerExtraBit: ch.secondsPerExtraBit,
      tipLocktime: ch.tipLocktime,
    });
    const nextContract = await createPowRemintGlotusTipContract({
      ...contract.params,
      tipLocktime: ch.locktime,
    });
    prepared = await buildMooreTipRemintChallenge({
      contract,
      baton,
      fuel,
      miner,
      locktime: ch.locktime,
      opReturn: expectedGlotusMintOpReturnScript(
        ch.tokenId,
        BigInt(ch.mintAtoms),
      ),
      nextContract,
    });
  } else if (ch.mode === 'moore-tip') {
    const contract = await createPowRemintMooreTipContract({
      tokenId: ch.tokenId,
      mintAtoms: BigInt(ch.mintAtoms),
      genesisUnix: ch.genesisUnix,
      baseZeroBits: ch.baseZeroBits,
      secondsPerExtraBit: ch.secondsPerExtraBit,
      tipLocktime: ch.tipLocktime,
    });
    prepared = await buildMooreTipRemintChallenge({
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
  ip?: string;
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
      : ch.mode === 'felt' || ch.mode === 'moore-tip'
        ? await buildMooreTipRemintTxWithNonce({
            prepared: prepared as MooreTipRemintPrepared,
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

  consumeOfferSlot(opts.installId, opts.ip);

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
  // Keep canonical wLotus json in sync when a sibling path was loaded
  for (const rel of [
    'deployments/mainnet-wlotus.json',
    'deployments/mainnet-dryrun-wlotus.json',
  ]) {
    const sibling = resolve(process.cwd(), rel);
    if (existsSync(sibling) && depPath !== sibling && isWlotusDeskDep(dep)) {
      writeFileSync(sibling, `${JSON.stringify(updated, null, 2)}\n`);
    }
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

  // Desk: remint now (tip race). Memorial burn is deferred to POST /api/burn
  // after the client's soft pray wait — cancel abandons burn; desk keeps the atom.
  if (ch.mode === 'temple' || ch.mode === 'felt' || ch.mode === 'moore-tip') {
    const remintKey = remintTxid.toLowerCase();
    const burnToken = newBurnToken();
    pendingBurns.set(remintKey, {
      remintTxid,
      installId: opts.installId,
      burnToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + PENDING_BURN_TTL_MS,
      tipIndex: ch.tipIndex,
      tokenId: ch.tokenId,
      note: ch.note,
      parentBurnTxid: ch.parentBurnTxid,
    });
    return {
      remintTxid,
      burnTxid: '',
      burnPending: true,
      burnToken,
      tokenId: dep.tokenId,
      bits: built.tip.bits,
      powAttempts,
      powMs,
      hashrateHps,
      deskAtomsKept: 1,
      note: ch.note,
      explorerRemint: explorerTx(remintTxid, process.env.DANA_EXPLORER_ORIGIN),
      explorerBurn: '',
    };
  }

  return {
    remintTxid,
    burnTxid: remintTxid,
    burnPending: false,
    tokenId: dep.tokenId,
    bits: built.tip.bits,
    powAttempts,
    powMs,
    hashrateHps,
    deskAtomsKept: 1,
    note: ch.note,
    explorerRemint: explorerTx(remintTxid, process.env.DANA_EXPLORER_ORIGIN),
    explorerBurn: explorerTx(remintTxid, process.env.DANA_EXPLORER_ORIGIN),
  };
}

async function completeBurnOnce(opts: {
  installId: string;
  remintTxid: string;
  burnToken: string;
}): Promise<BurnResult> {
  expireStaleChallenges();
  const remintTxid = opts.remintTxid.trim().toLowerCase();
  const pb = pendingBurns.get(remintTxid);
  if (!pb) {
    throw new Error('No pending memorial burn for this remint (expired or abandoned)');
  }
  if (pb.installId !== opts.installId) {
    throw new Error('remintTxid does not match installId');
  }
  if (!burnTokenMatches(pb.burnToken, opts.burnToken)) {
    throw new Error('Invalid burnToken');
  }
  if (pb.expiresAt <= Date.now()) {
    pendingBurns.delete(remintTxid);
    throw new Error('Pending memorial burn expired; miner atom kept by desk');
  }

  // Resolve burn at burn time (server clock). Outside active special → 1 flower.
  // Never reject — specials only raise the burn amount.
  const { dep } = loadDep();
  const { burnAtoms } = resolveOfferBurnAtoms({
    parentBurnTxid: pb.parentBurnTxid,
    globalCfg: specialsGlobalForDep(dep),
  });

  const chronik = await createChronik('closest');
  const tipFee = await loadTipFeeWallet(chronik, pb.tipIndex);
  const desk = await loadMintWallet(chronik);
  const sink = resolveTempleSinkFromEnv();
  const templeHashHex = dep.templeScriptHashHex ?? dep.templePkhHex;
  const inventoryScript = sink
    ? sink.script
    : templeHashHex && templeHashHex.length === 40
      ? Script.p2sh(fromHex(templeHashHex))
      : null;
  if (!inventoryScript) {
    throw new Error(
      'TEMPLE_ADDRESS required to list an offering (send leftover WLOTUS with the burn)',
    );
  }
  const minInventory =
    sink || isFeltDep(dep) || isMooreTipDep(dep)
      ? WLOTUS_SOFT_TEMPLE_ATOMS
      : 0n;
  const burned = await burnMinerAtomAfterMint({
    wallet: tipFee.wallet,
    desk: desk.wallet,
    tokenId: pb.tokenId,
    note: pb.note,
    parentBurnTxid: pb.parentBurnTxid,
    burnAtoms,
    inventoryScript,
    minInventoryAtoms: minInventory,
  });
  pendingBurns.delete(remintTxid);
  if (!pb.parentBurnTxid) {
    rememberRootCreator(burned.txid, opts.installId);
  }
  notifyDanaIndex(burned.txid);

  const deskKeep = sink
    ? 0
    : Number(deskMinerAtoms(dep) - burned.burnAtoms);
  return {
    remintTxid: pb.remintTxid,
    burnTxid: burned.txid,
    tokenId: pb.tokenId,
    deskAtomsKept: deskKeep < 0 ? 0 : deskKeep,
    burnAtoms: burned.burnAtoms.toString(),
    note: pb.note,
    explorerRemint: explorerTx(pb.remintTxid, process.env.DANA_EXPLORER_ORIGIN),
    explorerBurn: explorerTx(burned.txid, process.env.DANA_EXPLORER_ORIGIN),
  };
}

/**
 * Drop pending memorial burn — remint already mined; desk keeps the miner atom.
 * Abandoning a specific remint requires the submit-issued burnToken.
 */
function abandonPendingBurns(opts: {
  installId: string;
  remintTxid?: string;
  burnToken?: string;
}): number {
  expireStaleChallenges();
  let n = 0;
  const want = opts.remintTxid?.trim().toLowerCase();
  if (want) {
    const pb = pendingBurns.get(want);
    if (!pb || pb.installId !== opts.installId) return 0;
    if (!burnTokenMatches(pb.burnToken, opts.burnToken)) {
      throw new Error('Invalid burnToken');
    }
    pendingBurns.delete(want);
    return 1;
  }
  // No remintTxid: only clear pending burns when burnToken matches each entry —
  // do not mass-abandon by installId alone (installId is a weak bearer).
  for (const [id, pb] of [...pendingBurns.entries()]) {
    if (pb.installId !== opts.installId) continue;
    if (!burnTokenMatches(pb.burnToken, opts.burnToken)) continue;
    pendingBurns.delete(id);
    n++;
  }
  return n;
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
  ip?: string;
}): Promise<ChallengePublic> {
  return withChainLock(() =>
    createChallengeOnce({
      installId: opts.installId,
      note: opts.note ?? '',
      parentBurnTxid: opts.parentBurnTxid,
      ip: opts.ip,
    }),
  );
}

export function enqueueSubmit(opts: {
  installId: string;
  challengeId: string;
  nonceHex: string;
  powMs?: number;
  powAttempts?: number;
  ip?: string;
}): Promise<OfferResult> {
  return withChainLock(() => submitChallengeOnce(opts));
}

export function enqueueBurn(opts: {
  installId: string;
  remintTxid: string;
  burnToken: string;
}): Promise<BurnResult> {
  return withChainLock(() => completeBurnOnce(opts));
}

/**
 * Soft ownership check for a root dedication. Never returns the stored
 * installId — only whether the caller matches (or unknown).
 */
export function checkRootCreator(opts: {
  rootBurnTxid: string;
  installId: string;
}): { ok: true; isCreator: boolean; known: boolean } {
  const match = rootCreatorMatch(opts.rootBurnTxid, opts.installId);
  return {
    ok: true,
    known: match !== null,
    isCreator: match === true,
  };
}

/** Release an open challenge (cancel mining / page reload cleanup). */
export function cancelChallenge(opts: {
  installId: string;
  challengeId?: string;
  remintTxid?: string;
  burnToken?: string;
}): { ok: true; cancelled: number; abandonedBurns: number } {
  expireStaleChallenges();
  let cancelled = 0;
  for (const ch of challenges.values()) {
    if (ch.status !== 'open') continue;
    if (ch.installId !== opts.installId) continue;
    if (opts.challengeId && ch.id !== opts.challengeId) continue;
    ch.status = 'expired';
    cancelled++;
  }
  const abandonedBurns = abandonPendingBurns({
    installId: opts.installId,
    remintTxid: opts.remintTxid,
    burnToken: opts.burnToken,
  });
  return { ok: true, cancelled, abandonedBurns };
}

/** Serialize cancel with challenge/submit so a re-Offer cannot race a stale lock. */
export function enqueueCancel(opts: {
  installId: string;
  challengeId?: string;
  remintTxid?: string;
  burnToken?: string;
}): Promise<{ ok: true; cancelled: number; abandonedBurns: number }> {
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
  /**
   * Temple-managed ghosts / heroes. Outside an active window the profile is
   * still offerable (1 flower). During the window burn uses global deskKeep.
   */
  templeSpecials: ReturnType<typeof resolveTempleSpecialsStatus>;
} {
  try {
    const { dep } = loadDep();
    const wlotusDesk = isWlotusDeskDep(dep);
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
      ticker: dep.ticker ?? (wlotusDesk ? 'WLOTUS' : 'dPRAYER'),
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
      memorialOnMint: !wlotusDesk,
      memorialOnBurn: wlotusDesk,
      tipFeeAccounts: true,
      templeSpecials: resolveTempleSpecialsStatus(
        loadTempleSpecialsFromEnv(),
        specialsGlobalForDep(dep),
      ),
    };
  } catch (err) {
    if (err instanceof AbandonedDeskError) throw err;
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
      templeSpecials: resolveTempleSpecialsStatus(),
    };
  }
}
