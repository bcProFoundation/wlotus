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
 *   POST /api/specials/claim { installId, specialId, profileId } — first root wins
 *   GET  /api/status?installId=
 *   GET  /api/root-creator?txid=&installId= → { isCreator, known }
 *   GET  /health         → ok + deploy stamps (file mtime / git sha)
 */
import './loadMintEnv.boot.js';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkRootCreator,
  enqueueBurn,
  enqueueCancel,
  enqueueChallenge,
  enqueueSubmit,
  publicStatus,
  remainingOffersToday,
  requireMintDesk,
} from './offer.js';
import {
  deletePushSubscription,
  savePushSubscription,
  startMorningReminderLoop,
  vapidPublicKey,
} from './pushReminders.js';
import {
  memorialNoteMaxBytes,
  prepareDanaNote,
  truncateUtf8Bytes,
} from '../../../src/offering/altarFields.js';
import { findCatalogEntryById } from '../../../src/params/templeSpecialCatalog.js';
import { claimSpecialRoot } from '../../../src/params/templeSpecialClaims.js';
import {
  PayloadTooLargeError,
  readJsonBody,
} from '../../../src/lib/httpJson.js';

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
  return readJsonBody(req);
}

function requireInstallId(raw: unknown): string {
  const installId = String(raw || '').trim();
  if (!installId || installId.length < 8 || installId.length > 128) {
    throw new Error('installId required (8–128 chars)');
  }
  return installId;
}

/**
 * Best-effort client IP for the secondary per-IP daily cap (see
 * src/lib/rateLimit.ts + docs/MOBILE.md). `X-Real-IP` is what
 * deploy/contabo's nginx configs set from `$remote_addr`, so it's trusted
 * ahead of the more easily spoofed `X-Forwarded-For`. Falls back to the raw
 * socket address for local dev without the nginx proxy in front.
 */
function clientIp(req: import('node:http').IncomingMessage): string | undefined {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded;
  if (Array.isArray(forwarded) && forwarded.length) return forwarded[0];
  return req.socket.remoteAddress ?? undefined;
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
      servingTipIndex: pub.servingTipIndex ?? null,
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
        remainingToday: installId
          ? remainingOffersToday(installId, clientIp(req))
          : null,
        startedAt: STARTED_AT,
        deployedAt: health.deployedAt,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/root-creator') {
      const installId = requireInstallId(url.searchParams.get('installId'));
      const txid = String(url.searchParams.get('txid') || '').trim();
      if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
        json(res, 400, { error: 'txid required (64 hex)' });
        return;
      }
      json(res, 200, checkRootCreator({ rootBurnTxid: txid, installId }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/push/vapid') {
      const publicKey = vapidPublicKey();
      if (!publicKey) {
        json(res, 503, { error: 'push unavailable' });
        return;
      }
      json(res, 200, { publicKey });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/push/subscribe') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const keys = (body.keys && typeof body.keys === 'object'
        ? body.keys
        : {}) as { p256dh?: string; auth?: string };
      json(
        res,
        200,
        savePushSubscription({
          installId,
          endpoint: String(body.endpoint || ''),
          keys,
          locale: String(body.locale || ''),
          timeZone: String(body.timeZone || ''),
          altars: body.altars,
        }),
      );
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/push/unsubscribe') {
      const body = await readJson(req);
      json(res, 200, deletePushSubscription(String(body.endpoint || '')));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, healthPayload());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/challenge') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const parentRaw = body.parentBurnTxid ?? body.parentBurnTxId;
      const parentBurnTxid =
        parentRaw != null && String(parentRaw).trim()
          ? String(parentRaw).trim()
          : undefined;
      const note = truncateUtf8Bytes(
        prepareDanaNote(
          String(body.note || ''),
          Boolean(parentBurnTxid),
        ),
        memorialNoteMaxBytes(Boolean(parentBurnTxid)),
      );
      const challenge = await enqueueChallenge({
        installId,
        note,
        parentBurnTxid,
        ip: clientIp(req),
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
        ip: clientIp(req),
      });
      json(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/burn') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const remintTxid = String(body.remintTxid || '').trim();
      const burnToken = String(body.burnToken || '').trim();
      if (!remintTxid) {
        json(res, 400, { error: 'remintTxid required' });
        return;
      }
      if (!burnToken || burnToken.length < 32) {
        json(res, 400, { error: 'burnToken required' });
        return;
      }
      const result = await enqueueBurn({ installId, remintTxid, burnToken });
      json(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/specials/claim') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const specialId = String(body.specialId || body.id || '').trim();
      const profileId = String(body.profileId || body.txid || '')
        .trim()
        .toLowerCase();
      if (!specialId) {
        json(res, 400, { error: 'specialId required' });
        return;
      }
      if (!findCatalogEntryById(specialId)) {
        json(res, 404, { error: 'unknown special' });
        return;
      }
      const creator = checkRootCreator({
        rootBurnTxid: profileId,
        installId,
      });
      if (!creator.isCreator) {
        json(res, 403, { error: 'claimant must be the root offerer' });
        return;
      }
      const claimed = claimSpecialRoot(specialId, profileId);
      if (!claimed.ok) {
        const status = claimed.error === 'already claimed' ? 409 : 400;
        json(res, status, {
          error: claimed.error,
          profileId: claimed.profileId,
        });
        return;
      }
      json(res, 200, {
        ok: true,
        profileId: claimed.profileId,
        created: claimed.created,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/cancel') {
      const body = await readJson(req);
      const installId = requireInstallId(body.installId);
      const challengeId = String(body.challengeId || '').trim() || undefined;
      const remintTxid = String(body.remintTxid || '').trim() || undefined;
      const burnToken = String(body.burnToken || '').trim() || undefined;
      if (remintTxid && (!burnToken || burnToken.length < 32)) {
        json(res, 400, {
          error: 'burnToken required to abandon a pending memorial burn',
        });
        return;
      }
      const result = await enqueueCancel({
        installId,
        challengeId,
        remintTxid,
        burnToken,
      });
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
      e instanceof PayloadTooLargeError
        ? 413
        : /Too many challenges/i.test(msg)
          ? 429
          : /Daily limit|installId|mintAtoms|challenge|nonce|expired|capacity|fee UTXO|Tip fee|TIP_RACE_LOST|Someone else offered|fund-tip-fee|pending memorial|remintTxid|No pending|burnToken|Invalid burn|profile creator|edit relationships|txid required|already claimed|unknown special|claimant must|push endpoint|push keys/i.test(
                msg,
              )
            ? 400
            : 500;
    json(res, status, { error: msg });
  }
});

try {
  requireMintDesk();
} catch (err) {
  console.error('mint-api refused to start:', err);
  process.exit(1);
}

server.listen(PORT, () => {
  const h = healthPayload();
  const feats = h.features as {
    raceOpen?: boolean;
    servingTipIndex?: number | null;
    servingTipCount?: number | null;
  };
  console.log(
    `wlotus mint-api listening on :${PORT} startedAt=${STARTED_AT} deployedAt=${h.deployedAt} raceOpen=${feats.raceOpen} servingTipIndex=${feats.servingTipIndex} servingTipCount=${feats.servingTipCount}`,
  );
  startMorningReminderLoop();
});
server.on('error', err => {
  console.error(`mint-api listen :${PORT} failed:`, err);
  process.exit(1);
});
