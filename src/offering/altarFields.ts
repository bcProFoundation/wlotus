/**
 * WLotus altar memorial note packing (on-chain, separator fields — not JSON).
 * See docs/ALTAR.md.
 *
 * Wire (UTF-8), Unit Separator U+001F between fields:
 *   title \x1f name \x1f note \x1f birthPlace \x1f birthYear \x1f deathDate
 *     \x1f deathPlace \x1f funeralPlace \x1f relationshipType \x1f relatedTxid
 *     \x1f kind \x1f dateCalendar
 *
 * Star-fragment burns under a root do **not** re-pack the full altar:
 *   - Re-offer: DANA v2 parent = root + optional free-text memorial message
 *     (only after a death date exists — living profiles cannot re-offer)
 *   - Relationship: DANA v2 parent = root + relationship slots only
 *   - Death date: DANA v2 parent = root + deathDate (+ optional places)
 *     when the root was created as a living profile (empty death date)
 * Root identity (name / honorific / birth) is written once; death date may be
 * added later via a star fragment. Clients merge burns under a star for display.
 *
 * `title` is a locale-neutral honorific code: `` | `mr` | `mrs`
 * (UI: Mr./Mrs. · Ông/Bà · 先生/女士).
 *
 * Places are coarse free text for now. Geotag later via OpenStreetMap Nominatim
 * → compact geohash in the same place slots (no AI geocoding).
 *
 * `relationshipType` / `relatedTxid` link this altar to another WLotus altar
 * (its original dedication burn txid): `spouse` | `parent` | `child`, where
 * each value is the **related** person's role toward this memorial
 * (`parent` = Cha/mẹ, `child` = Con, `spouse` = Vợ/Chồng).
 * On the wire, relationship type is packed as a one-letter code (`s`/`p`/`c`)
 * to save OP_RETURN budget; readers still accept the long forms.
 *
 * Writing relationship links is intentionally left OPEN (any device, at
 * setup or later via a relationship star-fragment) — see docs/ALTAR.md
 * § "Relationships — open for now, restrict later".
 *
 * `kind` / `dateCalendar` (fields 11–12) mark a user altar as an **event**
 * (`e`) and whether the date slot should display as lunar (`l`) or solar
 * (`s`). Empty kind = person / memorial. The civil `deathDate` slot is
 * always solar YYYY-MM-DD (same as temple specials); lunar is a display
 * conversion from that day. Old clients ignore trailing extra parts.
 */

export const ALTAR_SEP = '\u001f';

/**
 * eCash standard relay policy: max OP_RETURN *script* size (bytes).
 * ALP BURN + DANA memorial EMPP must fit under this.
 */
export const OP_RETURN_SCRIPT_MAX_BYTES = 223;

/**
 * Max UTF-8 bytes for the DANA memorial *note* so a **BURN + DATA** OP_RETURN
 * (offeringId `wlotus`) stays ≤ 223. Temple burns also try to SEND leftover
 * miner inventory in the same tx; if that overflows, `burnOnePrayer` retries
 * without leftover SEND so the flower still lands.
 *
 * Caps are UTF-8 **bytes**, not characters. Vietnamese accented letters are
 * typically 2–3 bytes each; Chinese/Japanese (han/kana) are typically 3.
 * A “short” memorial still fills this. Truncation is per code point so a
 * CJK glyph is never split mid-character.
 *
 * Measured with `emppScript([alpSend, alpBurn, memorial])` / without SEND:
 *   - DANA v1 (root): note ≤ 157 without SEND (150 → ~216). With leftover
 *     SEND, 140 + SEND is **262** (the production error).
 *   - DANA v2 (32-byte parent txid): note ≤ 124 without SEND (120 → ~219).
 *     Leftover SEND still fits for extras ≲ 69 bytes; larger extras retry
 *     without SEND. Re-offers do **not** re-pack the root altar — only the
 *     parent txid plus optional extra remembrance text.
 *
 * Older 150 / 120 caps were treated as always-safe including leftover SEND.
 * They are not. EMPP `noteLen` is still a u8 (max 255) — 223 binds first.
 */
export const MEMORIAL_NOTE_MAX_BYTES = 150;
/**
 * Extra remembrance *text* on DANA v2 (re-offer / amend). The 32-byte parent
 * txid is the only root pointer. Relationship fragments (~74 bytes) fit.
 * Measured: 120-byte note + BURN + DATA = 219 (limit 223).
 */
