/**
 * Temple-managed specials — ghosts, heroes & events.
 *
 * Desk/temple creates dedicated profiles (root burns) and registers them in
 * TEMPLE_SPECIALS_JSON. On each profile's event date, re-offers burn more
 * than the usual 1-atom flower:
 *   burnAtoms = WLOTUS_MINER_ATOMS - deskKeep
 * where deskKeep is a **global** env (TEMPLE_SPECIAL_DESK_KEEP), not per-profile.
 *
 * Outside the event window the profile is still fully offerable — burn stays 1.
 *
 * Kinds:
 *   - ghost  — wandering spirits / Cô Hồn style; typically no birth date; UI "Cúng"
 *   - event  — festivals (Vu Lan Báo Hiếu); normal Dâng Hoa / Offering copy
 *   - hero   — commemorated figures; may set birthDate (event can be birth or death)
 *
 * Event calendar:
 *   - lunar (default) — eventDate is a lunar YYYY-MM-DD; converted to solar
 *     via Hồ Ngọc Đức algorithm (VN timeZone 7) before the civil-day window.
 *   - solar — eventDate is already a Gregorian YYYY-MM-DD (e.g. Hồ Chí Minh).
 *
 * Window (code today): global civil day (UTC−12 … UTC+14) around the effective
 * event date, using **server time only**.
 * Product intent: Cô Hồn multi-day lunar 2/7 00:00 → 15/7 12:00 local;
 * Vu Lan one full civil day of lunar 15. Range fields are a follow-up.
 *
 * Test env: TEMPLE_SPECIAL_TEST_OFFSET_DAYS shifts every profile's effective
 * event date earlier by N days so the window can be exercised before launch.
 */

import { WLOTUS_MINER_ATOMS } from './wlotusMint.js';
import { lunarYmdToSolarYmd } from '../lib/lunarCalendar.js';

export type TempleSpecialKind = 'ghost' | 'hero' | 'event';

/** Calendar used for `eventDate`. Default lunar (Vietnamese âm lịch). */
export type TempleEventCalendar = 'lunar' | 'solar';

/** Default desk retain during a special event (burn 102 − 6 = 96). */
export const DEFAULT_SPECIAL_DESK_KEEP = 6;

/** Normal flower burn (always used outside an active special window). */
export const NORMAL_FLOWER_BURN_ATOMS = 1n;

/** One registered temple profile (no burn economics — those are global). */
export interface TempleSpecial {
  /** Root dedication burn txid (64 hex). */
  profileId: string;
  kind: TempleSpecialKind;
  /**
   * YYYY-MM-DD of the commemorative day, in the calendar given by
   * {@link eventCalendar}.
   * Ghosts: death / festival day. Events: festival day. Heroes: birth or death anniversary.
   */
  eventDate: string;
  /**
   * Calendar of `eventDate`. Default `'lunar'` (âm lịch).
   * Use `'solar'` for fixed Gregorian anniversaries (e.g. Hồ Chí Minh 2 Sep).
   */
  eventCalendar?: TempleEventCalendar;
  /**
   * Optional birth date (heroes). Ghosts/events should leave empty.
   * Shapes: YYYY | YYYY-MM | YYYY-MM-DD. Always solar for display.
   */
  birthDate?: string;
  /** Optional display name (UI / status). */
  name?: string;
}

/** Global economics + test shift (from env / GitHub variables). */
export interface TempleSpecialsGlobalConfig {
  /**
   * Atoms the desk keeps after a special-event burn (0..101).
   * burnAtoms = WLOTUS_MINER_ATOMS - deskKeep.
   * Default {@link DEFAULT_SPECIAL_DESK_KEEP} (6). Set 0 for full miner-share burn.
   */
  deskKeep: number;
  /**
   * Shift every profile's effective event date **earlier** by N days.
   * For test/dryrun only — set 0 in production.
   */
  testOffsetDays: number;
}

export interface TempleSpecialPublic {
  profileId: string;
  kind: TempleSpecialKind;
  name: string | null;
  /** Original eventDate as configured (lunar or solar). */
  eventDate: string;
  eventCalendar: TempleEventCalendar;
  /** Solar YYYY-MM-DD used for the window (after lunar→solar + testOffset). */
  effectiveEventDate: string;
  birthDate: string | null;
  active: boolean;
  windowStartUtc: string;
  windowEndUtc: string;
}

