#!/usr/bin/env tsx
/**
 * Optional overlay / temple-root helper for public specials.
 *
 * Default: **no burns**. The catalog lives in
 * `src/params/templeSpecialCatalog.ts`. Visitors find unbound specials in
 * Search and Home Events; the first offering becomes the on-chain root
 * (`POST /api/specials/claim`). Temple does not need to pre-burn — there
 * will be many specials.
 *
 * This script still helps ops:
 *   - Merge live Vu Lan / Cô Hồn `profileId`s + `countries` into JSON
 *   - Optionally burn temple roots if `CREATE_TEMPLE_SPECIALS_BURN=1`
 *
 * Catalog (see templeSpecialCatalog.ts): VN / ZH / EN heroes, events, ghosts.
 *
 * Default (JSON overlay only, no wallet):
 *   npm run create-temple-specials
 *
 * Optional temple burns (legacy / ops choice):
 *   CREATE_TEMPLE_SPECIALS_BURN=1 npm run create-temple-specials
 *
 * Dry-run encodes notes only — it does **not** remint or burn.
 *
 * Funding (burn mode only):
 *   1. Prefer existing desk/tip inventory (1 atom per root).
 *   2. If short, auto-remint once via MooreTipTemple.
 *   Disable auto-remint with CREATE_TEMPLE_SPECIALS_NO_MINT=1.
 *
 * Optional env:
 *   EVENT_YEAR               — year for catalog dates (default 2026)
 *   CREATE_TEMPLE_SPECIALS_IDS — comma list of catalog ids to include
 *   CREATE_TEMPLE_SPECIALS_BURN=1        — desk-burn missing catalog roots
 *   CREATE_TEMPLE_SPECIALS_MERGE_ONLY=1  — alias of default (no burn)
 *   CREATE_TEMPLE_SPECIALS_NO_MINT=1     — never auto-remint
 *   CREATE_TEMPLE_SPECIALS_NO_RESTART=1  — skip mint-api restart after tip advance
 *   TEMPLE_SPECIALS_JSON_FILE            — existing registry to merge
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
  MEMORIAL_NOTE_MAX_BYTES,
  type AltarFields,
} from '../src/offering/altarFields.js';
import { lunarYmdToSolarYmd } from '../src/lib/lunarCalendar.js';
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import {
  resolveLiveMintBaton,
  matchCovenantToBaton,
} from '../src/mint/followMintBaton.js';
import {
  buildMinedMooreTipTempleRemintTx,
  mooreTipTempleMinerBanner,
} from '../src/miner/remintMooreTipTemple.js';
import { WLOTUS_MINER_ATOMS } from '../src/params/wlotusMint.js';
import {
  findCatalogEntryByName,
  templeSpecialCatalog,
  type TempleSpecialCatalogEntry,
} from '../src/params/templeSpecialCatalog.js';
import {
  unwrapTempleSpecialsJson,
} from '../src/params/templeSpecials.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const DRY = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_DRY_RUN?.trim() || '',
);
const NO_MINT = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_NO_MINT?.trim() || '',
);
const BURN = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_BURN?.trim() || '',
);
const MERGE_ONLY =
  !BURN ||
  /^(1|true|yes)$/i.test(
    process.env.CREATE_TEMPLE_SPECIALS_MERGE_ONLY?.trim() || '',
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
  id: string;
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
  eventRecurrence?: 'yearly' | 'monthly-lunar';
  lunarMonthEnd?: boolean;
  monthlyEve?: boolean;
  skipLunarMonths?: number[];
  countries: string[];
  birthPlace?: string;
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

async function restartMintApi(): Promise<void> {
  if (NO_RESTART) {
    console.log('Skipping mint-api restart (CREATE_TEMPLE_SPECIALS_NO_RESTART=1)');
    return;
  }
  const port = process.env.MINT_API_PORT?.trim() || '8787';
  const health = `http://127.0.0.1:${port}/health`;
  try {
    // `restart` (not try-restart): cutover freezes the unit with `stop`.
    // try-restart is a no-op when inactive, so the next curl hits nginx 502 HTML
    // and jq dies with "Invalid numeric literal".
    execFileSync('sudo', ['-n', 'systemctl', 'restart', MINT_API_SERVICE], {
      stdio: 'inherit',
    });
    console.log(`Restarted ${MINT_API_SERVICE} so it reloads the new baton tip`);
  } catch {
    console.warn(
      `WARN: could not restart ${MINT_API_SERVICE}. Restart it yourself so mint-api does not remint a spent P2SH.`,
    );
    return;
  }
  let healthy = false;
  for (let i = 0; i < 20; i++) {
    try {
      execFileSync('curl', ['-sf', '--max-time', '2', health], {
        stdio: 'ignore',
      });
      healthy = true;
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!healthy) {
    console.warn(
      `WARN: ${MINT_API_SERVICE} did not answer ${health}. ` +
        `jq on https://wlotus.org/api/status will parse nginx 502 HTML. ` +
        `Check: sudo systemctl status ${MINT_API_SERVICE} --no-pager; ` +
        `sudo journalctl -u ${MINT_API_SERVICE} -n 80 --no-pager`,
    );
  }
}

function specFromCatalog(entry: TempleSpecialCatalogEntry): SpecialSpec {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    altarName: entry.altarName,
    note: entry.note,
    eventDate: entry.eventDate,
    eventCalendar: entry.eventCalendar,
    eventStart: entry.eventStart,
    eventEnd: entry.eventEnd,
    eventEndHour: entry.eventEndHour,
    eventRecurrence: entry.eventRecurrence,
    lunarMonthEnd: entry.lunarMonthEnd,
    monthlyEve: entry.monthlyEve,
    skipLunarMonths: entry.skipLunarMonths,
    countries: [...entry.countries],
    birthPlace: entry.birthPlace,
  };
}

function catalogYear(): number {
  const y = Number(process.env.EVENT_YEAR?.trim() || '2026');
  return Number.isFinite(y) && y >= 2020 && y <= 2100 ? y : 2026;
}

function defaultSpecs(): SpecialSpec[] {
  const all = templeSpecialCatalog(catalogYear()).map(specFromCatalog);
  const idsRaw = process.env.CREATE_TEMPLE_SPECIALS_IDS?.trim();
  if (!idsRaw) return all;
  const want = new Set(
    idsRaw
      .split(/[,;\s]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return all.filter(s => want.has(s.id) || want.has(s.name.toLowerCase()));
}

function loadExistingRegistry(): Array<Record<string, unknown>> {
  const candidates = [
    process.env.TEMPLE_SPECIALS_JSON_FILE?.trim(),
    '/etc/wlotus/temple-specials.json',
    resolve(process.cwd(), 'deployments/temple-specials-created.json'),
  ].filter((p): p is string => !!p);
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
      const inner = unwrapTempleSpecialsJson(parsed);
      if (!Array.isArray(inner)) continue;
      const rows = inner.filter(
        (row): row is Record<string, unknown> =>
          !!row && typeof row === 'object' && !Array.isArray(row),
      );
      if (rows.length > 0) {
        console.log(`Merging existing specials from ${file} (${rows.length})`);
        return rows;
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

function existingProfileIdForSpec(
  spec: SpecialSpec,
  existing: Array<Record<string, unknown>>,
): string | null {
  for (const row of existing) {
    const name = String(row.name ?? '').trim();
    const rowId = String(row.id ?? row.specialId ?? '')
      .trim()
      .toLowerCase();
    const id = String(row.profileId ?? row.profile_id ?? '')
      .trim()
      .toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(id)) continue;
    if (rowId && rowId === spec.id) return id;
    const hit = findCatalogEntryByName(name, catalogYear());
    if (hit && hit.id === spec.id) return id;
  }
  return null;
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
    birthPlace: spec.birthPlace ?? '',
  };
  // Root DANA v1 (no parent). Packed note ≤ 150 UTF-8 bytes (Vietnamese
  // letters are 2–3 bytes each). Leftover ALP SEND is retried off if the
  // combined OP_RETURN would exceed 223.
  return encodeAltarNote(fields, { maxBytes: MEMORIAL_NOTE_MAX_BYTES });
}

function registryEntry(
  profileId: string,
  spec: SpecialSpec,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: spec.id,
    kind: spec.kind,
    eventDate: spec.eventDate,
    eventCalendar: spec.eventCalendar,
    name: spec.name,
  };
  if (/^[0-9a-f]{64}$/.test(profileId)) base.profileId = profileId;
  if (spec.eventStart) base.eventStart = spec.eventStart;
  if (spec.eventEnd) base.eventEnd = spec.eventEnd;
  if (spec.eventEndHour != null) base.eventEndHour = spec.eventEndHour;
  if (spec.eventRecurrence) base.eventRecurrence = spec.eventRecurrence;
  if (spec.lunarMonthEnd) base.lunarMonthEnd = true;
  if (spec.monthlyEve) base.monthlyEve = true;
  if (spec.skipLunarMonths?.length) base.skipLunarMonths = spec.skipLunarMonths;
  if (spec.countries.length > 0) base.countries = spec.countries;
  if (spec.birthPlace) base.birthPlace = spec.birthPlace;
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

  // Open miners remint without this script; JSON powAddress can be a spent P2SH.
  const startTxid =
    tipRec.lastRemintTxid ?? dep.handoffTxids?.[tipRec.index] ?? tokenId;
  const live = await resolveLiveMintBaton(chronik, tokenId, startTxid);
  const contract = await matchCovenantToBaton(
    live,
    [tipRec.tipLocktime, dep.tipLocktime ?? 0, dep.genesisUnix],
    async tipLocktime => {
      const c = await createPowRemintMooreTipTempleContract({
        tokenId,
        mintAtoms,
        templeScriptHash: fromHex(templeHashHex),
        genesisUnix: dep.genesisUnix,
        baseZeroBits: dep.baseZeroBits,
        secondsPerExtraBit: dep.secondsPerExtraBit,
        tipLocktime,
      });
      return {
        ...c,
        address: c.address,
        p2shScriptHex: toHex(c.p2shScript.bytecode),
        tipLocktime,
      };
    },
  );
  console.log(mooreTipTempleMinerBanner(contract));
  if (live.hops > 0 || (tipRec.powAddress && tipRec.powAddress !== contract.address)) {
    console.log(
      `  followed on-chain tip hops=${live.hops} ${live.txid}:${live.outIdx} ${contract.address}`,
    );
  }

  const baton = {
    outpoint: { txid: live.txid, outIdx: live.outIdx },
    sats: live.sats,
    txid: live.txid,
    vout: live.outIdx,
  };

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  const locktime = Number(
    process.env.MOORE_TIP_LOCKTIME?.trim() ||
      Math.max(contract.tipLocktime, mtp - 1),
  );
  if (locktime < contract.tipLocktime) {
    throw new Error(
      `locktime ${locktime} < tipLocktime ${contract.tipLocktime} (rewind)`,
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
        tipLocktime: contract.tipLocktime,
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
  await restartMintApi();

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
  const specs = defaultSpecs();
  const existing = loadExistingRegistry();
  const reused: Array<{ spec: SpecialSpec; profileId: string }> = [];
  const toBurn: SpecialSpec[] = [];
  for (const spec of specs) {
    const id = existingProfileIdForSpec(spec, existing);
    if (id) reused.push({ spec, profileId: id });
    else toBurn.push(spec);
  }

  const tokenId = (() => {
    try {
      return loadTokenId();
    } catch (e) {
      if (MERGE_ONLY) return '';
      throw e;
    }
  })();

  console.log(
    JSON.stringify(
      {
        dryRun: DRY,
        mergeOnly: MERGE_ONLY,
        burnMode: BURN && !MERGE_ONLY,
        autoMintIfShort: !NO_MINT && !MERGE_ONLY,
        tokenId,
        reuse: reused.map(r => ({ name: r.spec.name, profileId: r.profileId })),
        burn: toBurn.map(s => s.name),
        specials: specs.map(s => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          countries: s.countries,
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
    reused?: boolean;
  }> = reused.map(r => ({
    name: r.spec.name,
    kind: r.spec.kind,
    eventDate: r.spec.eventDate,
    eventCalendar: r.spec.eventCalendar,
    eventStart: r.spec.eventStart,
    eventEnd: r.spec.eventEnd,
    eventEndHour: r.spec.eventEndHour,
    profileId: r.profileId,
    explorer: `https://explorer.e.cash/tx/${r.profileId}`,
    notePreview: '',
    reused: true,
  }));

  if (MERGE_ONLY) {
    writeRegistryPayload({
      tokenId,
      inventoryFrom: 'catalog-no-burn',
      created,
      specs,
    });
    return;
  }

  const needAtoms = BigInt(toBurn.length);
  const chronik = await createChronik('closest');
  const holder =
    toBurn.length === 0
      ? {
          label: 'none-needed',
          atoms: 0n,
          wallet: null as unknown as TokenHolder['wallet'],
          tipIndex: null,
        }
      : await ensureInventory(chronik, tokenId, needAtoms);
  if (toBurn.length > 0) {
    console.log(`Using inventory from ${holder.label} (${holder.atoms} atoms)`);
  }
  if (DRY && toBurn.length > 0 && holder.atoms < needAtoms) {
    console.log(
      'Dry-run will not remint or burn. Re-run without CREATE_TEMPLE_SPECIALS_DRY_RUN=1.',
    );
  }

  for (const spec of toBurn) {
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

  writeRegistryPayload({
    tokenId,
    inventoryFrom: holder.label,
    created,
    specs,
  });
}

function writeRegistryPayload(opts: {
  tokenId: string;
  inventoryFrom: string;
  created: Array<{
    name: string;
    profileId: string;
  }>;
  specs: SpecialSpec[];
}): void {
  const registry = opts.specs.map(spec => {
    const row = opts.created.find(c => c.name === spec.name);
    const pid =
      row && /^[0-9a-f]{64}$/.test(row.profileId) ? row.profileId : '';
    return registryEntry(pid, spec);
  });
  const liveRegistry = registry.filter(row =>
    /^[0-9a-f]{64}$/.test(String(row.profileId ?? '')),
  );

  const outDir = resolve(process.cwd(), 'deployments');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'temple-specials-created.json');
  const payload = {
    createdAt: new Date().toISOString(),
    dryRun: DRY,
    mergeOnly: MERGE_ONLY,
    tokenId: opts.tokenId,
    inventoryFrom: opts.inventoryFrom,
    created: opts.created,
    TEMPLE_SPECIALS_JSON: liveRegistry.length > 0 ? liveRegistry : registry,
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log('\n=== Result ===');
  console.log(JSON.stringify(payload, null, 2));
  if (!DRY && !MERGE_ONLY && liveRegistry.length > 0) {
    console.log('\nRegister on mint-api (file, not a quoted mint.env line):\n');
    console.log(
      `sudo cp ${outPath} /etc/wlotus/temple-specials.json\n` +
        `echo 'TEMPLE_SPECIALS_JSON_FILE=/etc/wlotus/temple-specials.json' | sudo tee -a /etc/wlotus/mint.env\n` +
        `sudo systemctl restart wlotus-mint-api\n` +
        `curl -sS --fail-with-body http://127.0.0.1:8787/health`,
    );
    console.log(`\nWrote ${outPath}`);
  } else if (MERGE_ONLY) {
    console.log(
      `\nNo temple burns (default). Catalog is built-in; first visitors claim roots.\n` +
        `Optional overlay: sudo cp ${outPath} /etc/wlotus/temple-specials.json\n` +
        `To desk-burn missing roots instead: CREATE_TEMPLE_SPECIALS_BURN=1 npm run create-temple-specials`,
    );
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