export const MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT = 120;

/** Soft UI cap for the free-text quick-offer note (characters). Prefer bytes. */
export const MEMORIAL_NOTE_MAX_CHARS = 100;

/** On-chain honorific codes (render via locale in the UI / OG). */
export type AltarHonorific = '' | 'mr' | 'mrs';

/**
 * Link type to another altar: empty (none), or the **related** person's role
 * toward this memorial — `parent` (Cha/mẹ), `child` (Con), `spouse` (Vợ/Chồng).
 */
export type AltarRelationshipType = '' | 'spouse' | 'parent' | 'child';

/** Non-empty relationship kinds used in link lists. */
export type AltarRelationshipKind = Exclude<AltarRelationshipType, ''>;

/** Person memorial (empty) or a dated event (`event`). */
export type AltarKind = '' | 'event';

/** Preferred display/input calendar for the death / event date slot. */
export type AltarDateCalendar = '' | 'lunar' | 'solar';

export type AltarLocale = 'vi' | 'en' | 'zh';

/** One on-chain relationship link (spouse / parent / child → related altar). */
export interface AltarRelationshipLink {
  type: AltarRelationshipKind;
  relatedTxid: string;
}

/** Soft cap — parent (Cha/mẹ) links only. Child and spouse are unlimited for now. */
export const MAX_PARENT_RELATIONSHIPS = 2;

export interface AltarFields {
  /** Mr. / Mrs. — stored as `mr` | `mrs` (optional). */
  title: AltarHonorific;
  /** Dedication / person name (required when altar is used). */
  name: string;
  /** Free remembrance words (optional). */
  note: string;
  birthPlace: string;
  /**
   * Birth date — optional. Same shapes as deathDate: `YYYY`, `YYYY-MM`, or
   * `YYYY-MM-DD`. Wire field slot kept as “birthYear” historically.
   */
  birthYear: string;
  /**
   * Date of death, or **event date** when {@link kind} is `event`.
   * Optional for a living person (Setup only; no flower re-offer until a
   * death-date star fragment is added). Required for events.
   * Same shapes as birthYear: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.
   * On the wire this is the **solar** civil day; {@link dateCalendar} says
   * whether the UI should show lunar or solar.
   */
  deathDate: string;
  deathPlace: string;
  funeralPlace: string;
  /**
   * Empty = person / living profile. `event` = the date slot is an event
   * day (not a death date) and person-only fields stay empty.
   */
  kind: AltarKind;
  /**
   * How the date slot should display: `lunar` | `solar`. Empty = legacy
   * (clients default the details toggle).
   */
  dateCalendar: AltarDateCalendar;
  /**
   * Draft / single-note wire slots (one link per packed note). Prefer
   * {@link relationships} after merging star burns for display.
   */
  relationshipType: AltarRelationshipType;
  relatedTxid: string;
  /**
   * All relationship links for this altar (root + add-only star fragments).
   * Deletion is not supported yet — future burns may mark links deleted.
   */
  relationships: AltarRelationshipLink[];
}

export function emptyAltarFields(): AltarFields {
  return {
    title: '',
    name: '',
    note: '',
    birthPlace: '',
    birthYear: '',
    deathDate: '',
    deathPlace: '',
    funeralPlace: '',
    relationshipType: '',
    relatedTxid: '',
    relationships: [],
    kind: '',
    dateCalendar: '',
  };
}

/** Build 0–1 links from the singular wire slots. */
export function linksFromSingularFields(
  relationshipType: string | null | undefined,
  relatedTxid: string | null | undefined,
): AltarRelationshipLink[] {
  const type = normalizeAltarRelationshipType(relationshipType);
  const txid = normalizeAltarRelatedTxid(relatedTxid);
  if (!type || !txid) return [];
  return [{ type, relatedTxid: txid }];
}

/** Prefer `relationships`; merge draft singular slots when present (setup / amend). */
export function altarRelationships(fields: AltarFields): AltarRelationshipLink[] {
  const fromList = fields.relationships ?? [];
  const fromSingular = linksFromSingularFields(
    fields.relationshipType,
    fields.relatedTxid,
  );
  if (fromList.length === 0) return fromSingular;
  if (fromSingular.length === 0) return fromList;
  const out = [...fromList];
  for (const link of fromSingular) {
    if (
      !out.some(
        r => r.type === link.type && r.relatedTxid === link.relatedTxid,
      )
    ) {
      out.push(link);
    }
  }
  return out;
}