export interface TempleSpecialsPublicStatus {
  enabled: boolean;
  serverNow: string;
  /** Global desk retain during active specials. */
  deskKeep: number;
  /** Global test shift applied to all event dates. */
  testOffsetDays: number;
  /** Atoms burned when offering to an active special (102 − deskKeep). */
  burnAtoms: string;
  profiles: TempleSpecialPublic[];
  active: TempleSpecialPublic[];
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TXID_RE = /^[0-9a-f]{64}$/;

export function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

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
 * start = ymd 00:00 at UTC+14 → (ymd − 1 day) 10:00 UTC
 * end   = ymd 24:00 at UTC−12 → (ymd + 1 day) 12:00 UTC
 */
export function globalCivilDayWindowUtc(ymd: string): {
  startMs: number;
  endMs: number;
} | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const startMs = Date.UTC(p.y, p.m - 1, p.d - 1, 10, 0, 0, 0);
  const endMs = Date.UTC(p.y, p.m - 1, p.d + 1, 12, 0, 0, 0);
  return { startMs, endMs };
}

export function isWithinGlobalCivilDay(nowMs: number, ymd: string): boolean {
  const w = globalCivilDayWindowUtc(ymd);
  if (!w) return false;
  return nowMs >= w.startMs && nowMs < w.endMs;
}

export function clampDeskKeep(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_SPECIAL_DESK_KEEP;
  return Math.max(0, Math.min(Number(WLOTUS_MINER_ATOMS) - 1, n));
}

export function burnAtomsForDeskKeep(deskKeep: number): bigint {
  const keep = clampDeskKeep(deskKeep);
  const burn = WLOTUS_MINER_ATOMS - BigInt(keep);
  return burn < 1n ? 1n : burn;
}

/**
 * Resolve the solar YYYY-MM-DD used for the civil-day window.
 * - solar calendar → eventDate as-is
 * - lunar calendar → convert via Hồ Ngọc Đức (VN timeZone 7), non-leap
 * Then apply testOffsetDays (shift earlier).
 */
export function effectiveEventDate(
  eventDate: string,
  testOffsetDays: number,
  eventCalendar: TempleEventCalendar = 'lunar',
): string | null {
  if (!parseYmd(eventDate)) return null;
  let solarYmd = eventDate.trim();
  if (eventCalendar === 'lunar') {
    const converted = lunarYmdToSolarYmd(solarYmd, 7, false);
    if (!converted) return null;
    solarYmd = converted;
  }
  if (testOffsetDays <= 0) return solarYmd;
  return addCalendarDays(solarYmd, -testOffsetDays);
}

function normalizeKind(raw: unknown): TempleSpecialKind {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'hero') return 'hero';
  if (t === 'event') return 'event';
  return 'ghost';
}

function normalizeEventCalendar(raw: unknown): TempleEventCalendar {
  const t = String(raw ?? '').trim().toLowerCase();
  return t === 'solar' ? 'solar' : 'lunar';
}

function normalizeSpecial(raw: Record<string, unknown>): TempleSpecial | null {
  const profileId = String(raw.profileId ?? raw.profile_id ?? '')
    .trim()
    .toLowerCase();
  if (!TXID_RE.test(profileId)) return null;
  const eventDate = String(
    raw.eventDate ?? raw.event_date ?? '',
  ).trim();
  if (!parseYmd(eventDate)) return null;
  const kind = normalizeKind(raw.kind);
  const eventCalendar = normalizeEventCalendar(
    raw.eventCalendar ?? raw.event_calendar,
  );
  const birthRaw = String(raw.birthDate ?? raw.birth_date ?? '').trim();
  // Only heroes keep birthDate.
  const birthDate = kind === 'hero' && birthRaw ? birthRaw : undefined;
  const name = String(raw.name ?? '').trim() || undefined;
  return { profileId, kind, eventDate, eventCalendar, birthDate, name };
}

/**
 * Global deskKeep + testOffsetDays from env / GitHub variables.
 *
 *   TEMPLE_SPECIAL_DESK_KEEP          (default 6)
 *   TEMPLE_SPECIAL_TEST_OFFSET_DAYS   (default 0; test env only)
 *
 * VITE_* mirrors accepted for SPA builds that bake the same values.
 */
export function loadTempleSpecialsGlobalConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): TempleSpecialsGlobalConfig {
  const deskKeep = clampDeskKeep(
    env.TEMPLE_SPECIAL_DESK_KEEP?.trim() ||
      env.VITE_TEMPLE_SPECIAL_DESK_KEEP?.trim() ||
      DEFAULT_SPECIAL_DESK_KEEP,
  );
  const testOffsetDays = Math.max(
    0,
    Math.floor(
      Number(
        env.TEMPLE_SPECIAL_TEST_OFFSET_DAYS?.trim() ||
          env.VITE_TEMPLE_SPECIAL_TEST_OFFSET_DAYS?.trim() ||
          '0',
      ) || 0,
    ),
  );
  return { deskKeep, testOffsetDays };
}

