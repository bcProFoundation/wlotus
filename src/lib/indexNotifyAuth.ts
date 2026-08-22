import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';

function headerText(
  value: string | string[] | undefined,
): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && value[0]) return String(value[0]).trim();
  return '';
}

/** True when the TCP peer is loopback and the request was not nginx-proxied. */
export function isDirectLoopback(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress || '';
  const loop =
    addr === '127.0.0.1' ||
    addr === '::1' ||
    addr === '::ffff:127.0.0.1';
  if (!loop) return false;
  if (headerText(req.headers['x-real-ip'])) return false;
  if (headerText(req.headers['x-forwarded-for'])) return false;
  return true;
}

export function notifySecretFromHeaders(headers: IncomingHttpHeaders): string {
  const auth = headerText(headers.authorization);
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return headerText(headers['x-dana-index-secret']);
}

function secretsMatch(expected: string, provided: string): boolean {
  if (!expected || !provided || expected.length !== provided.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * POST /api/notify is not a public ingest trigger.
 * Allow mint-api on loopback, or a shared `DANA_INDEX_NOTIFY_SECRET`.
 */
export function allowIndexNotify(
  req: IncomingMessage,
  configuredSecret: string,
): boolean {
  if (isDirectLoopback(req)) return true;
  const secret = configuredSecret.trim();
  if (!secret) return false;
  return secretsMatch(secret, notifySecretFromHeaders(req.headers));
}
