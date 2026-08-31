#!/usr/bin/env tsx
/**
 * Migrate DANA memorial offerings onto a new genesis (felt no-tax recut).
 * Star topology: roots first, then re-offers.
 *
 * Desk path: remint 108 onto the tip, burn 1, send remaining 107 to
 * TEMPLE_ADDRESS (P2PKH or P2SH). Soft listing tax is ≥ 6; migration
 * always sends the full leftover mala.
 *
 *   FROM_TOKEN_ID=… TO_TOKEN_ID=… DRY_RUN=1 npm run migrate-offerings
 *   FROM_TOKEN_ID=… TO_TOKEN_ID=… TEMPLE_ADDRESS=ecash:q… npm run migrate-offerings
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import {
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  payment,
  toHex,
} from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import {
  backfillRecent,
  createIngestChronik,
} from '../apps/dana-index/src/ingest.js';
import { BurnStore, type IndexedBurn } from '../apps/dana-index/src/store.js';
import { burnOnePrayer, OFFERING_ID_WLOTUS } from '../src/offering/burnPrayer.js';
import {
  scriptFromCashAddress,
} from '../src/offering/templeSink.js';
import {
  migrationNeedAtoms,
  orderBurnsForMigration,
  remapParentTxid,
  remapSpecialClaims,
  type MigratableBurn,
} from '../src/offering/migrateOfferings.js';
import { loadMintWallet } from '../src/mint/loadMintWallet.js';
import { loadTipFeeWallet } from '../src/mint/loadTipFeeWallet.js';
import {
  pickBurnPostageUtxo,
  pickSizedFuelUtxo,
} from '../src/mint/fuelUtxo.js';
import {
  peelOfferingPair,
  sendOfferingPairFromDesk,
} from '../src/mint/peelSizedFuel.js';
import {
  claimsFilePath,
  loadSpecialClaims,
} from '../src/params/templeSpecialClaims.js';
import {
  WLOTUS_FELT_DESK_KEEP_AFTER_BURN,
  WLOTUS_FELT_MINER_ATOMS,
} from '../src/params/wlotusMint.js';
import { createPowRemintGlotusTipContract } from '../src/covenant/powRemintGlotusTipScript.js';
import { expectedGlotusMintOpReturnScript } from '../src/covenant/powRemintGlotusTipOutputs.js';
import { buildMinedMooreTipRemintTx } from '../src/miner/remintMooreTip.js';
import {
  matchCovenantToBaton,
  resolveLiveMintBaton,
} from '../src/mint/followMintBaton.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const LIVE_PROD =
  '154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091';
const DEFAULT_TEMPLE =
  'ecash:qz2cyuu3y5h0tanf8wy3esr64drpzzweeyu2c5dyen';
/** Migration leftover: 108 remint − 1 flower. */
const MIGRATE_TEMPLE_ATOMS = WLOTUS_FELT_DESK_KEEP_AFTER_BURN;

