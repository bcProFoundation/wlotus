#!/usr/bin/env tsx
/**
 * Create on-chain root altars for temple public specials (Vu Lan + Cô Hồn),
 * then print the TEMPLE_SPECIALS_JSON snippet to register them.
 *
 * Why on-chain first (not JSON-only):
 *   - dana-index / search only see real DANA memorial burns
 *   - re-offers need a real parentBurnTxid (root)
 *   - temple specials only raise the burn amount for a registered profileId
 *
 * Funding (same test + prod path):
 *   1. Prefer existing desk/tip inventory (1 atom per root).
 *   2. If short, auto-remint once via MooreTipTemple (tip fee wallet = miner)
 *      so ~102 miner atoms land on the tip, persist the new baton tip into
 *      every matching deployments/*wlotus*.json, restart mint-api, wait until
 *      Chronik shows the miner UTXO, then burn the roots.
 *   Disable auto-remint with CREATE_TEMPLE_SPECIALS_NO_MINT=1.
 *
 * Dry-run encodes notes only — it does **not** remint or burn. Empty inventory
 * is a warning, not a failure. Unset CREATE_TEMPLE_SPECIALS_DRY_RUN to mint.
 *
 * Kinds / windows:
 *   - Vu Lan  → kind "event", full civil day of lunar 15/7
 *   - Cô Hồn  → kind "ghost", lunar 2/7 00:00 → 15/7 12:00 local
 *     (JSON: eventStart, eventEnd, eventEndHour=12)
 *
 * On-chain note is kept short (ALP BURN + DANA ≤ 223 OP_RETURN). Long stories
 * live in templeSpecials defaultTempleStory, not the root burn.
 *
 * Usage (Contabo / local with mint.env):
 *   set -a && source /etc/wlotus/mint.env && set +a
 *   npm run create-temple-specials
 *
 * Dry-run (encode + plan, no broadcast):
 *   CREATE_TEMPLE_SPECIALS_DRY_RUN=1 npm run create-temple-specials
 *
 * Optional env:
 *   TOKEN_ID                 — else from deployments/*-wlotus.json matching id
 *   MINT_MNEMONIC            — desk phrase (tip HD wallets; required for remint)
 *   MINT_SERVING_TIP_COUNT   — tip accounts to scan (default 28)
 *   BATON_INDEX              — baton tip to remint (default 0)
 *   EVENT_LUNAR_YMD          — peak day, default 2026-07-15
 *   EVENT_LUNAR_START        — Cô Hồn start, default 2026-07-02
 *   EVENT_YEAR               — year for those defaults
 *   CREATE_TEMPLE_SPECIALS_NO_MINT=1     — never auto-remint
 *   CREATE_TEMPLE_SPECIALS_NO_RESTART=1  — skip mint-api restart after tip advance
 *   MINT_API_SERVICE                     — systemd unit (default wlotus-mint-api)
 *
 * After auto-remint the script writes tipLocktime / powAddress / lastRemintTxid
 * into every deployments JSON with the same tokenId (so mint-api cannot keep a
 * spent P2SH), then restarts mint-api so the process reloads the tip.
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import type { Wallet } from 'ecash-wallet';
import { fromHex, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { loadTipFeeWallet } from '../src/mint/loadTipFeeWallet.js';
import { loadMintWallet } from '../src/mint/loadMintWallet.js';
import {
  pickSizedFuelUtxo,
} from '../src/mint/fuelUtxo.js';
import {
  peelSizedFuel,
  sendSizedFuelFromDesk,
} from '../src/mint/peelSizedFuel.js';
import {
  burnOnePrayer,
  OFFERING_ID_WLOTUS,
} from '../src/offering/burnPrayer.js';
import {
  encodeAltarNote,
  emptyAltarFields,
  type AltarFields,
} from '../src/offering/altarFields.js';
import { lunarYmdToSolarYmd } from '../src/lib/lunarCalendar.js';
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import {
  buildMinedMooreTipTempleRemintTx,
  mooreTipTempleMinerBanner,
} from '../src/miner/remintMooreTipTemple.js';
import { WLOTUS_MINER_ATOMS } from '../src/params/wlotusMint.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const DRY = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_DRY_RUN?.trim() || '',
);
const NO_MINT = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_NO_MINT?.trim() || '',
);
const NO_RESTART = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_NO_RESTART?.trim() || '',
);
const MINT_API_SERVICE =
  process.env.MINT_API_SERVICE?.trim() || 'wlotus-mint-api';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface SpecialSpec {
  name: string;
  kind: 'ghost' | 'hero' | 'event';
  altarName: string;
  note: string;
  eventDate: string;
  eventCalendar: 'lunar' | 'solar';
  /** Multi-day range start (same calendar as eventDate). */
  eventStart?: string;
  /** Multi-day range end (same calendar as eventDate). */
  eventEnd?: string;
  /** Hour 0–23 on end civil day when window closes (Cô Hồn = 12). */
  eventEndHour?: number;
}