export function relationshipLinkKey(link: AltarRelationshipLink): string {
  return `${link.type}:${link.relatedTxid}`;
}

/**
 * Add-only rules: no duplicates; parent ≤ {@link MAX_PARENT_RELATIONSHIPS};
 * child and spouse unlimited. Deletion not supported yet.
 */
export function canAddRelationship(
  existing: AltarRelationshipLink[],
  next: AltarRelationshipLink,
): 'duplicate' | 'parentMax' | null {
  if (
    existing.some(
      r => r.type === next.type && r.relatedTxid === next.relatedTxid,
    )
  ) {
    return 'duplicate';
  }
  if (next.type === 'parent') {
    const n = existing.filter(r => r.type === 'parent').length;
    if (n >= MAX_PARENT_RELATIONSHIPS) return 'parentMax';
  }
  return null;
}

function scrub(raw: string): string {
  return raw.replaceAll(ALTAR_SEP, ' ').replace(/\s+/g, ' ').trim();
}

export function utf8ByteLength(raw: string): number {
  return new TextEncoder().encode(raw).length;
}

/**
 * Packed-note cap on the wire: 150 (v1) or 100 (v2 parent).
 * Extra v2 *text* in the UI uses the v2 cap. Caps are UTF-8 bytes.
 */
export function memorialNoteMaxBytes(hasParentBurnTxid?: boolean): number {
  return hasParentBurnTxid
    ? MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT
    : MEMORIAL_NOTE_MAX_BYTES;
}

export function normalizeAltarHonorific(
  raw: string | null | undefined,
): AltarHonorific {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'mr' || t === 'mrs') return t;
  return '';
}

export function normalizeAltarRelationshipType(
  raw: string | null | undefined,
): AltarRelationshipType {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'spouse' || t === 's') return 'spouse';
  if (t === 'parent' || t === 'p') return 'parent';
  if (t === 'child' || t === 'c') return 'child';
  return '';
}

/** Compact on-wire relationship code (saves OP_RETURN bytes vs long words). */
function wireRelationshipType(t: AltarRelationshipType): string {
  if (t === 'spouse') return 's';
  if (t === 'parent') return 'p';
  if (t === 'child') return 'c';
  return '';
}

export function normalizeAltarKind(
  raw: string | null | undefined,
): AltarKind {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'event' || t === 'e') return 'event';
  return '';
}

export function normalizeAltarDateCalendar(
  raw: string | null | undefined,
): AltarDateCalendar {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'lunar' || t === 'l') return 'lunar';
  if (t === 'solar' || t === 's') return 'solar';
  return '';
}

export function altarIsEvent(
  a: Pick<AltarFields, 'kind'> | null | undefined,
): boolean {
  return normalizeAltarKind(a?.kind) === 'event';
}

function wireAltarKind(k: AltarKind): string {
  return k === 'event' ? 'e' : '';
}

function wireAltarDateCalendar(c: AltarDateCalendar): string {
  if (c === 'lunar') return 'l';
  if (c === 'solar') return 's';
  return '';
}

