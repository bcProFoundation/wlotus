/**
 * Temple-managed specials — ghosts, heroes & events.
 *
 * Desk/temple registers specials in a catalog (and optional JSON). They do
 * **not** need a temple root burn. The first visitor's offering becomes the
 * on-chain root (`profileId`); later re-offers in the event window burn more
 * than the usual 1-atom flower:
 *   burnAtoms = minerAtoms - deskKeep
 * (102 − deskKeep on live 102/6; 108 − deskKeep on felt / MooreTip).
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
   *   - solar — eventDate is already a Gregorian YYYY-MM-DD (e.g. Hồ Chí Minh birthday 19 May).
 *
 * Window: global civil range (UTC−12 … UTC+14 on each edge) from eventStart
 * through eventEnd (default both = eventDate), server time only.
 * Product: Cô Hồn lunar 2/7 → 15/7; Vu Lan single lunar 15. Stories on status.
 * Country targeting: JSON `countries` (ISO); empty = Global. Home list
 * follows the selected language (then IP country if it is in that region).
 *
 * Test env: TEMPLE_SPECIAL_TEST_OFFSET_DAYS shifts every profile's effective
 * event date earlier by N days so the window can be exercised before launch.
 */

import { readFileSync } from 'node:fs';
import { WLOTUS_FELT_MINER_ATOMS, WLOTUS_MINER_ATOMS } from './wlotusMint.js';
import {
  lunarYmdToSolarYmd,
  lunarMonthLastSolarYmd,
  nextMonthlyLunarWindow,
} from '../lib/lunarCalendar.js';
import { normalizeSpecialCountries } from './specialCountries.js';
import { findCatalogEntryById, findCatalogEntryByName, templeSpecialCatalog } from './templeSpecialCatalog.js';
import { loadSpecialClaims } from './templeSpecialClaims.js';

export type TempleSpecialKind = 'ghost' | 'hero' | 'event';

/** Calendar used for `eventDate`. Default lunar (Vietnamese âm lịch). */
export type TempleEventCalendar = 'lunar' | 'solar';

/** How the event date repeats. Default yearly. */
export type TempleEventRecurrence = 'yearly' | 'monthly-lunar';

/** Default desk retain during a special event (102/6: burn 96; felt: burn 102). */
export const DEFAULT_SPECIAL_DESK_KEEP = 6;

/** Normal flower burn (always used outside an active special window). */
export const NORMAL_FLOWER_BURN_ATOMS = 1n;

/** One registered temple profile (no burn economics — those are global). */
export interface TempleSpecial {
  /** Catalog slug (vu-lan, qingming, …). */
  id: string;
  /**
   * Root dedication burn txid (64 hex). Empty until the first visitor burns.
   */
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
   * Use `'solar'` for fixed Gregorian anniversaries (e.g. Hồ Chí Minh birthday 19 May).
   */
  eventCalendar?: TempleEventCalendar;
  /**
   * Optional birth date (heroes). Ghosts/events should leave empty.
   * Shapes: YYYY | YYYY-MM | YYYY-MM-DD. Always solar for display.
   */
  birthDate?: string;
  /** Optional display name (UI / status). */
  name?: string;
  /** On-chain quê quán label for the first-burn altar. */
  birthPlace?: string;
  /**
   * Optional range start (same calendar as eventDate). Default = eventDate.
   * Example Cô Hồn: eventStart "2026-07-02", eventDate/eventEnd "2026-07-15".
   */
  eventStart?: string;
  /**
   * Optional range end (same calendar as eventDate). Default = eventDate.
   * Inclusive solar civil days after conversion.
   */
  eventEnd?: string;
  /**
   * Repeat the lunar day-of-month every lunar month (mùng 1 / rằm).
   * `eventDate` supplies the day (01 or 15); month is a placeholder.
   */
  eventRecurrence?: TempleEventRecurrence;
  /**
   * Treat `eventDate` as the last day of that lunar month (29 or 30).
   * Giao thừa / 除夕: tháng Chạp.
   */
  lunarMonthEnd?: boolean;
  /** Include the eve (14 with rằm, last day of the previous month with mùng 1). */
  monthlyEve?: boolean;
  /** Named festivals already cover these lunar months — skip the generic sóc/vọng row. */
  skipLunarMonths?: number[];
  /**
   * Hour (0–23) on the end solar day when the window closes (server UTC window
   * still uses global civil span on end day). Default end-of-civil-day.
   * Cô Hồn uses 12 (noon local intent — server uses end civil day of eventEnd).
   */
  eventEndHour?: number;
  /**
   * Temple story shown during soft pray (~2 min). Override per locale later;
   * plain string is treated as vi/default body.
   */
  story?:
    | string
    | {
        title?: string;
        body: string;
        titleEn?: string;
        bodyEn?: string;
        titleZh?: string;
        bodyZh?: string;
      };
  /**
   * ISO 3166-1 alpha-2 countries this special is local to.
   * Empty / omitted = Global (every viewer). Multi-country: `["VN","CN"]`.
   */
  countries?: string[];
}