interface BatonTip {
  index: number;
  tipLocktime: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface WlotusDep {
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
  templePkhHex?: string | null;
  batonTips?: BatonTip[];
  redeemScriptHex?: string;
  codeHashHex?: string;
  handoffTxids?: string[];
}

function loadTokenId(): string {
  const env = process.env.TOKEN_ID?.trim();
  if (env && /^[0-9a-fA-F]{64}$/.test(env)) return env.toLowerCase();
  for (const rel of [
    'deployments/mainnet-wlotus.json',
    'deployments/mainnet-dryrun-wlotus.json',
    'deployments/mainnet-dryrun-active.json',
  ]) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) continue;
    const dep = JSON.parse(readFileSync(path, 'utf8')) as { tokenId?: string };
    if (dep.tokenId && /^[0-9a-fA-F]{64}$/.test(dep.tokenId)) {
      return dep.tokenId.toLowerCase();
    }
  }
  throw new Error(
    'Set TOKEN_ID or create deployments/mainnet-wlotus.json (or dryrun)',
  );
}

function deploymentCandidates(): string[] {
  const explicit = process.env.MINT_DEPLOYMENT_JSON?.trim();
  const requireLive = /^(1|true|yes)$/i.test(
    process.env.MINT_REQUIRE_LIVE?.trim() || '',
  );
  if (explicit) return [explicit];
  if (requireLive) return ['deployments/mainnet-wlotus.json'];
  return [
    'deployments/mainnet-wlotus.json',
    'deployments/mainnet-dryrun-wlotus.json',
    'deployments/mainnet-dryrun-active.json',
  ];
}

function loadDepForToken(tokenId: string): { path: string; dep: WlotusDep } {
  const want = tokenId.toLowerCase();
  for (const rel of deploymentCandidates()) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) continue;
    const dep = JSON.parse(readFileSync(path, 'utf8')) as WlotusDep;
    if (dep.tokenId?.toLowerCase() === want) return { path, dep };
  }
  throw new Error(
    `No deployment JSON with tokenId=${tokenId}. Set MINT_DEPLOYMENT_JSON or TOKEN_ID to the live genesis file.`,
  );
}