/** Lowercase 64-hex burn txid, or '' if not a valid shape. */
export function normalizeAltarRelatedTxid(
  raw: string | null | undefined,
): string {
  const t = (raw || '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(t) ? t : '';
}

/** Localized honorific label; empty if none. */
export function altarHonorificLabel(
  title: string | null | undefined,
  locale: AltarLocale = 'vi',
): string {
  const h = normalizeAltarHonorific(title);
  if (!h) return '';
  switch (locale) {
    case 'en':
      return h === 'mrs' ? 'Mrs.' : 'Mr.';
    case 'zh':
      return h === 'mrs' ? '女士' : '先生';
    default:
      return h === 'mrs' ? 'Bà' : 'Ông';
  }
}

/**
 * Spouse label for the related person, from **this** altar's honorific:
 * Ông/Mr → Vợ/Wife; Bà/Mrs → Chồng/Husband; unknown → Vợ/Chồng / Spouse.
 */
export function altarSpouseRelationshipLabel(
  title: string | null | undefined,
  locale: AltarLocale = 'vi',
): string {
  const h = normalizeAltarHonorific(title);
  switch (locale) {
    case 'en':
      if (h === 'mr') return 'Wife';
      if (h === 'mrs') return 'Husband';
      return 'Spouse';
    case 'zh':
      if (h === 'mr') return '妻';
      if (h === 'mrs') return '夫';
      return '配偶';
    default:
      if (h === 'mr') return 'Vợ';
      if (h === 'mrs') return 'Chồng';
      return 'Vợ/Chồng';
  }
}

/**
 * Parent label from the **related** altar's honorific:
 * Ông/Mr → Cha/Father; Bà/Mrs → Mẹ/Mother; unknown → Cha/Mẹ / Parent.
 */
export function altarParentRelationshipLabel(
  relatedTitle: string | null | undefined,
  locale: AltarLocale = 'vi',
): string {
  const h = normalizeAltarHonorific(relatedTitle);
  switch (locale) {
    case 'en':
      if (h === 'mr') return 'Father';
      if (h === 'mrs') return 'Mother';
      return 'Parent';
    case 'zh':
      if (h === 'mr') return '父';
      if (h === 'mrs') return '母';
      return '父母';
    default:
      if (h === 'mr') return 'Cha';
      if (h === 'mrs') return 'Mẹ';
      return 'Cha/Mẹ';
  }
}

/** YYYY prefix of a birth date/year field for child sort order. */
export function birthYearSortKey(raw: string | null | undefined): number | null {
  const t = (raw || '').trim();
  if (!/^\d{4}/.test(t)) return null;
  const y = Number(t.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/**
 * Display order on Ban thờ / profile: Cha → Mẹ → (Cha/Mẹ unknown) →
 * Vợ/Chồng → Con (by birth year when known).
 */
export function sortAltarRelationships(
  links: readonly AltarRelationshipLink[],
  relatedMeta?: ReadonlyMap<
    string,
    { title?: string | null; birthYear?: string | null }
  >,
): AltarRelationshipLink[] {
  const meta = (txid: string) => relatedMeta?.get(txid);
  const rank = (link: AltarRelationshipLink): number => {
    if (link.type === 'parent') {
      const h = normalizeAltarHonorific(meta(link.relatedTxid)?.title);
      if (h === 'mr') return 0;
      if (h === 'mrs') return 1;
      return 2;
    }
    if (link.type === 'spouse') return 3;
    if (link.type === 'child') return 4;
    return 5;
  };
  return [...links].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.type === 'child' && b.type === 'child') {
      const ya = birthYearSortKey(meta(a.relatedTxid)?.birthYear);
      const yb = birthYearSortKey(meta(b.relatedTxid)?.birthYear);
      if (ya != null && yb != null && ya !== yb) return ya - yb;
      if (ya != null && yb == null) return -1;
      if (ya == null && yb != null) return 1;
    }
    return a.relatedTxid.localeCompare(b.relatedTxid);
  });
}

/**
 * Person line for Recent / share / OG: `Ông Cao Lâm Quả` / `Mr. Name`.
 */
export function formatAltarPersonName(
  fields: Pick<AltarFields, 'title' | 'name' | 'note'>,
  locale: AltarLocale = 'vi',
): string {
  const name = scrub(fields.name) || scrub(fields.note);
  if (!name) return '';
  const prefix = altarHonorificLabel(fields.title, locale);
  return prefix ? `${prefix} ${name}` : name;
}

/** True when the on-chain note uses altar separator packing. */
export function isAltarPackedNote(raw: string): boolean {
  return raw.includes(ALTAR_SEP);
}

/**
 * New wire starts with honorific (`mr`/`mrs`) or an empty title slot (`\x1f…`).
 * Legacy test burns kept name in slot 0 — still readable.
 * Relationship-only fragments start with an empty title slot.
 */
function isTitleFirstWire(parts: string[]): boolean {
  const raw0 = parts[0] ?? '';
  const first = raw0.trim().toLowerCase();
  if (first === 'mr' || first === 'mrs') return true;
  return raw0 === '' && parts.length >= 2;
}

