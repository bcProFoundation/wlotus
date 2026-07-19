#!/usr/bin/env tsx
/**
 * Minimal Prayer mint API — dual-mint offer (remint 2, burn 1, keep 1).
 *
 *   MINT_MNEMONIC="twelve words …" npm run mint-api
 *   # or MINT_SK_HEX / GENESIS_SK_HEX
 *   # Contabo: EnvironmentFile=/etc/wlotus/mint.env
 *
 * POST /api/offer  { installId, note? }
 * GET  /api/status?installId=
 */
import { createServer } from 'node:http';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import {
  enqueueOffer,
  publicStatus,
  remainingOffersToday,
} from './offer.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const PORT = Number(process.env.MINT_API_PORT?.trim() || 8787);

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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'OPTIONS') {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      const installId = url.searchParams.get('installId') || '';
      const pub = publicStatus();
      json(res, 200, {
        ...pub,
        remainingToday: installId ? remainingOffersToday(installId) : null,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/offer') {
      const body = await readJson(req);
      const installId = String(body.installId || '').trim();
      const note = String(body.note || '').trim().slice(0, 80);
      if (!installId || installId.length < 8 || installId.length > 128) {
        json(res, 400, { error: 'installId required (8–128 chars)' });
        return;
      }
      const result = await enqueueOffer({ installId, note });
      json(res, 200, { ok: true, ...result });
      return;
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Daily limit|installId|mintAtoms/.test(msg) ? 400 : 500;
    json(res, status, { error: msg });
  }
});

server.listen(PORT, () => {
  console.log(`WLotus mint API on :${PORT}`);
  console.log(JSON.stringify(publicStatus(), null, 2));
});
