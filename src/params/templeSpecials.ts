/**
 * Temple-managed specials — ghosts & heroes.
 *
 * Desk/temple creates dedicated profiles (root burns) and registers them here.
 * On each profile's solar event date, re-offers burn more than the usual 1-atom
 * flower: burnAtoms = WLOTUS_MINER_ATOMS - deskKeep (deskKeep 0..101).
 *
 * Outside the event window the profile is still fully offerable — burn stays 1.
 *
 * Kinds:
 *   - ghost  — wandering spirits / Cô Hồn style; typically no birth date
 *   - hero   — commemorated figures; may set birthDate (event can be birth or death)
 *
 * Window is the global civil day (UTC−12 … UTC+14) around the effective event
 * date, using **server time only**.
 */

import { WLOTUS_MINER_ATOMS } from './wlotusMint.js';

export type TempleSpecialKind = 'ghost' | 'hero';

/** Default desk retain during a special event (burn 102 − 6 = 96). */
export const DEFAULT_SPECIAL_DESK_KEEP = 6;

/** Normal flower burn (always used outside an active special window). */
export const NORMAL_FLOWER_BURN_ATOMS = 1n;

export interface TempleSpecial {
  /** Root dedication burn txid (64 hex). */
  profileId: string;
  kind: TempleSpecialKind;
  /**
   * Solar YYYY-MM-DD of the commemorative day.
   * Ghosts: death / festival day. Heroes: birth or death anniversary.
   */
  eventDate: string;
  /**
   * Optional birth date (heroes). Ghosts should leave empty — no birthday.
   * Shapes: YYYY | YYYY-MM | YYYY-MM-DD.
   */
  birthDate?: string;
  /**
   * Atoms the desk keeps after the memorial burn **during the active window**.
   * burnAtoms = WLOTUS_MINER_ATOMS - deskKeep (clamped so burn ≥ 1).
   * Default {@link DEFAULT_SPECIAL_DESK_KEEP} (6). Set 0 for full miner-share burn.
   */
  deskKeep: number;
  /** Shift effective event date earlier by N days for pre-launch testing. */
  testOffsetDays: number;
  /** Optional display name (UI / status). */
  name?: string;
}

export interface TempleSpecialPublic {
  profileId: string;
  kind: TempleSpecialKind;
  name: string | null;
  eventDate: string;
  effectiveEventDate: string;
  birthDate: string | null;
  deskKeep: number;
  /** Atoms burned when active + re-offer to this profile. */
  burnAtoms: string;
  active: boolean;
  windowStartUtc: string;
  windowEndUtc: string;
}

export interface TempleSpecialsPublicStatus {
  /** Any specials configured. */
  enabled: boolean;
  serverNow: string;
  profiles: TempleSpecialPublic[];
  /** Active specials right now (subset of profiles). */
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

/** burnAtoms for an active special (always ≥ 1). */
export function burnAtomsForDeskKeep(deskKeep: number): bigint {
  const keep = clampDeskKeep(deskKeep);
  const burn = WLOTUS_MINER_ATOMS - BigInt(keep);
  return burn < 1n ? 1n : burn;
}

export function effectiveEventDate(s: Pick<TempleSpecial, 'eventDate' | 'testOffsetDays'>): string | null {
  if (!parseYmd(s.eventDate)) return null;
  if (s.testOffsetDays <= 0) return s.eventDate.trim();
  return addCalendarDays(s.eventDate.trim(), -s.testOffsetDays);
}

function normalizeKind(raw: unknown): TempleSpecialKind {
  const t = String(raw ?? '').trim().toLowerCase();
  return t === 'hero' ? 'hero' : 'ghost';
}

function normalizeSpecial(raw: Record<string, unknown>): TempleSpecial | null {
  const profileId = String(raw.profileId ?? raw.profile_id ?? '')
    .trim()
    .toLowerCase();
  if (!TXID_RE.test(profileId)) return null;
  const eventDate = String(raw.eventDate ?? raw.event_date ?? raw.deadDate ?? '').trim();
  if (!parseYmd(eventDate)) return null;
  const kind = normalizeKind(raw.kind);
  const birthRaw = String(raw.birthDate ?? raw.birth_date ?? '').trim();
  // Ghosts: no birthday by convention (drop accidental birth).
  const birthDate =
    kind === 'hero' && birthRaw ? birthRaw : kind === 'hero' ? birthRaw || undefined : undefined;
  const deskKeep = clampDeskKeep(
    raw.deskKeep ?? raw.desk_keep ?? DEFAULT_SPECIAL_DESK_KEEP,
  );
  const testOffsetDays = Math.max(
    0,
    Math.floor(Number(raw.testOffsetDays ?? raw.test_offset_days ?? 0) || 0),
  );
  const name = String(raw.name ?? '').trim() || undefined;
  return {
    profileId,
    kind,
    eventDate,
    birthDate,
    deskKeep,
    testOffsetDays,
    name,
  };
}

/**
 * Load specials from env.
 *
 * Primary: `TEMPLE_SPECIALS_JSON` — JSON array of {@link TempleSpecial}.
 * Legacy shorthand (one ghost):
 *   HUNGRY_GHOST_PROFILE_ID + HUNGRY_GHOST_DEAD_DATE
 *   [+ HUNGRY_GHOST_DESK_KEEP, HUNGRY_GHOST_TEST_OFFSET_DAYS, HUNGRY_GHOST_NAME]
 */
export function loadTempleSpecialsFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): TempleSpecial[] {
  const out: TempleSpecial[] = [];
  const seen = new Set<string>();

  const push = (s: TempleSpecial | null) => {
    if (!s || seen.has(s.profileId)) return;
    seen.add(s.profileId);
    out.push(s);
  };

  const jsonRaw =
    env.TEMPLE_SPECIALS_JSON?.trim() ||
    env.VITE_TEMPLE_SPECIALS_JSON?.trim() ||
    '';
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            push(normalizeSpecial(item as Record<string, unknown>));
          }
        }
      }
    } catch {
      /* ignore bad JSON — fall through to legacy */
    }
  }

  // Legacy single-ghost env (still supported).
  const legacyId = (
    env.HUNGRY_GHOST_PROFILE_ID?.trim() ||
    env.VITE_HUNGRY_GHOST_PROFILE_ID?.trim() ||
    ''
  ).toLowerCase();
  const legacyDate = (
    env.HUNGRY_GHOST_DEAD_DATE?.trim() ||
    env.VITE_HUNGRY_GHOST_DEAD_DATE?.trim() ||
    ''
  );
  if (TXID_RE.test(legacyId) && parseYmd(legacyDate)) {
    const deskKeep = clampDeskKeep(
      env.HUNGRY_GHOST_DESK_KEEP?.trim() ||
        env.VITE_HUNGRY_GHOST_DESK_KEEP?.trim() ||
        DEFAULT_SPECIAL_DESK_KEEP,
    );
    const testOffsetDays = Math.max(
      0,
      Math.floor(
        Number(
          env.HUNGRY_GHOST_TEST_OFFSET_DAYS?.trim() ||
            env.VITE_HUNGRY_GHOST_TEST_OFFSET_DAYS?.trim() ||
            '0',
        ) || 0,
      ),
    );
    const name =
      env.HUNGRY_GHOST_NAME?.trim() ||
      env.VITE_HUNGRY_GHOST_NAME?.trim() ||
      'Cô Hồn';
    push({
      profileId: legacyId,
      kind: 'ghost',
      eventDate: legacyDate,
      deskKeep,
      testOffsetDays,
      name,
    });
  }

  return out;
}

