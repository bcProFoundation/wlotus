/**
 * Hungry Ghost Festival (Vu Lan / Trung Nguyên) — Cô Hồn special offering day.
 *
 * On the configured dead/launch solar date, offerings to the official Cô Hồn
 * profile burn the full miner share (102) instead of the usual flower burn (1).
 * UI copy uses “Cúng” rather than “Dâng Hoa”.
 *
 * Window spans all civil timezones so the calendar day is observed globally,
 * using **server time** only (client clock is ignored for eligibility).
 */

import { WLOTUS_MINER_ATOMS } from './wlotusMint.js';

/** Official Hungry Ghost / wandering spirits name (VI). */
export const HUNGRY_GHOST_NAME_VI = 'Cô Hồn';
export const HUNGRY_GHOST_NAME_EN = 'Hungry Ghost';
export const HUNGRY_GHOST_NAME_ZH = '孤魂';

/** Atoms burned to Cô Hồn on the special day (full miner share; temple keeps 6). */
export const HUNGRY_GHOST_BURN_ATOMS = WLOTUS_MINER_ATOMS;

export interface HungryGhostConfig {
  /** Root dedication burn txid (64 hex). Empty = feature off. */
  profileId: string;
  /**
   * Solar YYYY-MM-DD of the festival / “death date” for the Cô Hồn profile.
   * Launch day should match this date.
   */
  deadDate: string;
  /**
   * Shift the effective dead date earlier by N days for pre-launch testing.
   * e.g. deadDate=2026-08-28, offsetDays=15 → window centers on 2026-08-13.
   */
  testOffsetDays: number;
}

export interface HungryGhostPublicStatus {
  enabled: boolean;
  active: boolean;
  profileId: string | null;
  /** Effective solar date after test offset (YYYY-MM-DD). */
  effectiveDeadDate: string | null;
  /** Configured dead date before offset. */
  deadDate: string | null;
  testOffsetDays: number;
  /** Atoms burned when active + offering to profileId. */
  burnAtoms: string;
  /** Server clock used for the decision (ISO). */
  serverNow: string;
  /** Inclusive UTC instant when the global window opens. */
  windowStartUtc: string | null;
  /** Exclusive UTC instant when the global window ends. */
  windowEndUtc: string | null;
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Add signed calendar days to a YMD (UTC arithmetic on the civil date). */
export function addCalendarDays(ymd: string, deltaDays: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const utc = Date.UTC(p.y, p.m - 1, p.d) + deltaDays * 86_400_000;
  const dt = new Date(utc);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Global civil-day window for `ymd`.
 *
 * Any timezone from UTC−12 through UTC+14 that still shows `ymd` as the local
 * calendar date is included:
 *   start = ymd 00:00 at UTC+14  → (ymd − 1 day) 10:00 UTC
 *   end   = ymd 24:00 at UTC−12  → (ymd + 1 day) 12:00 UTC
 */
export function globalCivilDayWindowUtc(ymd: string): {
  startMs: number;
  endMs: number;
} | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  // ymd 00:00 at UTC+14 = previous calendar day 10:00 UTC
  const startMs = Date.UTC(p.y, p.m - 1, p.d - 1, 10, 0, 0, 0);
  // ymd 24:00 at UTC−12 = next calendar day 12:00 UTC
  const endMs = Date.UTC(p.y, p.m - 1, p.d + 1, 12, 0, 0, 0);
  return { startMs, endMs };
}

export function isWithinGlobalCivilDay(
  nowMs: number,
  ymd: string,
): boolean {
  const w = globalCivilDayWindowUtc(ymd);
  if (!w) return false;
  return nowMs >= w.startMs && nowMs < w.endMs;
}

export function loadHungryGhostConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): HungryGhostConfig {
  const profileId = (
    env.HUNGRY_GHOST_PROFILE_ID?.trim() ||
    env.VITE_HUNGRY_GHOST_PROFILE_ID?.trim() ||
    ''
  ).toLowerCase();
  const deadDate = (
    env.HUNGRY_GHOST_DEAD_DATE?.trim() ||
    env.VITE_HUNGRY_GHOST_DEAD_DATE?.trim() ||
    ''
  );
  const offsetRaw =
    env.HUNGRY_GHOST_TEST_OFFSET_DAYS?.trim() ||
    env.VITE_HUNGRY_GHOST_TEST_OFFSET_DAYS?.trim() ||
    '0';
  const testOffsetDays = Math.max(0, Math.floor(Number(offsetRaw) || 0));
  return { profileId, deadDate, testOffsetDays };
}

export function effectiveHungryGhostDeadDate(cfg: HungryGhostConfig): string | null {
  if (!parseYmd(cfg.deadDate)) return null;
  if (cfg.testOffsetDays <= 0) return cfg.deadDate.trim();
  return addCalendarDays(cfg.deadDate.trim(), -cfg.testOffsetDays);
}

export function resolveHungryGhostStatus(
  cfg: HungryGhostConfig,
  nowMs = Date.now(),
): HungryGhostPublicStatus {
  const serverNow = new Date(nowMs).toISOString();
  const profileOk = /^[0-9a-f]{64}$/.test(cfg.profileId);
  const effective = effectiveHungryGhostDeadDate(cfg);
  if (!profileOk || !effective) {
    return {
      enabled: false,
      active: false,
      profileId: profileOk ? cfg.profileId : null,
      effectiveDeadDate: effective,
      deadDate: parseYmd(cfg.deadDate) ? cfg.deadDate.trim() : null,
      testOffsetDays: cfg.testOffsetDays,
      burnAtoms: HUNGRY_GHOST_BURN_ATOMS.toString(),
      serverNow,
      windowStartUtc: null,
      windowEndUtc: null,
    };
  }
  const w = globalCivilDayWindowUtc(effective)!;
  const active = nowMs >= w.startMs && nowMs < w.endMs;
  return {
    enabled: true,
    active,
    profileId: cfg.profileId,
    effectiveDeadDate: effective,
    deadDate: cfg.deadDate.trim(),
    testOffsetDays: cfg.testOffsetDays,
    burnAtoms: HUNGRY_GHOST_BURN_ATOMS.toString(),
    serverNow,
    windowStartUtc: new Date(w.startMs).toISOString(),
    windowEndUtc: new Date(w.endMs).toISOString(),
  };
}

/** True when this re-offer targets the Cô Hồn root during the active window. */
export function isHungryGhostSpecialOffer(opts: {
  parentBurnTxid?: string;
  cfg?: HungryGhostConfig;
  nowMs?: number;
}): boolean {
  const cfg = opts.cfg ?? loadHungryGhostConfigFromEnv();
  const st = resolveHungryGhostStatus(cfg, opts.nowMs);
  if (!st.enabled || !st.active || !st.profileId) return false;
  const parent = (opts.parentBurnTxid ?? '').trim().toLowerCase();
  return parent === st.profileId;
}
