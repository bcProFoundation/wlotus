import { createDailyCounter, normalizeClientIp, utcDay } from '../src/lib/rateLimit.js';

describe('normalizeClientIp', () => {
  it('passes through a bare IPv4 address', () => {
    expect(normalizeClientIp('203.0.113.42')).toBe('203.0.113.42');
  });

  it('takes the first hop of a comma-separated forwarded-for list', () => {
    expect(normalizeClientIp('203.0.113.42, 10.0.0.1, 10.0.0.2')).toBe(
      '203.0.113.42',
    );
  });

  it('strips a trailing :port from a bare IPv4 address', () => {
    expect(normalizeClientIp('203.0.113.42:51820')).toBe('203.0.113.42');
  });

  it('unwraps bracketed IPv6 with a port', () => {
    expect(normalizeClientIp('[2001:db8::1]:443')).toBe('2001:db8:0:0::/64');
  });

  it('unwraps IPv4-mapped IPv6', () => {
    expect(normalizeClientIp('::ffff:203.0.113.42')).toBe('203.0.113.42');
  });

  it('collapses a full IPv6 address to its /64 prefix', () => {
    expect(normalizeClientIp('2001:db8:0:0:1234:5678:9abc:def0')).toBe(
      '2001:db8:0:0::/64',
    );
  });

  it('collapses a compressed IPv6 address to the same /64 as its expanded form', () => {
    expect(normalizeClientIp('2001:db8::1234:5678:9abc:def0')).toBe(
      normalizeClientIp('2001:db8:0:0:1234:5678:9abc:def0'),
    );
  });

  it('gives two devices on the same /64 prefix the same key even with different low bits', () => {
    const a = normalizeClientIp('2001:db8:1234:5678:aaaa:bbbb:cccc:dddd');
    const b = normalizeClientIp('2001:db8:1234:5678:1111:2222:3333:4444');
    expect(a).toBe(b);
  });

  it('gives different /64 prefixes different keys', () => {
    const a = normalizeClientIp('2001:db8:1234:5678::1');
    const b = normalizeClientIp('2001:db8:1234:9999::1');
    expect(a).not.toBe(b);
  });

  it('falls back to a stable bucket for empty/missing input', () => {
    expect(normalizeClientIp(undefined)).toBe('unknown');
    expect(normalizeClientIp(null)).toBe('unknown');
    expect(normalizeClientIp('')).toBe('unknown');
  });
});

describe('createDailyCounter', () => {
  it('allows up to maxPerDay consumptions per key, then throws', () => {
    const counter = createDailyCounter(2);
    expect(counter.remaining('a')).toBe(2);
    counter.consume('a');
    expect(counter.remaining('a')).toBe(1);
    counter.consume('a');
    expect(counter.remaining('a')).toBe(0);
    expect(() => counter.consume('a')).toThrow(/Daily limit/i);
  });

  it('tracks each key independently', () => {
    const counter = createDailyCounter(1);
    counter.consume('a');
    expect(counter.remaining('a')).toBe(0);
    expect(counter.remaining('b')).toBe(1);
    counter.consume('b');
    expect(counter.remaining('b')).toBe(0);
  });

  it('resets once the UTC day rolls over', () => {
    let now = Date.UTC(2026, 0, 1, 23, 59, 0);
    const counter = createDailyCounter(1, undefined, () => now);
    counter.consume('a');
    expect(counter.remaining('a')).toBe(0);
    now = Date.UTC(2026, 0, 2, 0, 1, 0);
    expect(counter.remaining('a')).toBe(1);
    counter.consume('a');
    expect(() => counter.consume('a')).toThrow();
  });

  it('uses a custom message builder that still mentions "Daily limit"', () => {
    const counter = createDailyCounter(
      1,
      (max) => `Daily limit reached (${max} offerings from this network).`,
    );
    counter.consume('x');
    expect(() => counter.consume('x')).toThrow(
      'Daily limit reached (1 offerings from this network).',
    );
  });
});

describe('utcDay', () => {
  it('is stable within the same UTC day and advances the next day', () => {
    const d1 = utcDay(Date.UTC(2026, 0, 1, 0, 0, 0));
    const d2 = utcDay(Date.UTC(2026, 0, 1, 23, 59, 59));
    const d3 = utcDay(Date.UTC(2026, 0, 2, 0, 0, 0));
    expect(d1).toBe(d2);
    expect(d3).toBe(d1 + 1);
  });
});