export function parseAltarNote(raw: string): AltarFields | null {
  if (!isAltarPackedNote(raw)) return null;
  const parts = raw.split(ALTAR_SEP);
  let fields: AltarFields;
  if (isTitleFirstWire(parts)) {
    fields = {
      title: normalizeAltarHonorific(parts[0]),
      name: (parts[1] ?? '').trim(),
      note: (parts[2] ?? '').trim(),
      birthPlace: (parts[3] ?? '').trim(),
      birthYear: (parts[4] ?? '').trim(),
      deathDate: (parts[5] ?? '').trim(),
      deathPlace: (parts[6] ?? '').trim(),
      funeralPlace: (parts[7] ?? '').trim(),
      relationshipType: normalizeAltarRelationshipType(parts[8]),
      relatedTxid: normalizeAltarRelatedTxid(parts[9]),
      kind: normalizeAltarKind(parts[10]),
      dateCalendar: normalizeAltarDateCalendar(parts[11]),
      relationships: [],
    };
  } else {
    // Legacy (pre-title): name \x1f note \x1f …
    fields = {
      title: '',
      name: (parts[0] ?? '').trim(),
      note: (parts[1] ?? '').trim(),
      birthPlace: (parts[2] ?? '').trim(),
      birthYear: (parts[3] ?? '').trim(),
      deathDate: (parts[4] ?? '').trim(),
      deathPlace: (parts[5] ?? '').trim(),
      funeralPlace: (parts[6] ?? '').trim(),
      relationshipType: normalizeAltarRelationshipType(parts[7]),
      relatedTxid: normalizeAltarRelatedTxid(parts[8]),
      kind: '',
      dateCalendar: '',
      relationships: [],
    };
  }
  fields.relationships = linksFromSingularFields(
    fields.relationshipType,
    fields.relatedTxid,
  );
  return fields;
}

/**
 * Merge altar-packed notes (latest-first for identity fields).
 * Relationships are collected add-only from every packed note (oldest first)
 * so multiple spouse/parent/child star fragments all show up.
 */
export function mergeAltarFields(
  notes: Iterable<string>,
): AltarFields | null {
  const list = [...notes];
  let merged: AltarFields | null = null;
  for (const raw of list) {
    const parsed = parseAltarNote(raw);
    if (!parsed) continue;
    if (!merged) {
      merged = {
        ...parsed,
        relationships: [],
        relationshipType: '',
        relatedTxid: '',
      };
      continue;
    }
    merged = {
      title: merged.title || parsed.title,
      name: merged.name || parsed.name,
      note: merged.note || parsed.note,
      birthPlace: merged.birthPlace || parsed.birthPlace,
      birthYear: merged.birthYear || parsed.birthYear,
      deathDate: merged.deathDate || parsed.deathDate,
      deathPlace: merged.deathPlace || parsed.deathPlace,
      funeralPlace: merged.funeralPlace || parsed.funeralPlace,
      kind: merged.kind || parsed.kind,
      dateCalendar: merged.dateCalendar || parsed.dateCalendar,
      relationshipType: '',
      relatedTxid: '',
      relationships: [],
    };
  }
  if (!merged) return null;

  const relationships: AltarRelationshipLink[] = [];
  const seen = new Set<string>();
  // Oldest first so add order is stable in the UI.
  for (const raw of [...list].reverse()) {
    const parsed = parseAltarNote(raw);
    if (!parsed) continue;
    for (const link of altarRelationships(parsed)) {
      const key = relationshipLinkKey(link);
      if (seen.has(key)) continue;
      seen.add(key);
      relationships.push(link);
    }
  }
  const first = relationships[0];
  return {
    ...merged,
    relationships,
    relationshipType: first?.type ?? '',
    relatedTxid: first?.relatedTxid ?? '',
  };
}

/**
 * Display name for Recent / share labels.
 * Packed altar → titled name (fallback note); plain note → as-is.
 * Relationship-only packs (no name) → empty (callers fall back to root).
 */
export function memorialDisplayName(
  raw: string,
  locale: AltarLocale = 'vi',
): string {
  const t = raw.trim();
  if (!t) return '';
  const altar = parseAltarNote(t);
  if (!altar) return t;
  return formatAltarPersonName(altar, locale);
}

/** Person name without honorific prefix — used for search relevance. */
export function altarBareNameFromNote(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const altar = parseAltarNote(t);
  if (altar) return scrub(altar.name) || scrub(altar.note);
  return t;
}

/**
 * Normalize free text for name search: case, diacritics, and Vietnamese
 * `đ`/`Đ` insensitive so "qua" matches "Quả", "ba" matches "Bà", etc.
 */
