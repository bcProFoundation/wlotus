/**
 * While mining, how often to poll `/api/status` for tipEpoch changes.
 * Clamped to 1–30s; default 2s.
 */
export function parseTipPollMs(raw: string | undefined): number {
  const n = Number((raw ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return 2_000;
  return Math.min(30_000, Math.max(1_000, Math.round(n)));
}
