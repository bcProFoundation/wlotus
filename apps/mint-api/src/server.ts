#!/usr/bin/env tsx
/**
 * Prayer mint API — device PoW, server fees/sign/broadcast/burn.
 *
 *   MINT_MNEMONIC="twelve words …" npm run mint-api
 *
 *   POST /api/challenge  { installId }
 *   POST /api/submit     { installId, challengeId, nonceHex, note?, powMs?, powAttempts? }
 *   GET  /api/status?installId=
 */
import { createServer } from 'node:http';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import {
  enqueueChallenge,
  enqueueSubmit,
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

function requireInstallId(raw: unknown): string {
  const installId = String(raw || '').trim();
  if (!installId || installId.length < 8 || installId.length > 128) {
    throw new Error('installId required (8–128 chars)');
  }
  return installId;
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

    if (req.method === 'POST' && url.pathname === '/api/challenge') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const challenge = await enqueueChallenge({ installId });
      json(res, 200, challenge);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/submit') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const challengeId = String(body.challengeId || '').trim();
      const nonceHex = String(body.nonceHex || '').trim();
      const note = String(body.note || '').trim().slice(0, 80);
      if (!challengeId) {
        json(res, 400, { error: 'challengeId required' });
        return;
      }
      if (!nonceHex) {
        json(res, 400, { error: 'nonceHex required' });
        return;
      }
      const powMs =
        typeof body.powMs === 'number'
          ? body.powMs
          : body.powMs != null
            ? Number(body.powMs)
            : undefined;
      const powAttempts =
        typeof body.powAttempts === 'number'
          ? body.powAttempts
          : body.powAttempts != null
            ? Number(body.powAttempts)
            : undefined;
      const result = await enqueueSubmit({
        installId,
        challengeId,
        nonceHex,
        note,
        powMs,
        powAttempts,
      });
      json(res, 200, { ok: true, ...result });
      return;
    }

    // Legacy server-PoW path removed — clients must use challenge/submit.
    if (req.method === 'POST' && url.pathname === '/api/offer') {
      json(res, 410, {
        error:
          'POST /api/offer retired. Use POST /api/challenge then mine on-device and POST /api/submit.',
      });
      return;
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /Daily limit|installId|mintAtoms|challenge|nonce|expired|in progress/i.test(
      msg,
    )
      ? 400
      : 500;
    json(res, status, { error: msg });
  }
});

server.listen(PORT, () => {
  console.log(`wlotus mint-api (client PoW) listening on :${PORT}`);
});
