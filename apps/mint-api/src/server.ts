#!/usr/bin/env tsx
/**
 * WLotus / Prayer mint API — device PoW, server fees/sign/broadcast.
 * WLotus burns the miner atom after remint (memorial dedication).
 *
 *   MINT_MNEMONIC="twelve words …" npm run mint-api
 *
 *   POST /api/challenge  { installId, note?, parentBurnTxid? }
 *   POST /api/submit     { installId, challengeId, nonceHex, powMs?, powAttempts? }
 *   POST /api/burn       { installId, remintTxid } — temple memorial after soft pray
 *   GET  /api/status?installId=
 *   GET  /health         → ok + deploy stamps (file mtime / git sha)
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import {
  enqueueBurn,
  enqueueCancel,
  enqueueChallenge,
  enqueueSubmit,
  publicStatus,
  remainingOffersToday,
} from './offer.js';


loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const PORT = Number(process.env.MINT_API_PORT?.trim() || 8787);
const STARTED_AT = new Date().toISOString();
const SERVER_FILE = fileURLToPath(import.meta.url);

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

function fileMtimeIso(path: string): string | null {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return null;
  }
}

/** Short git sha from env or `.git` (Contabo source checkout). */
function resolveGitSha(repoRoot: string): string | null {
  const env =
    process.env.GIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    process.env.MINT_API_GIT_SHA?.trim();
  if (env) return env.slice(0, 12);
  try {
    const head = readFileSync(join(repoRoot, '.git/HEAD'), 'utf8').trim();
    if (head.startsWith('ref:')) {
      const ref = head.slice(4).trim();
      return readFileSync(join(repoRoot, '.git', ref), 'utf8')
        .trim()
        .slice(0, 12);
    }
    return head.slice(0, 12);
  } catch {
    return null;
  }
}

function healthPayload(): Record<string, unknown> {
  const srcDir = dirname(SERVER_FILE);
  const offerTs = join(srcDir, 'offer.ts');
  const offerJs = join(srcDir, 'offer.js');
  const offerFile = existsSync(offerTs)
    ? offerTs
    : existsSync(offerJs)
      ? offerJs
      : null;
  // apps/mint-api/src → repo root
  const repoRoot = resolve(srcDir, '../../..');
  const pub = publicStatus();
  const serverMtime = fileMtimeIso(SERVER_FILE);
  const offerMtime = offerFile ? fileMtimeIso(offerFile) : null;
  // Prefer the newer of the two source files as "deployedAt"
  const deployedAt =
    [serverMtime, offerMtime]
      .filter((t): t is string => !!t)
      .sort()
      .at(-1) ?? null;

  return {
    ok: true,
    service: 'wlotus-mint-api',
    startedAt: STARTED_AT,
    now: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    deployedAt,
    deploy: {
      serverFile: SERVER_FILE,
      serverMtime,
      offerFile,
      offerMtime,
      gitSha: resolveGitSha(repoRoot),
      cwd: process.cwd(),
    },
    features: {
      raceOpen: pub.raceOpen === true,
      servingTipCount: pub.servingTipCount ?? null,
      tipFeeAccounts: pub.tipFeeAccounts === true,
      maxOpenChallenges: pub.maxOpenChallenges ?? null,
      openChallenges: pub.openChallenges ?? null,
      clientPow: true,
      memorialOnMint: pub.memorialOnMint === true,
      memorialOnBurn: pub.memorialOnBurn === true,
    },
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`,
    );
    if (req.method === 'OPTIONS') {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      const installId = url.searchParams.get('installId') || '';
      const pub = publicStatus();
      const health = healthPayload();
      json(res, 200, {
        ...pub,
        remainingToday: installId ? remainingOffersToday(installId) : null,
        startedAt: STARTED_AT,
        deployedAt: health.deployedAt,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, healthPayload());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/challenge') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const note = String(body.note || '').trim().slice(0, 80);
      const parentRaw = body.parentBurnTxid ?? body.parentBurnTxId;
      const parentBurnTxid =
        parentRaw != null && String(parentRaw).trim()
          ? String(parentRaw).trim()
          : undefined;
      const challenge = await enqueueChallenge({
        installId,
        note,
        parentBurnTxid,
      });
      json(res, 200, challenge);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/submit') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const challengeId = String(body.challengeId || '').trim();
      const nonceHex = String(body.nonceHex || '').trim();
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
        powMs,
        powAttempts,
      });
      json(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/burn') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const remintTxid = String(body.remintTxid || '').trim();
      if (!remintTxid) {
        json(res, 400, { error: 'remintTxid required' });
        return;
      }
      const result = await enqueueBurn({ installId, remintTxid });
      json(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/cancel') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const challengeId = String(body.challengeId || '').trim() || undefined;
      const remintTxid = String(body.remintTxid || '').trim() || undefined;
      const result = await enqueueCancel({ installId, challengeId, remintTxid });
      json(res, 200, result);
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
    const status =
      /Daily limit|installId|mintAtoms|challenge|nonce|expired|capacity|fee UTXO|Tip fee|TIP_RACE_LOST|Someone else offered|fund-tip-fee|pending memorial|remintTxid|No pending/i.test(
        msg,
      )
        ? 400
        : 500;
    json(res, status, { error: msg });
  }
});

server.listen(PORT, () => {
  const h = healthPayload();
  const feats = h.features as { raceOpen?: boolean };
  console.log(
    `wlotus mint-api listening on :${PORT} startedAt=${STARTED_AT} deployedAt=${h.deployedAt} raceOpen=${feats.raceOpen}`,
  );
});
