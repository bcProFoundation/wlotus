#!/usr/bin/env tsx
/**
 * Migrate DANA memorial offerings from the live WLOTUS token onto a new
 * genesis (felt no-tax recut). Star topology: roots first, then re-offers.
 *
 * Index-only (no wallet — copy the public feed so the site is not empty):
 *   FROM_TOKEN_ID=154d229b… TO_STORE=data/dana-index-burns.json \
 *     INDEX_ONLY=1 npm run migrate-offerings
 *
 * On-chain re-burn (new txids on TO_TOKEN_ID; needs inventory + postage):
 *   FROM_TOKEN_ID=154d229b… TO_TOKEN_ID=<new> DRY_RUN=1 npm run migrate-offerings
 *   FROM_TOKEN_ID=154d229b… TO_TOKEN_ID=<new> npm run migrate-offerings
 *
 * Mapping + remapped claims:
 *   deployments/offering-migration.json
 *
 * Does not mint a new token. Remint inventory first if the desk is short.
 */
import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { fromHex, Script } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import {
  backfillRecent,
  createIngestChronik,
} from '../apps/dana-index/src/ingest.js';
import { BurnStore, type IndexedBurn } from '../apps/dana-index/src/store.js';
import { burnOnePrayer, OFFERING_ID_WLOTUS } from '../src/offering/burnPrayer.js';
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
} from '../src/mint/fuelUtxo.js';
import { peelOfferingPair, sendOfferingPairFromDesk } from '../src/mint/peelSizedFuel.js';
import {
  claimsFilePath,
  loadSpecialClaims,
} from '../src/params/templeSpecialClaims.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const LIVE_PROD =
  '154d229bab3cf228a2d40b507e1fc5f21a09542ec66776d3e797b455ab77a091';

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
  // BurnStore doesn't export all(); re-read the file.
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

async function ensurePostage(
  desk: Awaited<ReturnType<typeof loadMintWallet>>['wallet'],
  tip: Awaited<ReturnType<typeof loadTipFeeWallet>>['wallet'],
): Promise<void> {
  await tip.sync();
  if (pickBurnPostageUtxo(tip.utxos)) return;
  try {
    const pair = await sendOfferingPairFromDesk(desk, tip);
    console.log('desk→tip postage', pair.txid);
  } catch {
    const peeled = await peelOfferingPair(tip, {
      fuelScript: tip.script,
      changeScript: tip.script,
    });
    if (peeled) console.log('tip postage peel', peeled.txid);
  }
}

async function main(): Promise<void> {
  const fromTokenId = tokenIdEnv('FROM_TOKEN_ID', LIVE_PROD);
  const indexOnly = envFlag('INDEX_ONLY');
  const dry = envFlag('DRY_RUN');
  const toStore =
    process.env.TO_STORE?.trim() ||
    resolve(process.cwd(), 'data/dana-index-burns.json');

  console.log(
    JSON.stringify({ fromTokenId, indexOnly, dry, toStore }, null, 2),
  );

  const source = await loadSourceBurns(fromTokenId);
  const ordered = orderBurnsForMigration(source.map(toMigratable));
  const need = migrationNeedAtoms(ordered);
  console.log(
    JSON.stringify(
      {
        offerings: ordered.length,
        roots: ordered.filter(b => !b.parentBurnTxid).length,
        reoffers: ordered.filter(b => b.parentBurnTxid).length,
        needAtoms: need.toString(),
      },
      null,
      2,
    ),
  );

  if (indexOnly) {
    writeDestIndex(toStore, source, true);
    console.log(`INDEX_ONLY: copied ${source.length} burns → ${toStore}`);
    console.log(
      'These txids remain on the old token. Re-run without INDEX_ONLY after the new genesis to re-burn.',
    );
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
    const tip = await loadTipFeeWallet(chronik, 0);
    await desk.wallet.sync();
    await tip.wallet.sync();
    const atoms = tip.wallet.utxos
      .filter(
        u =>
          u.token?.tokenId === toTokenId &&
          u.token.atoms != null &&
          !u.token.isMintBaton,
      )
      .reduce((s, u) => s + BigInt(u.token!.atoms), 0n);
    if (atoms < need) {
      throw new Error(
        `Need ≥ ${need} atoms of the new token on tip-0 (have ${atoms}). Remint first.`,
      );
    }
    const templeHash = process.env.TEMPLE_SCRIPT_HASH_HEX?.trim();
    const inventoryScript =
      templeHash && /^[0-9a-fA-F]{40}$/.test(templeHash)
        ? Script.p2sh(fromHex(templeHash))
        : desk.wallet.script;

    for (const b of ordered) {
      await ensurePostage(desk.wallet, tip.wallet);
      const parent = remapParentTxid(b.parentBurnTxid, mapping);
      const burned = await burnOnePrayer({
        wallet: tip.wallet,
        tokenId: toTokenId,
        note: b.note,
        offeringId: b.offeringId || OFFERING_ID_WLOTUS,
        parentBurnTxid: parent,
        burnAtoms: 1n,
        changeScript: desk.wallet.script,
        inventoryScript,
      });
      mapping[b.burnTxid] = burned.txid.toLowerCase();
      results.push({
        oldTxid: b.burnTxid,
        newTxid: burned.txid.toLowerCase(),
        parent,
      });
      console.log(`${b.burnTxid.slice(0, 8)}… → ${burned.txid}`);
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
    at: new Date().toISOString(),
    needAtoms: need.toString(),
    mapping,
    results,
  };
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('Wrote', outPath);
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