export function normalizeAltarSearchText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

/**
 * Relevance tier for name search — used to rank search results before
 * falling back to offering count: `3` exact match, `2` prefix, `1` contains,
 * `0` no match.
 *
 * When `bareName` is given (person name without honorific), prefix/contains
 * are also checked against it so "cao" matches "Ông Cao Lâm Quả" at prefix
 * tier, not demoted to contains because of the honorific prefix.
 */
export function altarSearchRelevance(
  name: string,
  query: string,
  bareName?: string,
): number {
  const q = normalizeAltarSearchText(query);
  if (!q) return 0;

  const score = (raw: string): number => {
    const n = normalizeAltarSearchText(raw);
    if (!n) return 0;
    if (n === q) return 3;
    if (n.startsWith(q)) return 2;
    if (n.includes(q)) return 1;
    return 0;
  };

  let best = score(name);
  const bare = bareName?.trim();
  if (bare && normalizeAltarSearchText(bare) !== normalizeAltarSearchText(name)) {
    best = Math.max(best, score(bare));
  }
  return best;
}

const ALTAR_DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/**
 * Auto-format altar dates while typing on a numeric keypad (no hyphen key).
 * Digits only → `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.
 */
export function formatAltarDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** @deprecated use formatAltarDateInput */
export const formatDeathDateInput = formatAltarDateInput;

/** True when death date is present and well-formed (deceased memorial). */
export function altarHasDeathDate(
  a: Pick<AltarFields, 'deathDate'> | null | undefined,
): boolean {
  if (!a) return false;
  const death = scrub(a.deathDate);
  return Boolean(death) && ALTAR_DATE_RE.test(death);
}

export function validateAltarFields(a: AltarFields): string | null {
  const titleRaw = (a.title || '').trim();
  if (titleRaw && !normalizeAltarHonorific(titleRaw)) return 'title';
  if (!scrub(a.name)) return 'name';
  const death = scrub(a.deathDate);
  const isEvent = altarIsEvent(a);
  // Events require a date (the event day). Living people may omit it.
  if (isEvent && !death) return 'deathDate';
  if (death && !ALTAR_DATE_RE.test(death)) return 'deathDate';
  const birth = scrub(a.birthYear);
  if (birth && !ALTAR_DATE_RE.test(birth)) return 'birthYear';
  const relErr = validateRelationshipFields(a);
  if (relErr) return relErr;
  return null;
}

/** Death-date amendment fragment (living → deceased). */
export function validateDeathDateFields(
  a: Pick<AltarFields, 'deathDate'>,
): string | null {
  const death = scrub(a.deathDate);
  if (!death || !ALTAR_DATE_RE.test(death)) return 'deathDate';
  return null;
}

/**
 * True when the packed note is a death-date star fragment (no name; has
 * deathDate; no relationship link) — used to gate creator-only amends.
 */
export function isDeathDateAmendNote(raw: string | null | undefined): boolean {
  const parsed = parseAltarNote(raw || '');
  if (!parsed) return false;
  if (scrub(parsed.name)) return false;
  if (!altarHasDeathDate(parsed)) return false;
  if (normalizeAltarRelationshipType(parsed.relationshipType)) return false;
  return true;
}

/**
 * True when the packed note is a relationship-only star fragment (no name;
 * has type+txid; no death date) — used to gate creator-only amends.
 */
export function isRelationshipAmendNote(
  raw: string | null | undefined,
): boolean {
  const parsed = parseAltarNote(raw || '');
  if (!parsed) return false;
  if (scrub(parsed.name)) return false;
  if (altarHasDeathDate(parsed)) return false;
  if (!normalizeAltarRelationshipType(parsed.relationshipType)) return false;
  if (!normalizeAltarRelatedTxid(parsed.relatedTxid)) return false;
  return true;
}

/**
 * Re-offer extras are **plain remembrance text** plus DANA v2 `parentBurnTxid`.
 * If a packed altar note is supplied by mistake, keep only the remembrance
 * slot so name / places / dates / links are not rewritten on the flower burn.
 */
export function reofferExtraNote(raw: string | null | undefined): string {
  const t = (raw || '').trim();
  if (!t) return '';
  const packed = parseAltarNote(t);
  if (!packed) return t;
  return scrub(packed.note);
}

