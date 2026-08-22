import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import {
  MAX_JSON_BODY_BYTES,
  PayloadTooLargeError,
  readJsonBody,
} from '../src/lib/httpJson.js';

function fakeReq(
  body: Buffer[],
  headers: Record<string, string> = {},
): IncomingMessage {
  const r = new Readable({
    read() {
      for (const chunk of body) this.push(chunk);
      this.push(null);
    },
  }) as IncomingMessage;
  r.headers = headers;
  return r;
}

describe('readJsonBody', () => {
  it('parses a small JSON object', async () => {
    const req = fakeReq([Buffer.from('{"installId":"abc12345"}')]);
    await expect(readJsonBody(req)).resolves.toEqual({ installId: 'abc12345' });
  });

  it('returns {} for an empty body', async () => {
    const req = fakeReq([]);
    await expect(readJsonBody(req)).resolves.toEqual({});
  });

  it('rejects when Content-Length exceeds the cap', async () => {
    const req = fakeReq([Buffer.from('{}')], {
      'content-length': String(MAX_JSON_BODY_BYTES + 1),
    });
    await expect(readJsonBody(req)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('rejects a streamed body that exceeds the cap', async () => {
    const req = fakeReq([Buffer.alloc(2048, 0x61)]);
    await expect(readJsonBody(req, 1024)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });
});
