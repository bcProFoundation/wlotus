import { timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * Mirrors mint-api burnToken compare (keep in sync with offer.ts).
 * Pure unit coverage for the capability check semantics.
 */
function burnTokenMatches(expected: string, provided: string | undefined): boolean {
  const a = expected;
  const b = (provided ?? '').trim();
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

describe('burnToken capability', () => {
  it('accepts exact token', () => {
    const t = randomBytes(32).toString('hex');
    expect(burnTokenMatches(t, t)).toBe(true);
  });

  it('rejects missing, wrong length, or wrong token', () => {
    const t = randomBytes(32).toString('hex');
    expect(burnTokenMatches(t, undefined)).toBe(false);
    expect(burnTokenMatches(t, '')).toBe(false);
    expect(burnTokenMatches(t, t.slice(0, -1))).toBe(false);
    expect(burnTokenMatches(t, randomBytes(32).toString('hex'))).toBe(false);
  });
});
