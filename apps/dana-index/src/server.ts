#!/usr/bin/env tsx
/**
 * DANA memorial index — Chronik-backed public history of wLotus burns.
 *
 *   TOKEN_ID=… npm run dana-index
 *
 *   GET  /health
 *   GET  /api/recent?limit=40
 *   GET  /api/trending?limit=8
 *   GET  /api/search?q=&limit=20
 *   GET  /api/memorial/:txid
 *   GET  /og/:txid          — Open Graph HTML for social share previews
 *   GET  /:txid             — same OG HTML (bare share URL; nginx may not rewrite)
 *   POST /api/notify { burnTxid }  — mint-api on loopback (or shared secret)
 */

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import {
  backfillRecent,
  createIngestChronik,
  ingestTxid,
  ingestUnconfirmed,
} from './ingest.js';
import { buildOgHtml, resolveOgLocale } from './ogPreview.js';
import { BurnStore, TRENDING_GRAVITY } from './store.js';
import { readJsonBody, PayloadTooLargeError } from '../../../src/lib/httpJson.js';
import { allowIndexNotify } from '../../../src/lib/indexNotifyAuth.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });
loadEnv({ path: '/etc/wlotus/dana-index.env', override: true });

const PORT = Number(process.env.DANA_INDEX_PORT?.trim() || 8788);
const TOKEN_ID =
  process.env.TOKEN_ID?.trim() ||
  process.env.VITE_PRAYER_TOKEN_ID?.trim() ||
  '';
const STORE_PATH =
  process.env.DANA_INDEX_STORE?.trim() ||
  resolve(process.cwd(), 'data/dana-index-burns.json');
const POLL_MS = Math.max(
  5_000,
  Number(process.env.DANA_INDEX_POLL_MS?.trim() || 30_000),
);
const SITE_ORIGIN = (
  process.env.PUBLIC_SITE_ORIGIN?.trim() ||
  process.env.VITE_PUBLIC_SITE_ORIGIN?.trim() ||
  ''
).replace(/\/$/, '');
const STARTED_AT = new Date().toISOString();
const NOTIFY_SECRET = process.env.DANA_INDEX_NOTIFY_SECRET?.trim() || '';

if (!TOKEN_ID || !/^[0-9a-fA-F]{64}$/.test(TOKEN_ID)) {
  console.error('TOKEN_ID (64 hex) required for dana-index');
  process.exit(1);
}

const store = new BurnStore(STORE_PATH);
const chronik = createIngestChronik();

