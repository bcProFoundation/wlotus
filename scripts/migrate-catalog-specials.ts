#!/usr/bin/env tsx
/**
 * Copy catalog specials from a source token onto the live desk token.
 *
 * Discovers stars on FROM_TOKEN_ID, matches root names to the specials
 * catalog (no hardcoded txids), remints on the desk, and rebinds claims.
 *
 *   FROM_TOKEN_ID=<prod> DRY_RUN=1 npm run migrate-catalog-specials
 *   FROM_TOKEN_ID=<prod> npm run migrate-catalog-specials
 *
 * Skip a special that is already claimed unless FORCE=1.
 * Death-date star fragments are folded into the root note.
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import {
  createIngestChronik,
  indexedBurnFromTx,
} from '../apps/dana-index/src/ingest.js';
import { BurnStore, type IndexedBurn } from '../apps/dana-index/src/store.js';
import { burnOnePrayer, OFFERING_ID_WLOTUS } from '../src/offering/burnPrayer.js';
import { scriptFromCashAddress } from '../src/offering/templeSink.js';
import {
  emptyAltarFields,
  encodeAltarNote,
  isDeathDateAmendNote,
  parseAltarNote,
} from '../src/offering/altarFields.js';
import { rebindSpecialRoot } from '../src/params/templeSpecialClaims.js';
import {
  findCatalogEntryByName,
  type TempleSpecialCatalogEntry,
} from '../src/params/templeSpecialCatalog.js';
import { WLOTUS_FELT_DESK_KEEP_AFTER_BURN } from '../src/params/wlotusMint.js';
import { createChronik } from '../src/network/createChronik.js';
import { loadMintWallet } from '../src/mint/loadMintWallet.js';
import { loadTipFeeWallet } from '../src/mint/loadTipFeeWallet.js';
import {
  ensureOfferingPair,
  hasMalaLot,
  remintMalaOnTip,
  type FeltDep,
} from './migrate-offerings.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });
loadEnv({ path: '/etc/wlotus/dana-index.env', override: true });

function envFlag(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function loadTokenBurns(tokenId: string): Promise<IndexedBurn[]> {
  const chronik = createIngestChronik();
  const burns: IndexedBurn[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < 40; page++) {
    const hist = await chronik.tokenId(tokenId).history(page, 50);
    const txs = hist.txs ?? [];
    if (!txs.length) break;
    for (const tx of txs) {
      const b = indexedBurnFromTx(tx, tokenId);
      if (!b || seen.has(b.burnTxid)) continue;
      seen.add(b.burnTxid);
      burns.push(b);
    }
    if (txs.length < 50) break;
  }
  return burns;
}

function starsFromBurns(burns: IndexedBurn[]): Map<string, IndexedBurn[]> {
  const byRoot = new Map<string, IndexedBurn[]>();
  for (const b of burns) {
    const root = (b.parentBurnTxid || b.burnTxid).toLowerCase();
    const list = byRoot.get(root);
    if (list) list.push(b);
    else byRoot.set(root, [b]);
  }
  return byRoot;
}

function matchCatalog(root: IndexedBurn): TempleSpecialCatalogEntry | undefined {
  const fields = parseAltarNote(root.note);
  const name = (fields?.name || '').trim();
  if (name) {
    const hit = findCatalogEntryByName(name);
    if (hit) return hit;
  }
  return findCatalogEntryByName(root.note.replace(/\u001f/g, ' '));
}

function combinedRootNote(
  root: IndexedBurn,
  death: IndexedBurn | undefined,
  catalog: TempleSpecialCatalogEntry,
): string {
  if (!death) return root.note;
  const parsed = parseAltarNote(root.note) ?? emptyAltarFields();
  const deathFields = parseAltarNote(death.note);
  const next = emptyAltarFields();
  next.name = parsed.name || catalog.altarName || catalog.name;
  next.note = parsed.note || catalog.note || '';
  next.birthPlace = parsed.birthPlace || catalog.birthPlace || '';
  next.deathDate = deathFields?.deathDate || parsed.deathDate || catalog.eventDate;
  next.kind = 'event';
  next.dateCalendar = catalog.eventCalendar === 'solar' ? 'solar' : 'lunar';
  try {
    return encodeAltarNote(next);
  } catch {
    return root.note;
  }
}

async function ensureMala(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  depPath: string,
  dep: FeltDep,
  desk: Awaited<ReturnType<typeof loadMintWallet>>,
  tip: Awaited<ReturnType<typeof loadTipFeeWallet>>,
  tokenId: string,
): Promise<void> {
  await tip.wallet.sync();
  if (hasMalaLot(tip.wallet, tokenId)) return;
  await remintMalaOnTip({
    chronik,
    depPath,
    dep,
    desk: desk.wallet,
    tip: tip.wallet,
    tipKeys: { sk: tip.sk, pk: tip.pk },
  });
  for (let i = 0; i < 12; i++) {
    await tip.wallet.sync();
    if (hasMalaLot(tip.wallet, tokenId)) return;
    await sleep(400 + i * 150);
  }
  throw new Error('remint did not land 108 atoms on tip');
}

async function main(): Promise<void> {
  const fromTokenId = (process.env.FROM_TOKEN_ID ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(fromTokenId)) {
    throw new Error('FROM_TOKEN_ID (64 hex) required — source token to scan');
  }
  const dry = envFlag('DRY_RUN');
  const force = envFlag('FORCE');
  const depPath = resolve(
    process.cwd(),
    process.env.MINT_DEPLOYMENT_JSON?.trim() ||
      'deployments/mainnet-wlotus.json',
  );
  if (!existsSync(depPath)) throw new Error(`missing ${depPath}`);
  const dep = JSON.parse(readFileSync(depPath, 'utf8')) as FeltDep & {
    tokenId: string;
  };
  const toTokenId = (process.env.TO_TOKEN_ID?.trim() || dep.tokenId).toLowerCase();
  if (toTokenId === fromTokenId) {
    throw new Error('TO_TOKEN_ID must differ from FROM_TOKEN_ID');
  }

  const burns = await loadTokenBurns(fromTokenId);
  const stars = starsFromBurns(burns);
  const chosen = new Map<
    string,
    { catalog: TempleSpecialCatalogEntry; root: IndexedBurn; members: IndexedBurn[] }
  >();
  for (const [rootId, members] of stars) {
    const root = members.find(b => b.burnTxid === rootId && !b.parentBurnTxid);
    if (!root) continue;
    const catalog = matchCatalog(root);
    if (!catalog) continue;
    const prev = chosen.get(catalog.id);
    if (prev && prev.members.length >= members.length) {
      console.warn(
        `skip extra star for ${catalog.id}: ${rootId} (${members.length} < ${prev.members.length})`,
      );
      continue;
    }
    if (prev) {
      console.warn(
        `replace star for ${catalog.id}: ${prev.root.burnTxid} → ${rootId}`,
      );
    }
    chosen.set(catalog.id, { catalog, root, members });
  }

  const plan = [...chosen.values()].map(({ catalog, root, members }) => {
    const kids = members
      .filter(b => b.parentBurnTxid === root.burnTxid)
      .sort((a, b) => (a.blockTimestamp ?? 0) - (b.blockTimestamp ?? 0));
    const death = kids.find(k => isDeathDateAmendNote(k.note));
    const flowers = kids.filter(k => !isDeathDateAmendNote(k.note));
    return {
      specialId: catalog.id,
      name: catalog.name,
      prodRoot: root.burnTxid,
      rootNote: combinedRootNote(root, death, catalog),
      flowers: flowers.map(f => ({ txid: f.burnTxid, note: f.note })),
      foldedDeath: Boolean(death),
    };
  });
  console.log(
    JSON.stringify(
      { fromTokenId, toTokenId, dry, specials: plan.length, plan },
      null,
      2,
    ),
  );
  if (dry) return;

  const templeAddr = process.env.TEMPLE_ADDRESS?.trim();
  if (!templeAddr) {
    throw new Error('TEMPLE_ADDRESS required (soft temple inventory sink)');
  }
  const temple = scriptFromCashAddress(templeAddr);
  const chronik = await createChronik('closest');
  const desk = await loadMintWallet(chronik);
  const tip = await loadTipFeeWallet(chronik, 0);
  const storePath =
    process.env.DANA_INDEX_STORE?.trim() ||
    resolve(process.cwd(), 'data/dana-index-burns.json');
  const store = new BurnStore(storePath);
  const now = new Date().toISOString();
  const results: unknown[] = [];

  const burn = async (note: string, parent?: string) => {
    await ensureMala(chronik, depPath, dep, desk, tip, toTokenId);
    await ensureOfferingPair(desk.wallet, tip.wallet);
    const burned = await burnOnePrayer({
      wallet: tip.wallet,
      tokenId: toTokenId,
      note,
      offeringId: OFFERING_ID_WLOTUS,
      parentBurnTxid: parent,
      burnAtoms: 1n,
      changeScript: desk.wallet.script,
      inventoryScript: temple.script,
      minInventoryAtoms: WLOTUS_FELT_DESK_KEEP_AFTER_BURN,
    });
    console.log(
      parent ? `reoffer ${burned.txid}` : `root ${burned.txid}`,
      catalogLine(note),
    );
    return burned.txid.toLowerCase();
  };

  for (const job of plan) {
    if (!force) {
      const claims = JSON.parse(
        existsSync('deployments/temple-special-claims.json')
          ? readFileSync('deployments/temple-special-claims.json', 'utf8')
          : '{}',
      ) as Record<string, string>;
      if (claims[job.specialId]) {
        console.log(
          'already claimed, skip',
          job.specialId,
          claims[job.specialId],
        );
        results.push({ ...job, skipped: 'already-claimed' });
        continue;
      }
    }
    const newRoot = await burn(job.rootNote);
    const bound = rebindSpecialRoot(job.specialId, newRoot);
    if (!bound.ok) throw new Error(JSON.stringify(bound));
    store.upsert({
      burnTxid: newRoot,
      tokenId: toTokenId,
      note: job.rootNote,
      offeringId: OFFERING_ID_WLOTUS,
      version: 1,
      originalBurnTxid: newRoot,
      blockHeight: null,
      blockTimestamp: null,
      timeFirstSeen: now,
    });
    const mapping: Record<string, string> = { [job.prodRoot]: newRoot };
    for (const f of job.flowers) {
      const txid = await burn((f.note || '').trim(), newRoot);
      mapping[f.txid] = txid;
      store.upsert({
        burnTxid: txid,
        tokenId: toTokenId,
        note: (f.note || '').trim(),
        offeringId: OFFERING_ID_WLOTUS,
        version: 2,
        parentBurnTxid: newRoot,
        originalBurnTxid: newRoot,
        blockHeight: null,
        blockTimestamp: null,
        timeFirstSeen: now,
      });
    }
    results.push({ specialId: job.specialId, newRoot, mapping, claim: bound });
  }

  writeFileSync(
    resolve(process.cwd(), 'deployments/catalog-specials-migration.json'),
    `${JSON.stringify({ fromTokenId, toTokenId, at: now, results }, null, 2)}\n`,
  );
  console.log('wrote deployments/catalog-specials-migration.json');
}

function catalogLine(note: string): string {
  return JSON.stringify(note).slice(0, 72);
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
