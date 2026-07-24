/**
 * Chronik ingest — scan ALP token history for DANA memorial burns.
 */

import { ChronikClient, type Tx } from 'chronik-client';
import { memorialFromOutputScriptHex } from '../../../src/offering/memorialFromScript.js';
import type { BurnStore, IndexedBurn } from './store.js';

const DEFAULT_CHRONIK = [
  'https://chronik.e.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
];

export function chronikUrlsFromEnv(): string[] {
  const raw = process.env.CHRONIK_URLS?.trim();
  if (raw) {
    const list = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (list.length) return list;
  }
  return [...DEFAULT_CHRONIK];
}

export function createIngestChronik(urls = chronikUrlsFromEnv()): ChronikClient {
  return new ChronikClient(urls);
}

function memorialFromTx(tx: Tx): ReturnType<typeof memorialFromOutputScriptHex> {
  for (const out of tx.outputs ?? []) {
    const hex = out.outputScript;
    if (!hex || typeof hex !== 'string') continue;
    const m = memorialFromOutputScriptHex(hex);
    if (m) return m;
  }
  return null;
}

function txTouchesToken(tx: Tx, tokenId: string): boolean {
  const want = tokenId.toLowerCase();
  for (const te of tx.tokenEntries ?? []) {
    if (te.tokenId?.toLowerCase() === want) return true;
  }
  for (const out of tx.outputs ?? []) {
    if (out.token?.tokenId?.toLowerCase() === want) return true;
  }
  for (const inp of tx.inputs ?? []) {
    if (inp.token?.tokenId?.toLowerCase() === want) return true;
  }
  return false;
}

export function indexedBurnFromTx(
  tx: Tx,
  tokenId: string,
  nowIso = new Date().toISOString(),
): IndexedBurn | null {
  if (!tx.txid) return null;
  if (!txTouchesToken(tx, tokenId)) return null;
  const memorial = memorialFromTx(tx);
  if (!memorial) return null;
  if (memorial.version !== 1 && memorial.version !== 2) return null;

  const parent = memorial.parentBurnTxid?.toLowerCase();
  const burnTxid = tx.txid.toLowerCase();
  return {
    burnTxid,
    tokenId: tokenId.toLowerCase(),
    note: (memorial.note || '').trim(),
    offeringId: memorial.offeringId,
    version: memorial.version,
    parentBurnTxid: parent,
    originalBurnTxid: parent || burnTxid,
    blockHeight: tx.block?.height ?? null,
    blockTimestamp: tx.block?.timestamp ?? null,
    timeFirstSeen: nowIso,
  };
}

export async function ingestTokenHistoryPage(opts: {
  chronik: ChronikClient;
  store: BurnStore;
  tokenId: string;
  page?: number;
  pageSize?: number;
}): Promise<{ scanned: number; added: number }> {
  const page = opts.page ?? 0;
  const pageSize = opts.pageSize ?? 50;
  const hist = await opts.chronik.tokenId(opts.tokenId).history(page, pageSize);
  let added = 0;
  const nowIso = new Date().toISOString();
  for (const tx of hist.txs ?? []) {
    const burn = indexedBurnFromTx(tx, opts.tokenId, nowIso);
    if (!burn) continue;
    // Preserve first-seen if we already have the row.
    const prev = opts.store.get(burn.burnTxid);
    if (prev) burn.timeFirstSeen = prev.timeFirstSeen;
    if (opts.store.upsert(burn)) added += 1;
  }
  return { scanned: hist.txs?.length ?? 0, added };
}

export async function ingestUnconfirmed(opts: {
  chronik: ChronikClient;
  store: BurnStore;
  tokenId: string;
}): Promise<{ scanned: number; added: number }> {
  const hist = await opts.chronik.tokenId(opts.tokenId).unconfirmedTxs();
  let added = 0;
  const nowIso = new Date().toISOString();
  for (const tx of hist.txs ?? []) {
    const burn = indexedBurnFromTx(tx, opts.tokenId, nowIso);
    if (!burn) continue;
    const prev = opts.store.get(burn.burnTxid);
    if (prev) burn.timeFirstSeen = prev.timeFirstSeen;
    if (opts.store.upsert(burn)) added += 1;
  }
  return { scanned: hist.txs?.length ?? 0, added };
}

/** Fetch one tx by id (notify path / backfill). */
export async function ingestTxid(opts: {
  chronik: ChronikClient;
  store: BurnStore;
  tokenId: string;
  txid: string;
}): Promise<IndexedBurn | null> {
  const tx = await opts.chronik.tx(opts.txid.trim().toLowerCase());
  const burn = indexedBurnFromTx(tx, opts.tokenId);
  if (!burn) return null;
  const prev = opts.store.get(burn.burnTxid);
  if (prev) burn.timeFirstSeen = prev.timeFirstSeen;
  opts.store.upsert(burn);
  return opts.store.get(burn.burnTxid) ?? burn;
}

export async function backfillRecent(opts: {
  chronik: ChronikClient;
  store: BurnStore;
  tokenId: string;
  maxPages?: number;
}): Promise<{ pages: number; scanned: number; added: number }> {
  const maxPages = opts.maxPages ?? 20;
  let pages = 0;
  let scanned = 0;
  let added = 0;
  for (let page = 0; page < maxPages; page++) {
    const r = await ingestTokenHistoryPage({
      chronik: opts.chronik,
      store: opts.store,
      tokenId: opts.tokenId,
      page,
      pageSize: 50,
    });
    pages += 1;
    scanned += r.scanned;
    added += r.added;
    if (r.scanned < 50) break;
  }
  const u = await ingestUnconfirmed(opts);
  scanned += u.scanned;
  added += u.added;
  return { pages, scanned, added };
}