/** Write the advanced baton tip into every JSON that already holds this tokenId. */
function persistTipAdvance(tokenId: string, updated: WlotusDep): string[] {
  const want = tokenId.toLowerCase();
  const rels = [
    ...deploymentCandidates(),
    'deployments/mainnet-wlotus.json',
    'deployments/mainnet-dryrun-wlotus.json',
    'deployments/mainnet-dryrun-active.json',
  ];
  const written: string[] = [];
  const seen = new Set<string>();
  for (const rel of rels) {
    const path = resolve(process.cwd(), rel);
    if (seen.has(path) || !existsSync(path)) continue;
    seen.add(path);
    const cur = JSON.parse(readFileSync(path, 'utf8')) as WlotusDep;
    if (cur.tokenId?.toLowerCase() !== want) continue;
    writeFileSync(
      path,
      `${JSON.stringify({ ...cur, ...updated, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    );
    written.push(rel);
    console.log(`  persisted baton tip → ${rel}`);
  }
  if (written.length === 0) {
    throw new Error(
      `Remint succeeded but no deployments JSON with tokenId=${tokenId} to persist the new tip`,
    );
  }
  return written;
}

function restartMintApi(): void {
  if (NO_RESTART) {
    console.log('Skipping mint-api restart (CREATE_TEMPLE_SPECIALS_NO_RESTART=1)');
    return;
  }
  try {
    execFileSync(
      'sudo',
      ['-n', 'systemctl', 'try-restart', MINT_API_SERVICE],
      { stdio: 'inherit' },
    );
    console.log(`Restarted ${MINT_API_SERVICE} so it reloads the new baton tip`);
  } catch {
    console.warn(
      `WARN: could not restart ${MINT_API_SERVICE}. Restart it yourself so mint-api does not remint a spent P2SH.`,
    );
  }
}

function defaultSpecs(): SpecialSpec[] {
  const year = process.env.EVENT_YEAR?.trim() || '2026';
  const lunarPeak =
    process.env.EVENT_LUNAR_YMD?.trim() || `${year}-07-15`; // 15/7 âm lịch
  const lunarStart =
    process.env.EVENT_LUNAR_START?.trim() || `${year}-07-02`; // 2/7 âm lịch
  return [
    {
      name: 'Vu Lan',
      kind: 'event',
      altarName: 'Vu Lan',
      // Keep on-chain note tiny — ALP BURN + DANA must fit OP_RETURN ≤ 223.
      // Long story is served from templeSpecials (defaultTempleStory), not the root.
      note: 'Vu Lan Báo Hiếu',
      eventDate: lunarPeak,
      eventCalendar: 'lunar',
      // single civil day of lunar 15/7 (eventStart/End omitted → = eventDate)
    },
    {
      name: 'Cô Hồn',
      kind: 'ghost',
      altarName: 'Cô Hồn',
      note: 'Cúng Cô Hồn',
      eventDate: lunarPeak,
      eventCalendar: 'lunar',
      // Product: local 00:00 lunar 2/7 → 12:00 lunar 15/7
      eventStart: lunarStart,
      eventEnd: lunarPeak,
      eventEndHour: 12,
    },
  ];
}

/** Solar YYYY-MM-DD for altar deathDate (must be set so the root is re-offerable). */
function deathDateForSpec(spec: SpecialSpec): string {
  if (spec.eventCalendar === 'solar') return spec.eventDate;
  const solar = lunarYmdToSolarYmd(spec.eventDate, 7, false);
  if (!solar) {
    throw new Error(
      `Cannot convert lunar eventDate ${spec.eventDate} → solar for deathDate`,
    );
  }
  return solar;
}

function buildAltarNote(spec: SpecialSpec): string {
  const fields: AltarFields = {
    ...emptyAltarFields(),
    name: spec.altarName,
    note: spec.note,
    // Solar civil day of the festival peak — required so the root is re-offerable
    // (living profiles cannot take flower re-offers). Same calendar day the
    // special window uses after lunar→solar conversion.
    deathDate: deathDateForSpec(spec),
  };
  // Root DANA v1 (no parent). Soft cap leaves room for ALP BURN in the same
  // OP_RETURN (≤ 223). Empirical headroom is tighter than the 150 constant when
  // Vietnamese multi-byte text is present — stay well under.
  return encodeAltarNote(fields, { maxBytes: 100 });
}

function registryEntry(
  profileId: string,
  spec: SpecialSpec,
): Record<string, string | number> {
  const base: Record<string, string | number> = {
    profileId,
    kind: spec.kind,
    eventDate: spec.eventDate,
    eventCalendar: spec.eventCalendar,
    name: spec.name,
  };
  if (spec.eventStart) base.eventStart = spec.eventStart;
  if (spec.eventEnd) base.eventEnd = spec.eventEnd;
  if (spec.eventEndHour != null) base.eventEndHour = spec.eventEndHour;
  return base;
}

interface TokenHolder {
  label: string;
  tipIndex: number | null;
  wallet: Wallet;
  atoms: bigint;
}

async function scanInventory(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  tokenId: string,
): Promise<TokenHolder[]> {
  const tipCount = Math.max(
    1,
    Math.min(
      28,
      Math.floor(
        Number(process.env.MINT_SERVING_TIP_COUNT?.trim() || '28') || 28,
      ),
    ),
  );

  const holders: TokenHolder[] = [];

  if (process.env.MINT_MNEMONIC?.trim()) {
    for (let i = 0; i < tipCount; i++) {
      try {
        const tip = await loadTipFeeWallet(chronik, i);
        const atoms = tip.wallet.utxos
          .filter(
            u =>
              u.token?.tokenId === tokenId &&
              !u.token?.isMintBaton &&
              u.token.atoms != null,
          )
          .reduce((s, u) => s + BigInt(u.token!.atoms!), 0n);
        if (atoms > 0n) {
          holders.push({
            label: `tip-${i}`,
            tipIndex: i,
            wallet: tip.wallet,
            atoms,
          });
        }
      } catch {
        /* skip tips that cannot be derived */
      }
    }
  }

  try {
    const desk = await loadMintWallet(chronik);
    const atoms = desk.wallet.utxos
      .filter(
        u =>
          u.token?.tokenId === tokenId &&
          !u.token?.isMintBaton &&
          u.token.atoms != null,
      )
      .reduce((s, u) => s + BigInt(u.token!.atoms!), 0n);
    if (atoms > 0n) {
      holders.push({
        label: 'desk',
        tipIndex: null,
        wallet: desk.wallet,
        atoms,
      });
    }
  } catch {
    /* no desk key */
  }

  holders.sort((a, b) => (a.atoms < b.atoms ? 1 : a.atoms > b.atoms ? -1 : 0));
  return holders;
}

/**
 * One MooreTipTemple remint with tip fee wallet as miner → miner share
 * (102 atoms) lands on that tip for subsequent root burns.
 */
async function remintForInventory(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  tokenId: string,
): Promise<{ tipIndex: number; remintTxid: string; atomsMinted: string }> {
  const { path: depPath, dep } = loadDepForToken(tokenId);
  const isTemple =
    dep.tier === 'wlotus' ||
    dep.covenant === 'WlotusPowRemintMooreTipTemple' ||
    Boolean(dep.templeScriptHashHex || dep.templePkhHex);
  if (!isTemple) {
    throw new Error(
      `Deployment ${depPath} is not MooreTipTemple — cannot auto-remint for specials`,
    );
  }

  const templeHashHex = dep.templeScriptHashHex ?? dep.templePkhHex;
  if (!templeHashHex || templeHashHex.length !== 40) {
    throw new Error('Deployment missing templeScriptHashHex (20-byte hex)');
  }

  const mintAtoms = BigInt(dep.mintAtomsPerRemint || '108');
  const batonIndex = Math.max(
    0,
    Math.floor(Number(process.env.BATON_INDEX?.trim() || '0') || 0),
  );
  const tips: BatonTip[] =
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

  if (!process.env.MINT_MNEMONIC?.trim()) {
    throw new Error(
      'MINT_MNEMONIC required to remint (tip fee wallet receives miner inventory)',
    );
  }

  const tipFee = await loadTipFeeWallet(chronik, tipRec.index);
  console.log(
    `Auto-remint on tip-${tipRec.index} (${tipFee.address}) to fund inventory…`,
  );

  await ensureTipSizedFuel(chronik, tipFee.wallet, tipRec.index);

  await tipFee.wallet.sync();
  const fuelUtxo = pickSizedFuelUtxo(tipFee.wallet.utxos);
  if (!fuelUtxo) {
    throw new Error(
      `No sized remint fuel on tip-${tipRec.index} after peel/top-up`,
    );
  }

  const contract = await createPowRemintMooreTipTempleContract({
    tokenId,
    mintAtoms,
    templeScriptHash: fromHex(templeHashHex),
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    tipLocktime: tipRec.tipLocktime,
  });
  console.log(mooreTipTempleMinerBanner(contract));
  if (tipRec.powAddress && tipRec.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: tip=${tipRec.powAddress} computed=${contract.address}. ` +
        'Deployment tipLocktime/powAddress may be stale — update from mint-api status or last remint.',
    );
  }

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
  ).filter(u => u.token?.tokenId === tokenId && u.token?.isMintBaton);
  if (batonUtxos.length === 0) {
    throw new Error(`No PoW batons at ${contract.address}`);
  }
  const preferredAnchor =
    tipRec.lastRemintTxid ?? dep.handoffTxids?.[tipRec.index] ?? null;
  const preferred = preferredAnchor
    ? batonUtxos.find(u => u.outpoint.txid === preferredAnchor)
    : undefined;
  const b = preferred ?? batonUtxos[tipRec.index] ?? batonUtxos[0]!;
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid,
    vout: b.outpoint.outIdx,
  };

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  const locktime = Number(
    process.env.MOORE_TIP_LOCKTIME?.trim() ||
      Math.max(tipRec.tipLocktime, mtp - 1),
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

  console.log(
    JSON.stringify(
      {
        autoRemint: true,
        tokenId,
        tipIndex: tipRec.index,
        baton: `${baton.txid}:${baton.vout}`,
        locktime,
        mtp,
        tipLocktime: tipRec.tipLocktime,
        baseZeroBits: dep.baseZeroBits,
      },
      null,
      2,
    ),
  );

  const built = await buildMinedMooreTipTempleRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: fuelUtxo.outpoint,
      sats: fuelUtxo.sats,
      outputScript: tipFee.wallet.script,
    },
    miner: { sk: tipFee.sk, pk: tipFee.pk },
    locktime,
  });

  const broadcast = await chronik.broadcastTx(built.txHex);
  const remintTxid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;
  console.log(
    `  remint OK ${remintTxid} (bits=${built.tip.bits} attempts=${built.powAttempts})`,
  );

  // Persist tip advance on every JSON with this tokenId, then restart mint-api.
  // Old bug: only one file was written, mint-api kept the spent P2SH in memory,
  // and the next remint/burn looked at the old baton.
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
  const updated: WlotusDep = {
    ...dep,
    tipLocktime: nextTips.find(t => t.index === tipRec.index)?.tipLocktime ??
      built.tip.locktime,
    powAddress:
      nextTips.find(t => t.index === tipRec.index)?.powAddress ??
      built.nextContract.address,
    redeemScriptHex: built.nextContract.redeemHex,
    codeHashHex: toHex(built.nextContract.codeHash),
    batonTips: nextTips,
  };
  persistTipAdvance(tokenId, updated);
  restartMintApi();

  return {
    tipIndex: tipRec.index,
    remintTxid,
    atomsMinted: WLOTUS_MINER_ATOMS.toString(),
  };
}