export function toPublicSpecial(
  s: TempleSpecial,
  nowMs: number,
): TempleSpecialPublic | null {
  const effective = effectiveEventDate(s);
  if (!effective) return null;
  const w = globalCivilDayWindowUtc(effective);
  if (!w) return null;
  const active = nowMs >= w.startMs && nowMs < w.endMs;
  const burn = burnAtomsForDeskKeep(s.deskKeep);
  return {
    profileId: s.profileId,
    kind: s.kind,
    name: s.name ?? null,
    eventDate: s.eventDate.trim(),
    effectiveEventDate: effective,
    birthDate: s.birthDate?.trim() || null,
    deskKeep: clampDeskKeep(s.deskKeep),
    burnAtoms: burn.toString(),
    active,
    windowStartUtc: new Date(w.startMs).toISOString(),
    windowEndUtc: new Date(w.endMs).toISOString(),
  };
}

export function resolveTempleSpecialsStatus(
  specials: TempleSpecial[] = loadTempleSpecialsFromEnv(),
  nowMs = Date.now(),
): TempleSpecialsPublicStatus {
  const serverNow = new Date(nowMs).toISOString();
  const profiles: TempleSpecialPublic[] = [];
  for (const s of specials) {
    const pub = toPublicSpecial(s, nowMs);
    if (pub) profiles.push(pub);
  }
  return {
    enabled: profiles.length > 0,
    serverNow,
    profiles,
    active: profiles.filter(p => p.active),
  };
}

/**
 * Resolve burn atoms for a re-offer.
 * Outside any matching active special → 1 (normal flower).
 * Inside active special for this parent → configured burn.
 */
export function resolveOfferBurnAtoms(opts: {
  parentBurnTxid?: string;
  specials?: TempleSpecial[];
  nowMs?: number;
}): { burnAtoms: bigint; special: TempleSpecialPublic | null } {
  const parent = (opts.parentBurnTxid ?? '').trim().toLowerCase();
  if (!TXID_RE.test(parent)) {
    return { burnAtoms: NORMAL_FLOWER_BURN_ATOMS, special: null };
  }
  const status = resolveTempleSpecialsStatus(
    opts.specials ?? loadTempleSpecialsFromEnv(),
    opts.nowMs,
  );
  const match = status.active.find(p => p.profileId === parent) ?? null;
  if (!match) {
    return { burnAtoms: NORMAL_FLOWER_BURN_ATOMS, special: null };
  }
  return { burnAtoms: BigInt(match.burnAtoms), special: match };
}

/** True when this re-offer is an active special (ghost/hero event day). */
export function isActiveSpecialOffer(opts: {
  parentBurnTxid?: string;
  specials?: TempleSpecial[];
  nowMs?: number;
}): boolean {
  return resolveOfferBurnAtoms(opts).special != null;
}
