import type { IncomingMessage } from 'node:http';
import {
  allowIndexNotify,
  isDirectLoopback,
  notifySecretFromHeaders,
} from '../src/lib/indexNotifyAuth.js';

function fakeReq(opts: {
  remoteAddress?: string;
  headers?: Record<string, string>;
}): IncomingMessage {
  return {
    socket: { remoteAddress: opts.remoteAddress ?? '127.0.0.1' },
    headers: opts.headers ?? {},
  } as IncomingMessage;
}

describe('index notify auth', () => {
  it('allows a direct loopback connection with no forwarded headers', () => {
    const req = fakeReq({ remoteAddress: '127.0.0.1' });
    expect(isDirectLoopback(req)).toBe(true);
    expect(allowIndexNotify(req, '')).toBe(true);
  });

  it('treats nginx-proxied loopback as public', () => {
    const req = fakeReq({
      remoteAddress: '127.0.0.1',
      headers: { 'x-real-ip': '203.0.113.9' },
    });
    expect(isDirectLoopback(req)).toBe(false);
    expect(allowIndexNotify(req, '')).toBe(false);
  });

  it('accepts a matching bearer secret from a public IP', () => {
    const req = fakeReq({
      remoteAddress: '203.0.113.9',
      headers: { authorization: 'Bearer s3cret-token-value' },
    });
    expect(allowIndexNotify(req, 's3cret-token-value')).toBe(true);
  });

  it('rejects a wrong-length secret without throwing', () => {
    const req = fakeReq({
      remoteAddress: '203.0.113.9',
      headers: { 'x-dana-index-secret': 'nope' },
    });
    expect(allowIndexNotify(req, 's3cret-token-value')).toBe(false);
  });

  it('reads bearer and x-dana-index-secret headers', () => {
    expect(
      notifySecretFromHeaders({ authorization: 'Bearer abc' }),
    ).toBe('abc');
    expect(
      notifySecretFromHeaders({ 'x-dana-index-secret': 'xyz' }),
    ).toBe('xyz');
  });
});