/** Desk → tip ~40 XEC fuel; peel on tip only if the desk cannot fund. */
async function ensureTipSizedFuel(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  tipWallet: Wallet,
  tipIndex: number,
): Promise<void> {
  await tipWallet.sync();
  if (pickSizedFuelUtxo(tipWallet.utxos)) return;

  try {
    const desk = await loadMintWallet(chronik);
    const txid = await sendSizedFuelFromDesk(desk.wallet, tipWallet);
    console.log(`  desk→tip-${tipIndex} sized fuel ${txid}`);
    return;
  } catch (e) {
    console.log(
      `  desk→tip fuel failed (${e instanceof Error ? e.message : e}); trying local peel`,
    );
  }

  await tipWallet.sync();
  const peeled = await peelSizedFuel(tipWallet, {
    fuelScript: tipWallet.script,
    changeScript: tipWallet.script,
  });
  if (peeled) console.log(`  tip fuel peel ${peeled}`);
}

async function ensureInventory(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  tokenId: string,
  needAtoms: bigint,
): Promise<TokenHolder> {
  let holders = await scanInventory(chronik, tokenId);
  let total = holders.reduce((s, h) => s + h.atoms, 0n);
  console.log(
    JSON.stringify(
      {
        inventoryScan: holders.map(h => ({
          label: h.label,
          atoms: h.atoms.toString(),
        })),
        totalAtoms: total.toString(),
        needAtoms: needAtoms.toString(),
      },
      null,
      2,
    ),
  );

  let pick = holders.find(h => h.atoms >= needAtoms);
  if (pick) return pick;

  if (DRY) {
    console.log(
      `Dry-run: need ≥ ${needAtoms} inventory atoms (found ${total}). ` +
        `Live run will auto-remint ~${WLOTUS_MINER_ATOMS} miner atoms onto the tip. ` +
        `Unset CREATE_TEMPLE_SPECIALS_DRY_RUN to mint + burn.`,
    );
    const tip = await loadTipFeeWallet(
      chronik,
      Math.max(0, Math.floor(Number(process.env.BATON_INDEX?.trim() || '0') || 0)),
    );
    return {
      label: 'auto-remint-on-live',
      tipIndex: 0,
      wallet: tip.wallet,
      atoms: 0n,
    };
  }
  if (NO_MINT) {
    throw new Error(
      `Need ≥ ${needAtoms} inventory atoms on desk/tip wallets (found ${total}). ` +
        'Unset CREATE_TEMPLE_SPECIALS_NO_MINT to auto-remint, or run a sponsored offering first.',
    );
  }

  console.log(
    `\nInventory short (${total} < ${needAtoms}) — auto-reminting once to fund tip…\n`,
  );
  const minted = await remintForInventory(chronik, tokenId);
  console.log(
    `Remint ${minted.remintTxid} → tip-${minted.tipIndex} (+~${minted.atomsMinted} miner atoms)`,
  );

  pick = await waitForInventory(chronik, tokenId, needAtoms);
  return pick;
}