/**
 * Load profile list from TEMPLE_SPECIALS_JSON (no legacy HUNGRY_GHOST_*).
 * deskKeep / testOffsetDays are **not** read from the JSON — use global env.
 */
export function loadTempleSpecialsFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): TempleSpecial[] {
  const out: TempleSpecial[] = [];
  const seen = new Set<string>();

  const jsonRaw =
    env.TEMPLE_SPECIALS_JSON?.trim() ||
    env.VITE_TEMPLE_SPECIALS_JSON?.trim() ||
    '';
  if (!jsonRaw) return out;

  try {
    const parsed = JSON.parse(jsonRaw) as unknown;
    if (!Array.isArray(parsed)) return out;
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const s = normalizeSpecial(item as Record<string, unknown>);
      if (!s || seen.has(s.profileId)) continue;
      seen.add(s.profileId);
      out.push(s);
    }
  } catch {
    /* ignore bad JSON */
  }
  return out;
}

export function toPublicSpecial(
  s: TempleSpecial,
  testOffsetDays: number,
  nowMs: number,
): TempleSpecialPublic | null {
  const cal = s.eventCalendar ?? 'lunar';
  const effective = effectiveEventDate(s.eventDate, testOffsetDays, cal);
  if (!effective) return null;
  const w = globalCivilDayWindowUtc(effective);
  if (!w) return null;
  const active = nowMs >= w.startMs && nowMs < w.endMs;
  return {
    profileId: s.profileId,
    kind: s.kind,
    name: s.name ?? null,
    eventDate: s.eventDate.trim(),
    eventCalendar: cal,
    effectiveEventDate: effective,
    birthDate: s.birthDate?.trim() || null,
    active,
    windowStartUtc: new Date(w.startMs).toISOString(),
    windowEndUtc: new Date(w.endMs).toISOString(),
  };
}

export function resolveTempleSpecialsStatus(
  specials: TempleSpecial[] = loadTempleSpecialsFromEnv(),
  globalCfg: TempleSpecialsGlobalConfig = loadTempleSpecialsGlobalConfig(),
  nowMs = Date.now(),
): TempleSpecialsPublicStatus {
  const serverNow = new Date(nowMs).toISOString();
  const deskKeep = clampDeskKeep(globalCfg.deskKeep);
  const testOffsetDays = Math.max(0, Math.floor(globalCfg.testOffsetDays || 0));
  const burn = burnAtomsForDeskKeep(deskKeep);
  const profiles: TempleSpecialPublic[] = [];
  for (const s of specials) {
    const pub = toPublicSpecial(s, testOffsetDays, nowMs);
    if (pub) profiles.push(pub);
  }
  return {
    enabled: profiles.length > 0,
    serverNow,
    deskKeep,
    testOffsetDays,
    burnAtoms: burn.toString(),
    profiles,
    active: profiles.filter(p => p.active),
  };
}

/**
 * Resolve burn atoms for a re-offer.
 * Outside any matching active special → 1 (normal flower).
 * Inside active special for this parent → global special burn.
 * Never rejects — specials only raise the burn amount.
 */
export function resolveOfferBurnAtoms(opts: {
  parentBurnTxid?: string;
  specials?: TempleSpecial[];
  globalCfg?: TempleSpecialsGlobalConfig;
  nowMs?: number;
}): { burnAtoms: bigint; special: TempleSpecialPublic | null } {
  const parent = (opts.parentBurnTxid ?? '').trim().toLowerCase();
  if (!TXID_RE.test(parent)) {
    return { burnAtoms: NORMAL_FLOWER_BURN_ATOMS, special: null };
  }
  const status = resolveTempleSpecialsStatus(
    opts.specials ?? loadTempleSpecialsFromEnv(),
    opts.globalCfg ?? loadTempleSpecialsGlobalConfig(),
    opts.nowMs,
  );
  const match = status.active.find(p => p.profileId === parent) ?? null;
  if (!match) {
    return { burnAtoms: NORMAL_FLOWER_BURN_ATOMS, special: null };
  }
  return { burnAtoms: BigInt(status.burnAtoms), special: match };
}

export function isActiveSpecialOffer(opts: {
  parentBurnTxid?: string;
  specials?: TempleSpecial[];
  globalCfg?: TempleSpecialsGlobalConfig;
  nowMs?: number;
}): boolean {
  return resolveOfferBurnAtoms(opts).special != null;
}