function envFlag(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function tokenIdEnv(name: string, fallback?: string): string {
  const raw = (process.env[name] ?? fallback ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(raw)) {
    throw new Error(`${name} must be a 64-hex token id`);
  }
  return raw;
}

function toMigratable(b: IndexedBurn): MigratableBurn {
  return {
    burnTxid: b.burnTxid,
    note: b.note,
    parentBurnTxid: b.parentBurnTxid,
    offeringId: b.offeringId || OFFERING_ID_WLOTUS,
    version: b.version,
  };
}

async function loadSourceBurns(fromTokenId: string): Promise<IndexedBurn[]> {
  const srcPath =
    process.env.FROM_STORE?.trim() ||
    resolve(process.cwd(), 'data/dana-index-burns.from.json');
  mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
  const store = new BurnStore(srcPath);
  const chronik = createIngestChronik();
  const maxPages = Math.max(
    1,
    Number(process.env.MIGRATE_MAX_PAGES?.trim() || 80) || 80,
  );
  const r = await backfillRecent({
    chronik,
    store,
    tokenId: fromTokenId,
    maxPages,
  });
  console.log(
    JSON.stringify({
      scanned: r.scanned,
      added: r.added,
      pages: r.pages,
      storeSize: store.size(),
    }),
  );
  const raw = JSON.parse(readFileSync(srcPath, 'utf8')) as {
    burns?: IndexedBurn[];
  };
  return (raw.burns ?? []).map(b => ({
    ...b,
    burnTxid: b.burnTxid.toLowerCase(),
    parentBurnTxid: b.parentBurnTxid?.toLowerCase(),
  }));
}

function writeDestIndex(
  path: string,
  burns: IndexedBurn[],
  replace = false,
): void {
  if (replace && existsSync(path)) unlinkSync(path);
  const store = new BurnStore(path);
  for (const b of burns) store.upsert(b);
}

function tipTokenAtoms(wallet: Wallet, tokenId: string): bigint {
  return wallet.utxos
    .filter(
      u =>
        u.token?.tokenId === tokenId &&
        u.token.atoms != null &&
        !u.token.isMintBaton,
    )
    .reduce((s, u) => s + BigInt(u.token!.atoms), 0n);
}

export function hasMalaLot(wallet: Wallet, tokenId: string): boolean {
  return wallet.utxos.some(
    u =>
      u.token?.tokenId === tokenId &&
      u.token.atoms != null &&
      !u.token.isMintBaton &&
      BigInt(u.token.atoms) >= WLOTUS_FELT_MINER_ATOMS,
  );
}

export async function ensureOfferingPair(
  desk: Wallet,
  tip: Wallet,
): Promise<void> {
  await tip.sync();
  if (pickSizedFuelUtxo(tip.utxos) && pickBurnPostageUtxo(tip.utxos)) return;
  try {
    const pair = await sendOfferingPairFromDesk(desk, tip);
    console.log('desk→tip pair', pair.txid);
  } catch (e) {
    const peeled = await peelOfferingPair(tip, {
      fuelScript: tip.script,
      changeScript: desk.script,
    });
    if (peeled) console.log('tip pair peel', peeled.txid);
    else throw e;
  }
}

export interface FeltDep {
  tokenId: string;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
  mintAtomsPerRemint: string;
  tipLocktime?: number;
  powAddress?: string;
  handoffTxids?: string[];
  batonTips?: Array<{
    index: number;
    tipLocktime: number;
    powAddress: string;
    lastRemintTxid: string | null;
  }>;
  redeemScriptHex?: string;
  codeHashHex?: string;
}

export async function remintMalaOnTip(opts: {
  chronik: Awaited<ReturnType<typeof createChronik>>;
  depPath: string;
  dep: FeltDep;
  desk: Wallet;
  tip: Wallet;
  tipKeys: { sk: Uint8Array; pk: Uint8Array };
}): Promise<string> {
  const { chronik, depPath, dep, desk, tip, tipKeys } = opts;
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  const tipRec =
    dep.batonTips?.find(t => t.index === 0) ??
    dep.batonTips?.[0] ?? {
      index: 0,
      tipLocktime: dep.tipLocktime ?? dep.genesisUnix,
      powAddress: dep.powAddress ?? '',
      lastRemintTxid: null as string | null,
    };

  await ensureOfferingPair(desk, tip);
  await tip.sync();
  const fuelUtxo = pickSizedFuelUtxo(tip.utxos);
  if (!fuelUtxo) {
    throw new Error('Tip has no sized remint fuel after desk peel');
  }

  const startTxid =
    tipRec.lastRemintTxid ?? dep.handoffTxids?.[0] ?? dep.tokenId;
  const live = await resolveLiveMintBaton(chronik, dep.tokenId, startTxid);
  const locktimeGuesses = [
    live.creatingLockTime,
    tipRec.tipLocktime,
    dep.tipLocktime ?? 0,
    dep.genesisUnix,
  ];
  const contract = await matchCovenantToBaton(
    live,
    locktimeGuesses,
    async tipLocktime => {
      const c = await createPowRemintGlotusTipContract({
        tokenId: dep.tokenId,
        mintAtoms,
        genesisUnix: dep.genesisUnix,
        baseZeroBits: dep.baseZeroBits,
        secondsPerExtraBit: dep.secondsPerExtraBit,
        tipLocktime,
      });
      return {
        ...c,
        p2shScriptHex: toHex(c.p2shScript.bytecode),
        tipLocktime,
      };
    },
  );

  const { mtp } = await getMedianTimePast(chronik);
  const locktime = Math.max(contract.tipLocktime, mtp - 1);
  if (locktime >= mtp) {
    throw new Error(`locktime ${locktime} ≥ MTP ${mtp}`);
  }
  const nextContract = await createPowRemintGlotusTipContract({
    tokenId: dep.tokenId,
    mintAtoms,
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    tipLocktime: locktime,
  });
  const built = await buildMinedMooreTipRemintTx({
    contract,
    baton: {
      outpoint: { txid: live.txid, outIdx: live.outIdx },
      sats: live.sats,
      txid: live.txid,
      vout: live.outIdx,
    },
    fuel: {
      outpoint: fuelUtxo.outpoint,
      sats: fuelUtxo.sats,
      outputScript: tip.script,
    },
    miner: { sk: tipKeys.sk, pk: tipKeys.pk },
    locktime,
    opReturn: expectedGlotusMintOpReturnScript(dep.tokenId, mintAtoms),
    nextContract,
  });
  const broadcast = await chronik.broadcastTx(built.txHex);
  const txid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;

  const nextTips = (dep.batonTips ?? [tipRec]).map(t =>
    t.index === 0
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
  Object.assign(dep, updated);
  console.log('remint', txid, `bits=${built.tip.bits}`);
  return txid;
}

async function sendTokensToTip(
  from: Wallet,
  tip: Wallet,
  tokenId: string,
): Promise<string | null> {
  await from.sync();
  const atoms = tipTokenAtoms(from, tokenId);
  if (atoms <= 0n) return null;
  const action: payment.Action = {
    outputs: [
      { sats: 0n },
      {
        sats: DEFAULT_DUST_SATS,
        script: tip.script,
        tokenId,
        atoms,
        isMintBaton: false,
      },
    ],
    tokenActions: [
      { type: 'SEND', tokenId, tokenType: ALP_TOKEN_TYPE_STANDARD },
    ],
  };
  const previous = from.getChangeScript.bind(from);
  (from as { getChangeScript: () => typeof from.script }).getChangeScript =
    () => from.script;
  try {
    const resp = await from.action(action).build().broadcast();
    if (!resp.success || !resp.broadcasted?.length) {
      throw new Error(`Desk→tip token send failed: ${JSON.stringify(resp)}`);
    }
    console.log('tokens→tip', resp.broadcasted[0], atoms.toString());
    return resp.broadcasted[0]!;
  } finally {
    (from as { getChangeScript: () => typeof from.script }).getChangeScript =
      previous;
  }
}

async function main(): Promise<void> {
  const fromTokenId = tokenIdEnv('FROM_TOKEN_ID', LIVE_PROD);
  const indexOnly = envFlag('INDEX_ONLY');
  const dry = envFlag('DRY_RUN');
  const toStore =
    process.env.TO_STORE?.trim() ||
    resolve(process.cwd(), 'data/dana-index-burns.json');
  const templeAddr =
    process.env.TEMPLE_ADDRESS?.trim() || DEFAULT_TEMPLE;
  const temple = scriptFromCashAddress(templeAddr);

  console.log(
    JSON.stringify(
      { fromTokenId, indexOnly, dry, toStore, templeAddress: temple.address },
      null,
      2,
    ),
  );

  const source = await loadSourceBurns(fromTokenId);
  const ordered = orderBurnsForMigration(source.map(toMigratable));
  const need = migrationNeedAtoms(ordered, MIGRATE_TEMPLE_ATOMS);
  console.log(
    JSON.stringify(
      {
        offerings: ordered.length,
        roots: ordered.filter(b => !b.parentBurnTxid).length,
        reoffers: ordered.filter(b => b.parentBurnTxid).length,
        needAtoms: need.toString(),
        templeAtomsPerOffering: MIGRATE_TEMPLE_ATOMS.toString(),
        remintsNeeded: ordered.length,
      },
      null,
      2,
    ),
  );

  if (indexOnly) {
    writeDestIndex(toStore, source, true);
    console.log(`INDEX_ONLY: copied ${source.length} burns → ${toStore}`);
    return;
  }

  const toTokenId = tokenIdEnv('TO_TOKEN_ID');
  if (toTokenId === fromTokenId) {
    throw new Error('TO_TOKEN_ID must differ from FROM_TOKEN_ID');
  }

  const mapping: Record<string, string> = {};
  const results: Array<{
    oldTxid: string;
    newTxid: string | null;
    parent?: string;
    skipped?: string;
    remintTxid?: string;
    inventoryAtoms?: string;
  }> = [];

  if (dry) {
    for (const b of ordered) {
      results.push({
        oldTxid: b.burnTxid,
        newTxid: null,
        parent: remapParentTxid(b.parentBurnTxid, mapping),
        skipped: 'DRY_RUN',
      });
    }
  } else {
    const chronik = await createChronik('closest');
    const desk = await loadMintWallet(chronik);
    const tipLoaded = await loadTipFeeWallet(chronik, 0);
    await desk.wallet.sync();
    await tipLoaded.wallet.sync();
    console.log('desk', desk.address, 'tip', tipLoaded.address);

    const depPath = resolve(
      process.cwd(),
      process.env.MINT_DEPLOYMENT_JSON?.trim() ||
        'deployments/mainnet-wlotus.json',
    );
    if (!existsSync(depPath)) {
      throw new Error(`Missing ${depPath}`);
    }
    const dep = JSON.parse(readFileSync(depPath, 'utf8')) as FeltDep;
    if (dep.tokenId.toLowerCase() !== toTokenId) {
      throw new Error(
        `Deployment tokenId ${dep.tokenId} ≠ TO_TOKEN_ID ${toTokenId}`,
      );
    }

    if (tipTokenAtoms(desk.wallet, toTokenId) > 0n) {
      await sendTokensToTip(desk.wallet, tipLoaded.wallet, toTokenId);
      await tipLoaded.wallet.sync();
    }

    for (const b of ordered) {
      await tipLoaded.wallet.sync();
      if (!hasMalaLot(tipLoaded.wallet, toTokenId)) {
        await remintMalaOnTip({
          chronik,
          depPath,
          dep,
          desk: desk.wallet,
          tip: tipLoaded.wallet,
          tipKeys: { sk: tipLoaded.sk, pk: tipLoaded.pk },
        });
        for (let i = 0; i < 12; i++) {
          await tipLoaded.wallet.sync();
          if (hasMalaLot(tipLoaded.wallet, toTokenId)) break;
          await new Promise(r => setTimeout(r, 400 + i * 150));
        }
      }
      await ensureOfferingPair(desk.wallet, tipLoaded.wallet);
      const parent = remapParentTxid(b.parentBurnTxid, mapping);
      const burned = await burnOnePrayer({
        wallet: tipLoaded.wallet,
        tokenId: toTokenId,
        note: b.note,
        offeringId: b.offeringId || OFFERING_ID_WLOTUS,
        parentBurnTxid: parent,
        burnAtoms: 1n,
        changeScript: desk.wallet.script,
        inventoryScript: temple.script,
        minInventoryAtoms: MIGRATE_TEMPLE_ATOMS,
      });
      if (burned.inventoryAtoms !== MIGRATE_TEMPLE_ATOMS) {
        console.warn(
          `expected ${MIGRATE_TEMPLE_ATOMS} leftover, got ${burned.inventoryAtoms}`,
        );
      }
      mapping[b.burnTxid] = burned.txid.toLowerCase();
      results.push({
        oldTxid: b.burnTxid,
        newTxid: burned.txid.toLowerCase(),
        parent,
        inventoryAtoms: burned.inventoryAtoms.toString(),
      });
      console.log(
        `${b.burnTxid.slice(0, 8)}… → ${burned.txid} temple=${burned.inventoryAtoms}`,
      );
    }

    const remapped = source.map(b => {
      const old = b.burnTxid.toLowerCase();
      const nextTxid = mapping[old] ?? old;
      const parent = remapParentTxid(b.parentBurnTxid, mapping);
      return {
        ...b,
        burnTxid: nextTxid,
        tokenId: toTokenId,
        parentBurnTxid: parent,
        originalBurnTxid:
          remapParentTxid(b.originalBurnTxid, mapping) ?? nextTxid,
      };
    });
    writeDestIndex(toStore, remapped, true);
    console.log(`Wrote remapped index ${remapped.length} burns → ${toStore}`);

    const claimsPath = claimsFilePath();
    if (existsSync(claimsPath)) {
      const next = remapSpecialClaims(loadSpecialClaims(), mapping);
      writeFileSync(claimsPath, `${JSON.stringify(next, null, 2)}\n`);
      console.log('Rewrote special claims', claimsPath);
    }
  }

  const outPath =
    process.env.MIGRATE_OUT?.trim() ||
    resolve(process.cwd(), 'deployments/offering-migration.json');
  mkdirSync(resolve(outPath, '..'), { recursive: true });
  const record = {
    fromTokenId,
    toTokenId: dry ? null : tokenIdEnv('TO_TOKEN_ID'),
    dry,
    templeAddress: temple.address,
    templeAtomsPerOffering: MIGRATE_TEMPLE_ATOMS.toString(),
    at: new Date().toISOString(),
    needAtoms: need.toString(),
    mapping,
    results,
  };
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('Wrote', outPath);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(err => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
}