async function waitForInventory(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  tokenId: string,
  needAtoms: bigint,
  attempts = 20,
): Promise<TokenHolder> {
  let lastTotal = 0n;
  for (let i = 1; i <= attempts; i++) {
    const holders = await scanInventory(chronik, tokenId);
    const total = holders.reduce((s, h) => s + h.atoms, 0n);
    lastTotal = total;
    const pick = holders.find(h => h.atoms >= needAtoms);
    console.log(
      JSON.stringify({
        inventoryWait: i,
        totalAtoms: total.toString(),
        holders: holders.map(h => ({ label: h.label, atoms: h.atoms.toString() })),
      }),
    );
    if (pick) return pick;
    await sleep(1_500);
  }
  throw new Error(
    `After remint still need ≥ ${needAtoms} atoms (found ${lastTotal} after ${attempts} syncs). ` +
      'Check TOKEN_ID, Chronik, and that the remint miner output landed on the tip fee wallet.',
  );
}

async function main(): Promise<void> {
  const tokenId = loadTokenId();
  const specs = defaultSpecs();
  const needAtoms = BigInt(specs.length); // 1 flower per root

  console.log(
    JSON.stringify(
      {
        dryRun: DRY,
        autoMintIfShort: !NO_MINT,
        tokenId,
        specials: specs.map(s => ({
          name: s.name,
          kind: s.kind,
          eventDate: s.eventDate,
          eventCalendar: s.eventCalendar,
          eventStart: s.eventStart ?? null,
          eventEnd: s.eventEnd ?? null,
          eventEndHour: s.eventEndHour ?? null,
          deathDateSolar: deathDateForSpec(s),
        })),
      },
      null,
      2,
    ),
  );

  const chronik = await createChronik('closest');
  const holder = await ensureInventory(chronik, tokenId, needAtoms);
  console.log(`Using inventory from ${holder.label} (${holder.atoms} atoms)`);
  if (DRY && holder.atoms < needAtoms) {
    console.log(
      'Dry-run will not remint or burn. Re-run without CREATE_TEMPLE_SPECIALS_DRY_RUN=1.',
    );
  }

  const created: Array<{
    name: string;
    kind: string;
    eventDate: string;
    eventCalendar: string;
    eventStart?: string;
    eventEnd?: string;
    eventEndHour?: number;
    profileId: string;
    explorer: string;
    notePreview: string;
  }> = [];

  for (const spec of specs) {
    const note = buildAltarNote(spec);
    console.log(
      `\n→ ${spec.name}: noteBytes=${new TextEncoder().encode(note).length}` +
        (spec.eventStart
          ? ` window=${spec.eventStart}→${spec.eventEnd ?? spec.eventDate}` +
            (spec.eventEndHour != null ? ` @${spec.eventEndHour}:00` : '')
          : ''),
    );

    if (DRY) {
      created.push({
        name: spec.name,
        kind: spec.kind,
        eventDate: spec.eventDate,
        eventCalendar: spec.eventCalendar,
        eventStart: spec.eventStart,
        eventEnd: spec.eventEnd,
        eventEndHour: spec.eventEndHour,
        profileId: '(dry-run — not broadcast)',
        explorer: '',
        notePreview: note.slice(0, 80),
      });
      continue;
    }

    await holder.wallet.sync();
    const { txid } = await burnOnePrayer({
      wallet: holder.wallet,
      tokenId,
      note,
      offeringId: OFFERING_ID_WLOTUS,
      // root dedication — no parent
      burnAtoms: 1n,
    });

    created.push({
      name: spec.name,
      kind: spec.kind,
      eventDate: spec.eventDate,
      eventCalendar: spec.eventCalendar,
      eventStart: spec.eventStart,
      eventEnd: spec.eventEnd,
      eventEndHour: spec.eventEndHour,
      profileId: txid.toLowerCase(),
      explorer: `https://explorer.e.cash/tx/${txid}`,
      notePreview: note.slice(0, 80),
    });
    console.log(`  burnTxid ${txid}`);
  }

  const registry = created.map(c => {
    const spec = specs.find(s => s.name === c.name)!;
    return registryEntry(
      /^[0-9a-f]{64}$/.test(c.profileId) ? c.profileId : c.profileId,
      spec,
    );
  });
  // Only emit settable JSON for real profileIds
  const liveRegistry = created
    .filter(c => /^[0-9a-f]{64}$/.test(c.profileId))
    .map(c => {
      const spec = specs.find(s => s.name === c.name)!;
      return registryEntry(c.profileId, spec);
    });

  const outDir = resolve(process.cwd(), 'deployments');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'temple-specials-created.json');
  const payload = {
    createdAt: new Date().toISOString(),
    dryRun: DRY,
    tokenId,
    inventoryFrom: holder.label,
    created,
    TEMPLE_SPECIALS_JSON: liveRegistry.length > 0 ? liveRegistry : registry,
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log('\n=== Result ===');
  console.log(JSON.stringify(payload, null, 2));
  if (!DRY && liveRegistry.length > 0) {
    console.log('\nSet on mint-api / Contabo and matching VITE_* for SPA:\n');
    console.log(`TEMPLE_SPECIALS_JSON='${JSON.stringify(liveRegistry)}'`);
    console.log(`\nWrote ${outPath}`);
  } else if (DRY) {
    console.log(
      '\nDry-run only — re-run without CREATE_TEMPLE_SPECIALS_DRY_RUN=1 to broadcast.',
    );
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
