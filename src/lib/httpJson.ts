import type { IncomingMessage } from 'node:http';

/** Shared POST body cap for mint-api and dana-index. */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

export class PayloadTooLargeError extends Error {
  readonly status = 413;
  constructor(maxBytes = MAX_JSON_BODY_BYTES) {
    super(`Request body too large (max ${maxBytes} bytes)`);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * Read a JSON object from an HTTP request, rejecting oversized bodies
 * before they can fill memory. Empty body → `{}`.
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<Record<string, unknown>> {
  const declared = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    req.destroy();
    throw new PayloadTooLargeError(maxBytes);
  }
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) {
    const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
    n += buf.length;
    if (n > maxBytes) {
      req.destroy();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(buf);
  }
  if (n === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
    string,
    unknown
  >;
}