/** Global economics + test shift (from env / GitHub variables). */
export interface TempleSpecialsGlobalConfig {
  /**
   * Atoms the desk keeps after a special-event burn (0 .. minerAtoms−1).
   * burnAtoms = minerAtoms − deskKeep.
   * Default {@link DEFAULT_SPECIAL_DESK_KEEP} (6). Set 0 for full miner-share burn.
   */
  deskKeep: number;
  /**
   * Miner share of a remint. 102 on live 102/6; 108 on felt / MooreTip.
   * Status and offer burns use this so felt specials are 108 − deskKeep.
   */
  minerAtoms?: bigint;
  /**
   * Shift every profile's effective event date **earlier** by N days.
   * For test/dryrun only — set 0 in production.
   */
  testOffsetDays: number;
}

export interface TempleSpecialPublic {
  id: string;
  /** 64-hex root txid, or empty if nobody has offered yet. */
  profileId: string;
  kind: TempleSpecialKind;
  name: string | null;
  /** Original eventDate as configured (lunar or solar). */
  eventDate: string;
  eventCalendar: TempleEventCalendar;
  /** Solar YYYY-MM-DD peak/primary day (after lunar→solar + testOffset). */
  effectiveEventDate: string;
  /** Solar range start (after offset). */
  effectiveStartDate: string;
  /** Solar range end (after offset). */
  effectiveEndDate: string;
  eventRecurrence?: TempleEventRecurrence;
  lunarMonthEnd?: boolean;
  birthDate: string | null;
  birthPlace: string | null;
  active: boolean;
  windowStartUtc: string;
  windowEndUtc: string;
  storyTitle: string | null;
  storyBody: string | null;
  storyTitleEn: string | null;
  storyBodyEn: string | null;
  storyTitleZh: string | null;
  storyBodyZh: string | null;
  /**
   * ISO country codes. Empty = Global.
   * Home events list filters on this; burns / share links do not.
   */
  countries: string[];
}

