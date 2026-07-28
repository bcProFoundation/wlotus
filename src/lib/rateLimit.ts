/**
 * Small, generic per-key daily counters used by apps/mint-api to bound
 * sponsored-fee abuse per `installId` (client-generated, trivially reset)
 * and, as a coarser secondary guard, per client IP (nginx-forwarded
 * `X-Real-IP`, also easy to rotate but with real-world friction/cost).
 *
 * Neither is a hard security boundary — see docs/MOBILE.md — but bounding
 * both keeps a single reset trick (clear localStorage, or one shared IP)
 * from draining the fee-sponsor wallet indefinitely.
 */

export function utcDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

export interface DailyCounter {
  /** Remaining slots for `key` today (never negative). */
  remaining(key: string): number;
  /** Consume one slot for `key`; throws once the cap is hit. */
  consume(key: string): void;
}

/**
 * Creates an independent per-key, per-UTC-day counter capped at
 * `maxPerDay`. `message` builds the thrown error text (the caller decides
 * the wording — mint-api's HTTP layer matches "Daily limit" to map this to
 * a 400, so keep that substring in any override).
 */
export function createDailyCounter(
  maxPerDay: number,
  message: (max: number) => string = (max) => `Daily limit reached (${max} per day).`,
  now: () => number = Date.now,
): DailyCounter {
  const counts = new Map<string, Map<number, number>>();

  function remaining(key: string): number {
    const day = utcDay(now());
    const used = counts.get(key)?.get(day) ?? 0;
    return Math.max(0, maxPerDay - used);
  }

  function consume(key: string): void {
    const day = utcDay(now());
    let byDay = counts.get(key);
    if (!byDay) {
      byDay = new Map();
      counts.set(key, byDay);
    }
    const used = byDay.get(day) ?? 0;
    if (used >= maxPerDay) {
      throw new Error(message(maxPerDay));
    }
    byDay.set(day, used + 1);
  }

  return { remaining, consume };
}

function expandIPv6Groups(addr: string): string[] {
  const zoneIdx = addr.indexOf('%');
  const clean = zoneIdx >= 0 ? addr.slice(0, zoneIdx) : addr;
  const parts = clean.split('::');
  if (parts.length === 1) return clean.split(':');
  const [head, tail] = parts;
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  return [...headGroups, ...Array(missing).fill('0'), ...tailGroups];
}

/**
 * Normalizes a raw client-IP header value (`X-Real-IP`, `X-Forwarded-For`,
 * or `net.Socket#remoteAddress`) into a stable rate-limiting key:
 *
 * - Takes the first hop of a comma-separated forwarded-for list.
 * - Unwraps bracketed `[ipv6]:port` and bare IPv4 `a.b.c.d:port` forms.
 * - Unwraps IPv4-mapped IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`).
 * - Collapses plain IPv6 addresses to their `/64` prefix — a single
 *   device/ISP customer can rotate the low 64 bits for free (SLAAC privacy
 *   extensions), so keying on the full address is close to meaningless.
 *
 * Returns `'unknown'` for empty/missing input (e.g. local dev without the
 * nginx proxy in front) so callers always get one consistent bucket rather
 * than `undefined`.
 */
export function normalizeClientIp(raw: string | null | undefined): string {
  const first = (raw ?? '').split(',')[0]?.trim() ?? '';
  if (!first) return 'unknown';

  let addr = first;
  const bracketed = addr.match(/^\[(.+)\](?::\d+)?$/);
  if (bracketed) addr = bracketed[1];

  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) addr = mapped[1];

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(addr)) {
    addr = addr.slice(0, addr.lastIndexOf(':'));
  }

  if (!addr.includes(':')) return addr;

  const groups = expandIPv6Groups(addr).slice(0, 4);
  return `${groups.join(':')}::/64`;
}