function cors(res: import('node:http').ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function html(
  res: import('node:http').ServerResponse,
  status: number,
  body: string,
): void {
  cors(res);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
  res.end(body);
}

function siteOriginFor(req: import('node:http').IncomingMessage): string {
  if (SITE_ORIGIN) return SITE_ORIGIN;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    ?.trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https')
    .split(',')[0]
    ?.trim();
  if (host) return `${proto}://${host}`;
  return 'https://wlotus.org';
}

async function readJson(
  req: import('node:http').IncomingMessage,
): Promise<Record<string, unknown>> {
  return readJsonBody(req);
}

async function resolveOriginalNote(txid: string): Promise<string> {
  let group = store.memorial(txid);
  if (!group) {
    try {
      await ingestTxid({ chronik, store, tokenId: TOKEN_ID, txid });
      group = store.memorial(txid);
    } catch {
      /* fall through */
    }
  }
  if (group?.originalNote) return group.originalNote;
  const seed = store.get(txid);
  if (!seed) return '';
  const root = store.get(seed.originalBurnTxid) || seed;
  return (root.note || seed.note || '').trim();
}

let ingestBusy = false;
async function tickIngest(reason: string): Promise<void> {
  if (ingestBusy) return;
  ingestBusy = true;
  try {
    const r = await ingestUnconfirmed({ chronik, store, tokenId: TOKEN_ID });
    if (r.added > 0) {
      console.log(`dana-index ingest (${reason}): +${r.added} / scanned ${r.scanned}`);
    }
  } catch (err) {
    console.error('dana-index ingest error', err);
  } finally {
    ingestBusy = false;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    if (req.method === 'OPTIONS') {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && path === '/health') {
      json(res, 200, {
        ok: true,
        service: 'dana-index',
        startedAt: STARTED_AT,
        tokenId: TOKEN_ID,
        burns: store.size(),
        storePath: STORE_PATH,
      });
      return;
    }

    if (req.method === 'GET' && path === '/api/recent') {
      const limit = Number(url.searchParams.get('limit') || 40);
      json(res, 200, {
        ok: true,
        tokenId: TOKEN_ID,
        items: store.recentGroups(limit),
      });
      return;
    }

    if (req.method === 'GET' && path === '/api/trending') {
      const limit = Number(url.searchParams.get('limit') || 8);
      json(res, 200, {
        ok: true,
        tokenId: TOKEN_ID,
        algorithm: 'decay',
        gravity: TRENDING_GRAVITY,
        items: store.trendingGroups(limit),
      });
      return;
    }

    if (req.method === 'GET' && path === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim();
      const limit = Number(url.searchParams.get('limit') || 20);
      json(res, 200, {
        ok: true,
        tokenId: TOKEN_ID,
        query: q,
        items: q ? store.searchGroups(q, limit) : [],
      });
      return;
    }

    const memorialMatch = /^\/api\/memorial\/([0-9a-fA-F]{64})\/?$/.exec(path);
    if (req.method === 'GET' && memorialMatch) {
      const txid = memorialMatch[1]!.toLowerCase();
      let group = store.memorial(txid);
      if (!group) {
        try {
          await ingestTxid({ chronik, store, tokenId: TOKEN_ID, txid });
          group = store.memorial(txid);
        } catch {
          /* fall through */
        }
      }
      if (!group) {
        json(res, 404, { ok: false, error: 'Memorial not found' });
        return;
      }
      json(res, 200, { ok: true, ...group });
      return;
    }

    const ogMatch =
      /^\/og\/([0-9a-fA-F]{64})\/?$/.exec(path) ||
      // Bare share URL — nginx may proxy /<txid> without rewriting to /og/
      /^\/([0-9a-fA-F]{64})\/?$/.exec(path);
    if (req.method === 'GET' && ogMatch) {
      const txid = ogMatch[1]!.toLowerCase();
      const locale = resolveOgLocale({
        langParam: url.searchParams.get('lang'),
        acceptLanguage: String(req.headers['accept-language'] || ''),
      });
      const originalNote = await resolveOriginalNote(txid);
      html(
        res,
        200,
        buildOgHtml({
          siteOrigin: siteOriginFor(req),
          pathTxid: txid,
          locale,
          originalNote,
        }),
      );
      return;
    }

    if (req.method === 'POST' && path === '/api/notify') {
      if (!allowIndexNotify(req, NOTIFY_SECRET)) {
        req.destroy();
        json(res, 403, { ok: false, error: 'notify is not public' });
        return;
      }
      const body = await readJson(req);
      const burnTxid = String(body.burnTxid || body.txid || '')
        .trim()
        .toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(burnTxid)) {
        json(res, 400, { ok: false, error: 'burnTxid required' });
        return;
      }
      const burn = await ingestTxid({
        chronik,
        store,
        tokenId: TOKEN_ID,
        txid: burnTxid,
      });
      if (!burn) {
        json(res, 404, { ok: false, error: 'No DANA memorial on tx' });
        return;
      }
      json(res, 200, { ok: true, burn });
      return;
    }

    json(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      json(res, 413, { ok: false, error: err.message });
      return;
    }
    console.error(err);
    json(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

server.listen(PORT, async () => {
  console.log(`dana-index listening on :${PORT} token=${TOKEN_ID.slice(0, 12)}…`);
  try {
    const r = await backfillRecent({
      chronik,
      store,
      tokenId: TOKEN_ID,
      maxPages: Number(process.env.DANA_INDEX_BACKFILL_PAGES || 30),
    });
    console.log(
      `dana-index backfill: pages=${r.pages} scanned=${r.scanned} added=${r.added} store=${store.size()}`,
    );
  } catch (err) {
    console.error('dana-index backfill failed', err);
  }
  setInterval(() => void tickIngest('poll'), POLL_MS);
});