export interface TempleSpecialsPublicStatus {
  enabled: boolean;
  serverNow: string;
  /** Global desk retain during active specials. */
  deskKeep: number;
  /** Global test shift applied to all event dates. */
  testOffsetDays: number;
  /** Atoms burned when offering to an active special (minerAtoms − deskKeep). */
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


/**
 * Window spanning inclusive solar civil days from startYmd through endYmd.
 * Uses the same UTC−12…UTC+14 envelope as a single day on each edge.
 */
export function globalCivilRangeWindowUtc(
  startYmd: string,
  endYmd: string,
): { startMs: number; endMs: number } | null {
  const a = globalCivilDayWindowUtc(startYmd);
  const b = globalCivilDayWindowUtc(endYmd);
  if (!a || !b) return null;
  return { startMs: a.startMs, endMs: b.endMs };
}

export function isWithinGlobalCivilDay(nowMs: number, ymd: string): boolean {
  const w = globalCivilDayWindowUtc(ymd);
  if (!w) return false;
  return nowMs >= w.startMs && nowMs < w.endMs;
}

export function specialMinerAtoms(minerAtoms?: bigint): bigint {
  if (minerAtoms === WLOTUS_FELT_MINER_ATOMS || minerAtoms === WLOTUS_MINER_ATOMS) {
    return minerAtoms;
  }
  if (minerAtoms != null && minerAtoms >= 2n) return minerAtoms;
  return WLOTUS_MINER_ATOMS;
}

export function clampDeskKeep(
  raw: unknown,
  minerAtoms: bigint = WLOTUS_MINER_ATOMS,
): number {
  const cap = Number(specialMinerAtoms(minerAtoms)) - 1;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_SPECIAL_DESK_KEEP;
  return Math.max(0, Math.min(cap, n));
}

export function burnAtomsForDeskKeep(
  deskKeep: number,
  minerAtoms: bigint = WLOTUS_MINER_ATOMS,
): bigint {
  const miner = specialMinerAtoms(minerAtoms);
  const keep = clampDeskKeep(deskKeep, miner);
  const burn = miner - BigInt(keep);
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
  opts?: { lunarMonthEnd?: boolean },
): string | null {
  if (!parseYmd(eventDate)) return null;
  let solarYmd = eventDate.trim();
  if (eventCalendar === 'lunar') {
    if (opts?.lunarMonthEnd) {
      const p = parseYmd(eventDate);
      if (!p) return null;
      const last = lunarMonthLastSolarYmd(p.y, p.m, 7);
      if (!last) return null;
      solarYmd = last;
    } else {
      const converted = lunarYmdToSolarYmd(solarYmd, 7, false);
      if (!converted) return null;
      solarYmd = converted;
    }
  }
  if (testOffsetDays <= 0) return solarYmd;
  return addCalendarDays(solarYmd, -testOffsetDays);
}

function parseSkipLunarMonths(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const months = [
    ...new Set(
      raw
        .map(n => Math.floor(Number(n)))
        .filter(n => Number.isFinite(n) && n >= 1 && n <= 12),
    ),
  ];
  return months.length ? months : undefined;
}

function monthlyLunarWindowAroundNow(
  lunarDay: number,
  includeEve: boolean,
  skipLunarMonths: number[] | undefined,
  nowMs: number,
  testOffsetDays: number,
): { start: string; peak: string } | null {
  const utc = new Date(nowMs);
  const utcYmd = `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
  const from = addCalendarDays(utcYmd, includeEve ? -2 : -1);
  if (!from) return null;
  let ymd = from;
  let firstFuture: { start: string; peak: string } | null = null;
  for (let i = 0; i < 6 && ymd; i++) {
    const window = nextMonthlyLunarWindow(
      ymd,
      { peakDay: lunarDay, includeEve, skipLunarMonths },
      7,
    );
    if (!window) break;
    let start = window.start;
    let peak = window.peak;
    if (testOffsetDays > 0) {
      const shiftedStart = addCalendarDays(start, -testOffsetDays);
      const shiftedPeak = addCalendarDays(peak, -testOffsetDays);
      if (!shiftedStart || !shiftedPeak) break;
      start = shiftedStart;
      peak = shiftedPeak;
    }
    const w = globalCivilRangeWindowUtc(start, peak);
    if (w && nowMs >= w.startMs && nowMs < w.endMs) return { start, peak };
    if (w && nowMs < w.startMs && !firstFuture) firstFuture = { start, peak };
    const nextStart = addCalendarDays(window.peak, 1);
    if (!nextStart) break;
    ymd = nextStart;
  }
  return firstFuture;
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

function slugFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function catalogToSpecial(
  e: import('./templeSpecialCatalog.js').TempleSpecialCatalogEntry,
): TempleSpecial {
  return {
    id: e.id,
    profileId: '',
    kind: e.kind,
    eventDate: e.eventDate,
    eventCalendar: e.eventCalendar,
    birthDate: e.birthDate,
    name: e.name,
    birthPlace: e.birthPlace || undefined,
    eventStart: e.eventStart,
    eventEnd: e.eventEnd,
    eventEndHour: e.eventEndHour,
    eventRecurrence: e.eventRecurrence,
    lunarMonthEnd: e.lunarMonthEnd,
    monthlyEve: e.monthlyEve,
    skipLunarMonths: e.skipLunarMonths,
    countries: e.countries.length > 0 ? [...e.countries] : undefined,
  };
}

function catalogYearFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): number {
  const raw = env.EVENT_YEAR?.trim();
  if (raw) {
    const y = Number(raw);
    if (Number.isFinite(y) && y >= 2020 && y <= 2100) return y;
  }
  return new Date().getFullYear();
}

function normalizeSpecial(raw: Record<string, unknown>): TempleSpecial | null {
  const profileId = String(raw.profileId ?? raw.profile_id ?? '')
    .trim()
    .toLowerCase();
  const bound = TXID_RE.test(profileId) ? profileId : '';
  const name = String(raw.name ?? '').trim() || undefined;
  const yearHint = Number(String(raw.eventDate ?? '').slice(0, 4)) || 2026;
  const catalog =
    findCatalogEntryById(String(raw.id ?? raw.specialId ?? ''), yearHint) ||
    findCatalogEntryByName(name, yearHint);
  const id = (
    String(raw.id ?? raw.specialId ?? '').trim() ||
    catalog?.id ||
    (name ? slugFromName(name) : '')
  ).toLowerCase();
  const eventDate = String(
    raw.eventDate ?? raw.event_date ?? catalog?.eventDate ?? '',
  ).trim();
  if (!parseYmd(eventDate)) return null;
  if (!id && !bound) return null;
  const kind = normalizeKind(raw.kind ?? catalog?.kind);
  const eventCalendar = normalizeEventCalendar(
    raw.eventCalendar ?? raw.event_calendar ?? catalog?.eventCalendar,
  );
  const birthRaw = String(
    raw.birthDate ?? raw.birth_date ?? catalog?.birthDate ?? '',
  ).trim();
  const birthDate = kind === 'hero' && birthRaw ? birthRaw : undefined;
  const eventStartRaw = String(
    raw.eventStart ?? raw.event_start ?? catalog?.eventStart ?? '',
  ).trim();
  const eventEndRaw = String(
    raw.eventEnd ?? raw.event_end ?? catalog?.eventEnd ?? '',
  ).trim();
  const eventStart =
    eventStartRaw && parseYmd(eventStartRaw) ? eventStartRaw : undefined;
  const eventEnd = eventEndRaw && parseYmd(eventEndRaw) ? eventEndRaw : undefined;
  const endHourRaw = raw.eventEndHour ?? raw.event_end_hour ?? catalog?.eventEndHour;
  const eventEndHour =
    endHourRaw != null && Number.isFinite(Number(endHourRaw))
      ? Math.max(0, Math.min(23, Math.floor(Number(endHourRaw))))
      : undefined;
  const recRaw = String(
    raw.eventRecurrence ?? raw.event_recurrence ?? catalog?.eventRecurrence ?? '',
  )
    .trim()
    .toLowerCase();
  const eventRecurrence: TempleEventRecurrence | undefined =
    recRaw === 'monthly-lunar' || catalog?.eventRecurrence === 'monthly-lunar'
      ? 'monthly-lunar'
      : undefined;
  const lunarMonthEnd = Boolean(
    raw.lunarMonthEnd ?? raw.lunar_month_end ?? catalog?.lunarMonthEnd,
  );
  const monthlyEveRaw = raw.monthlyEve ?? raw.monthly_eve ?? catalog?.monthlyEve;
  const monthlyEve =
    monthlyEveRaw == null ? undefined : Boolean(monthlyEveRaw);
  const skipLunarMonths = parseSkipLunarMonths(
    raw.skipLunarMonths ?? raw.skip_lunar_months ?? catalog?.skipLunarMonths,
  );
  const countries = normalizeSpecialCountries(
    raw.countries ??
      raw.country ??
      raw.birthPlace ??
      raw.birth_place ??
      catalog?.countries,
  );
  const birthPlace =
    String(raw.birthPlace ?? raw.birth_place ?? catalog?.birthPlace ?? '').trim() ||
    undefined;
  let story: TempleSpecial['story'] | undefined;
  if (typeof raw.story === 'string' && raw.story.trim()) {
    story = raw.story.trim();
  } else if (raw.story && typeof raw.story === 'object') {
    const s = raw.story as Record<string, unknown>;
    const body = String(s.body ?? '').trim();
    if (body) {
      story = {
        title: String(s.title ?? '').trim() || undefined,
        body,
        titleEn: String(s.titleEn ?? s.title_en ?? '').trim() || undefined,
        bodyEn: String(s.bodyEn ?? s.body_en ?? '').trim() || undefined,
        titleZh: String(s.titleZh ?? s.title_zh ?? '').trim() || undefined,
        bodyZh: String(s.bodyZh ?? s.body_zh ?? '').trim() || undefined,
      };
    }
  }
  return {
    id: id || bound.slice(0, 12),
    profileId: bound,
    kind,
    eventDate,
    eventCalendar,
    birthDate,
    name: name || catalog?.name,
    birthPlace,
    eventStart,
    eventEnd,
    eventEndHour,
    eventRecurrence,
    lunarMonthEnd: lunarMonthEnd || undefined,
    monthlyEve,
    skipLunarMonths,
    story,
    countries: countries.length > 0 ? countries : undefined,
  };
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
 * Catalog (always) + optional JSON overlay + first-burn claims.
 * Unbound specials have empty profileId until someone offers the first flower.
 */
export function loadTempleSpecialsFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): TempleSpecial[] {
  const year = catalogYearFromEnv(env);
  const byId = new Map<string, TempleSpecial>();
  for (const entry of templeSpecialCatalog(year)) {
    byId.set(entry.id, catalogToSpecial(entry));
  }

  const jsonRaw = readTempleSpecialsRaw(env);
  if (jsonRaw) {
    try {
      const parsed = unwrapTempleSpecialsJson(JSON.parse(jsonRaw) as unknown);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const s = normalizeSpecial(item as Record<string, unknown>);
          if (!s) continue;
          const prev = byId.get(s.id);
          if (prev) {
            byId.set(s.id, {
              ...prev,
              ...s,
              id: prev.id,
              profileId: s.profileId || prev.profileId,
              countries: s.countries ?? prev.countries,
            });
          } else {
            byId.set(s.id, s);
          }
        }
      }
    } catch {
      /* ignore bad JSON */
    }
  }

  const claims = loadSpecialClaims(env);
  for (const [id, txid] of Object.entries(claims)) {
    const cur = byId.get(id);
    if (!cur) continue;
    if (!cur.profileId) cur.profileId = txid;
  }

  return [...byId.values()];
}

function readTempleSpecialsRaw(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string {
  const file = env.TEMPLE_SPECIALS_JSON_FILE?.trim();
  if (file) {
    try {
      const fromFile = readFileSync(file, 'utf8').trim();
      if (fromFile) return fromFile;
    } catch {
      /* fall through to inline JSON */
    }
  }
  return (
    env.TEMPLE_SPECIALS_JSON?.trim() ||
    env.VITE_TEMPLE_SPECIALS_JSON?.trim() ||
    ''
  );
}

/** Array, or `{ TEMPLE_SPECIALS_JSON: [...] }` from create-temple-specials. */
export function unwrapTempleSpecialsJson(parsed: unknown): unknown {
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    'TEMPLE_SPECIALS_JSON' in parsed
  ) {
    return (parsed as { TEMPLE_SPECIALS_JSON: unknown }).TEMPLE_SPECIALS_JSON;
  }
  return parsed;
}

function emptyStory(): {
  storyTitle: string | null;
  storyBody: string | null;
  storyTitleEn: string | null;
  storyBodyEn: string | null;
  storyTitleZh: string | null;
  storyBodyZh: string | null;
} {
  return {
    storyTitle: null,
    storyBody: null,
    storyTitleEn: null,
    storyBodyEn: null,
    storyTitleZh: null,
    storyBodyZh: null,
  };
}

function resolveStory(s: TempleSpecial): {
  storyTitle: string | null;
  storyBody: string | null;
  storyTitleEn: string | null;
  storyBodyEn: string | null;
  storyTitleZh: string | null;
  storyBodyZh: string | null;
} {
  const baked = defaultTempleStory(s);
  if (!s.story) return baked;
  if (typeof s.story === 'string') {
    return { ...baked, storyBody: s.story };
  }
  return {
    storyTitle: s.story.title?.trim() || baked.storyTitle,
    storyBody: s.story.body.trim() || baked.storyBody,
    storyTitleEn: s.story.titleEn?.trim() || baked.storyTitleEn,
    storyBodyEn: s.story.bodyEn?.trim() || baked.storyBodyEn,
    storyTitleZh: s.story.titleZh?.trim() || baked.storyTitleZh,
    storyBodyZh: s.story.bodyZh?.trim() || baked.storyBodyZh,
  };
}

/** Built-in temple stories from the regional catalog (matched by name). */
export function defaultTempleStory(s: TempleSpecial): {
  storyTitle: string | null;
  storyBody: string | null;
  storyTitleEn: string | null;
  storyBodyEn: string | null;
  storyTitleZh: string | null;
  storyBodyZh: string | null;
} {
  const year = Number((s.eventDate ?? '').slice(0, 4)) || 2026;
  const entry =
    findCatalogEntryById(s.id, year) || findCatalogEntryByName(s.name, year);
  if (!entry) return emptyStory();
  const st = entry.story;
  return {
    storyTitle: st.title?.trim() || entry.name,
    storyBody: st.body,
    storyTitleEn: st.titleEn?.trim() || null,
    storyBodyEn: st.bodyEn?.trim() || null,
    storyTitleZh: st.titleZh?.trim() || null,
    storyBodyZh: st.bodyZh?.trim() || null,
  };
}

export function toPublicSpecial(
  s: TempleSpecial,
  testOffsetDays: number,
  nowMs: number,
): TempleSpecialPublic | null {
  const cal = s.eventCalendar ?? 'lunar';
  const monthEnd = Boolean(s.lunarMonthEnd);
  const recurrence =
    s.eventRecurrence === 'monthly-lunar' ? 'monthly-lunar' : undefined;
  const convert = (src: string) =>
    effectiveEventDate(src, testOffsetDays, cal, { lunarMonthEnd: monthEnd });

  let a: string;
  let b: string;
  let peak: string;
  if (recurrence === 'monthly-lunar') {
    const day = parseYmd(s.eventDate)?.d;
    if (!day) return null;
    const occ = monthlyLunarWindowAroundNow(
      day,
      s.monthlyEve !== false,
      s.skipLunarMonths,
      nowMs,
      testOffsetDays,
    );
    if (!occ) return null;
    a = occ.start;
    b = occ.peak;
    peak = occ.peak;
  } else {
    const p = convert(s.eventDate);
    if (!p) return null;
    const startSolar = convert((s.eventStart ?? s.eventDate).trim());
    const endSolar = convert((s.eventEnd ?? s.eventDate).trim());
    if (!startSolar || !endSolar) return null;
    a = startSolar;
    b = endSolar;
    peak = p;
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
  }
  const w = globalCivilRangeWindowUtc(a, b);
  if (!w) return null;
  const active = nowMs >= w.startMs && nowMs < w.endMs;
  const story = resolveStory(s);
  return {
    id: s.id,
    profileId: s.profileId,
    kind: s.kind,
    name: s.name ?? null,
    eventDate: s.eventDate.trim(),
    eventCalendar: cal,
    effectiveEventDate: peak,
    effectiveStartDate: a,
    effectiveEndDate: b,
    eventRecurrence: recurrence,
    lunarMonthEnd: monthEnd || undefined,
    birthDate: s.birthDate?.trim() || null,
    birthPlace: s.birthPlace?.trim() || null,
    active,
    windowStartUtc: new Date(w.startMs).toISOString(),
    windowEndUtc: new Date(w.endMs).toISOString(),
    storyTitle: story.storyTitle,
    storyBody: story.storyBody,
    storyTitleEn: story.storyTitleEn,
    storyBodyEn: story.storyBodyEn,
    storyTitleZh: story.storyTitleZh,
    storyBodyZh: story.storyBodyZh,
    countries: s.countries ?? [],
  };
}

export function resolveTempleSpecialsStatus(
  specials: TempleSpecial[] = loadTempleSpecialsFromEnv(),
  globalCfg: TempleSpecialsGlobalConfig = loadTempleSpecialsGlobalConfig(),
  nowMs = Date.now(),
): TempleSpecialsPublicStatus {
  const serverNow = new Date(nowMs).toISOString();
  const minerAtoms = specialMinerAtoms(globalCfg.minerAtoms);
  const deskKeep = clampDeskKeep(globalCfg.deskKeep, minerAtoms);
  const testOffsetDays = Math.max(0, Math.floor(globalCfg.testOffsetDays || 0));
  const burn = burnAtomsForDeskKeep(deskKeep, minerAtoms);
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
  const match =
    status.active.find(p => p.profileId && p.profileId === parent) ?? null;
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