/**
 * Note that goes in the DANA EMPP push. Star fragments (death / relationship)
 * stay packed; every other parent burn is a re-offer extra.
 */
export function prepareDanaNote(
  raw: string | null | undefined,
  hasParentBurnTxid: boolean,
): string {
  const t = (raw || '').trim();
  if (!hasParentBurnTxid) return t;
  if (isDeathDateAmendNote(t) || isRelationshipAmendNote(t)) return t;
  return reofferExtraNote(t);
}

/** Relationship pair only (for relationship star-fragment burns). */
export function validateRelationshipFields(
  a: Pick<AltarFields, 'relationshipType' | 'relatedTxid'>,
): string | null {
  const relTypeRaw = (a.relationshipType || '').trim();
  if (relTypeRaw && !normalizeAltarRelationshipType(relTypeRaw)) {
    return 'relationshipType';
  }
  const relTxidRaw = scrub(a.relatedTxid);
  if (relTxidRaw && !normalizeAltarRelatedTxid(relTxidRaw)) {
    return 'relatedTxid';
  }
  if (relTypeRaw && !relTxidRaw) return 'relatedTxid';
  if (relTxidRaw && !relTypeRaw) return 'relationshipType';
  return null;
}

/** Truncate to at most `maxBytes` UTF-8 bytes without splitting a code point. */
export function truncateUtf8Bytes(raw: string, maxBytes: number): string {
  const enc = new TextEncoder();
  if (enc.encode(raw).length <= maxBytes) return raw;
  let out = '';
  for (const ch of raw) {
    const next = out + ch;
    if (enc.encode(next).length > maxBytes) break;
    out = next;
  }
  return out;
}

export type EncodeAltarNoteOptions = {
  /**
   * Max UTF-8 note bytes. Defaults to {@link MEMORIAL_NOTE_MAX_BYTES}.
   * Use {@link memorialNoteMaxBytes}(true) when the burn will carry a DANA v2
   * parent (re-offer / relationship under a star).
   */
  maxBytes?: number;
};

function joinAltarParts(parts: string[]): string {
  const out = [...parts];
  while (out.length > 2 && !out[out.length - 1]) out.pop();
  return out.join(ALTAR_SEP);
}

/**
 * Pack altar identity fields for the **root** dedication note.
 * Omits trailing empty fields. Throws if required fields missing.
 * Always writes the title slot first (may be empty) so readers detect new wire.
 *
 * Relationship may be included when it fits. Fit order prefers keeping the
 * relationship link on the root (living setups often fill long place text):
 * drop funeral → remembrance note → places → relationship → birth year.
 * Prefer {@link encodeRelationshipNote} as a separate star fragment when the
 * root would otherwise lose places or the link still cannot fit.
 */
export function encodeAltarNote(
  fields: AltarFields,
  opts?: EncodeAltarNoteOptions,
): string {
  const err = validateAltarFields(fields);
  if (err) throw new Error(`invalid altar field: ${err}`);

  const maxBytes = opts?.maxBytes ?? MEMORIAL_NOTE_MAX_BYTES;
  const title = normalizeAltarHonorific(fields.title);
  const name = scrub(fields.name);
  const deathDate = scrub(fields.deathDate);
  let relType = normalizeAltarRelationshipType(fields.relationshipType);
  let relTxid = normalizeAltarRelatedTxid(fields.relatedTxid);
  let note = scrub(fields.note);
  let birthPlace = scrub(fields.birthPlace);
  let birthYear = scrub(fields.birthYear);
  let deathPlace = scrub(fields.deathPlace);
  let funeralPlace = scrub(fields.funeralPlace);
  const kind = wireAltarKind(normalizeAltarKind(fields.kind));
  const dateCalendar = wireAltarDateCalendar(
    normalizeAltarDateCalendar(fields.dateCalendar),
  );

  const pack = (): string =>
    joinAltarParts([
      title,
      name,
      note,
      birthPlace,
      birthYear,
      deathDate,
      deathPlace,
      funeralPlace,
      wireRelationshipType(relType),
      relTxid,
      kind,
      dateCalendar,
    ]);

  const originalNote = note;
  const dropOrder: Array<() => void> = [
    () => {
      funeralPlace = '';
    },
    () => {
      note = '';
      const overhead = utf8ByteLength(pack());
      note = truncateUtf8Bytes(originalNote, Math.max(0, maxBytes - overhead));
    },
    () => {
      deathPlace = '';
    },
    () => {
      birthPlace = '';
    },
    () => {
      relType = '';
      relTxid = '';
    },
    () => {
      birthYear = '';
    },
  ];

  let packed = pack();
  for (const drop of dropOrder) {
    if (utf8ByteLength(packed) <= maxBytes) break;
    drop();
    packed = pack();
  }

  if (utf8ByteLength(packed) > maxBytes) {
    throw new Error(
      `altar note exceeds OP_RETURN budget (${utf8ByteLength(packed)} > ${maxBytes} bytes)`,
    );
  }
  return packed;
}

