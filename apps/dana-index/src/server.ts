#!/usr/bin/env tsx
/**
 * DANA memorial index — Chronik-backed public history of wLotus burns.
 *
 *   TOKEN_ID=… npm run dana-index
 *
 *   GET  /health
 *   GET  /api/recent?limit=40
 *   GET  /api/memorial/:txid
 *   POST /api/notify { burnTxid }  — mint-api / clients ask to index a tx now
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
import { BurnStore } from './store.js';

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
const STARTED_AT = new Date().toISOString();

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

async function readJson(
  req: import('node:http').IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
    string,
    unknown
  >;
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

    if (req.method === 'POST' && path === '/api/notify') {
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