/**
 * Pack a **relationship-only** star fragment (DANA v2 parent = root).
 * Does not re-state name / places / dates — those stay on the root burn.
 * Optional `note` is a short memorial message; it is truncated/dropped first
 * so the relationship link always fits under the parent OP_RETURN budget.
 */
export function encodeRelationshipNote(
  fields: Pick<AltarFields, 'relationshipType' | 'relatedTxid'> & {
    note?: string;
  },
  opts?: EncodeAltarNoteOptions,
): string {
  const relType = normalizeAltarRelationshipType(fields.relationshipType);
  const relTxid = normalizeAltarRelatedTxid(fields.relatedTxid);
  if (!relType || !relTxid) {
    throw new Error(
      `invalid altar field: ${!relType ? 'relationshipType' : 'relatedTxid'}`,
    );
  }

  const maxBytes = Math.max(
    opts?.maxBytes ?? MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT,
    // type + 64-hex txid + separators is ~74 bytes; leftover SEND is retried
    // without DATA overflow in burnOnePrayer.
    80,
  );
  let note = scrub(fields.note || '');

  const pack = (): string =>
    joinAltarParts([
      '',
      '',
      note,
      '',
      '',
      '',
      '',
      '',
      wireRelationshipType(relType),
      relTxid,
    ]);

  let packed = pack();
  if (utf8ByteLength(packed) > maxBytes && note) {
    const overhead = utf8ByteLength(
      joinAltarParts([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        wireRelationshipType(relType),
        relTxid,
      ]),
    );
    const noteBudget = Math.max(0, maxBytes - overhead);
    note = truncateUtf8Bytes(note, noteBudget);
    packed = pack();
  }
  if (utf8ByteLength(packed) > maxBytes) {
    note = '';
    packed = pack();
  }
  if (utf8ByteLength(packed) > maxBytes) {
    throw new Error(
      `relationship note exceeds OP_RETURN budget (${utf8ByteLength(packed)} > ${maxBytes} bytes)`,
    );
  }
  return packed;
}

/**
 * Pack a **death-date** star fragment under a living profile root
 * (DANA v2 parent = root). Fills deathDate (+ optional death/funeral place);
 * does not re-state name / birth / relationships.
 */
export function encodeDeathDateNote(
  fields: Pick<AltarFields, 'deathDate' | 'deathPlace' | 'funeralPlace'> &
    Partial<Pick<AltarFields, 'dateCalendar'>>,
  opts?: EncodeAltarNoteOptions,
): string {
  const err = validateDeathDateFields(fields);
  if (err) throw new Error(`invalid altar field: ${err}`);

  const maxBytes = opts?.maxBytes ?? MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT;
  const deathDate = scrub(fields.deathDate);
  let deathPlace = scrub(fields.deathPlace);
  let funeralPlace = scrub(fields.funeralPlace);
  const dateCalendar = wireAltarDateCalendar(
    normalizeAltarDateCalendar(fields.dateCalendar),
  );

  const pack = (): string =>
    joinAltarParts([
      '',
      '',
      '',
      '',
      '',
      deathDate,
      deathPlace,
      funeralPlace,
      '',
      '',
      '',
      dateCalendar,
    ]);

  let packed = pack();
  if (utf8ByteLength(packed) > maxBytes && funeralPlace) {
    funeralPlace = '';
    packed = pack();
  }
  if (utf8ByteLength(packed) > maxBytes && deathPlace) {
    deathPlace = '';
    packed = pack();
  }
  if (utf8ByteLength(packed) > maxBytes) {
    throw new Error(
      `death-date note exceeds OP_RETURN budget (${utf8ByteLength(packed)} > ${maxBytes} bytes)`,
    );
  }
  return packed;
}
