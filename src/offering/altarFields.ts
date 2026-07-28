/**
 * WLotus altar memorial note packing (on-chain, separator fields — not JSON).
 * See docs/ALTAR.md.
 *
 * Wire (UTF-8), Unit Separator U+001F between fields:
 *   title \x1f name \x1f note \x1f birthPlace \x1f birthYear \x1f deathDate
 *     \x1f deathPlace \x1f funeralPlace \x1f relationshipType \x1f relatedTxid
 *
 * `title` is a locale-neutral honorific code: `` | `mr` | `mrs`
 * (UI: Mr./Mrs. · Ông/Bà · 先生/女士).
 *
 * Places are coarse free text for now. Geotag later via OpenStreetMap Nominatim
 * → compact geohash in the same place slots (no AI geocoding).
 *
 * `relationshipType` / `relatedTxid` link this altar to another WLotus altar
 * (its original dedication burn txid): `spouse` | `parent` | `child`, where
 * `parent`/`child` describe THIS altar's role relative to the linked one.
 * Writing / amending this pair is intentionally left OPEN (any device, at
 * setup or later via a star-fragment burn under the same root) — see
 * docs/ALTAR.md § "Relationships — open for now, restrict later" for the
 * planned minter-only restriction and why a device `installId` cannot be a
 * durable creator credential.
 */

export const ALTAR_SEP = '\u001f';

/** Soft UI / mint cap — EMPP noteLen is u8 (max 255 UTF-8 bytes). */
export const MEMORIAL_NOTE_MAX_CHARS = 200;
export const MEMORIAL_NOTE_MAX_BYTES = 220;

/** On-chain honorific codes (render via locale in the UI / OG). */
export type AltarHonorific = '' | 'mr' | 'mrs';

/**
 * Link type to another altar: empty (none), `spouse` (symmetric), or
 * `parent` / `child` — THIS altar's role relative to `relatedTxid`.
 */
export type AltarRelationshipType = '' | 'spouse' | 'parent' | 'child';

export type AltarLocale = 'vi' | 'en' | 'zh';

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
  /** Required when altar is used — YYYY or YYYY-MM-DD. */
  deathDate: string;
  deathPlace: string;
  funeralPlace: string;
  /** Optional link to another altar (see AltarRelationshipType above). */
  relationshipType: AltarRelationshipType;
  /** Original dedication burn txid (64 hex) of the linked altar, or ''. */
  relatedTxid: string;
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
  };
}

function scrub(raw: string): string {
  return raw.replaceAll(ALTAR_SEP, ' ').replace(/\s+/g, ' ').trim();
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
  if (t === 'spouse' || t === 'parent' || t === 'child') return t;
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
  if (isTitleFirstWire(parts)) {
    return {
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
    };
  }
  // Legacy (pre-title): name \x1f note \x1f …
  return {
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
  };
}

/**
 * Display name for Recent / share labels.
 * Packed altar → titled name (fallback note); plain note → as-is.
 */
export function memorialDisplayName(
  raw: string,
  locale: AltarLocale = 'vi',
): string {
  const t = raw.trim();
  if (!t) return '';
  const altar = parseAltarNote(t);
  if (!altar) return t;
  return formatAltarPersonName(altar, locale) || t;
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

export function validateAltarFields(a: AltarFields): string | null {
  const titleRaw = (a.title || '').trim();
  if (titleRaw && !normalizeAltarHonorific(titleRaw)) return 'title';
  if (!scrub(a.name)) return 'name';
  const death = scrub(a.deathDate);
  if (!death || !ALTAR_DATE_RE.test(death)) return 'deathDate';
  const birth = scrub(a.birthYear);
  if (birth && !ALTAR_DATE_RE.test(birth)) return 'birthYear';
  const relTypeRaw = (a.relationshipType || '').trim();
  if (relTypeRaw && !normalizeAltarRelationshipType(relTypeRaw)) {
    return 'relationshipType';
  }
  const relTxidRaw = scrub(a.relatedTxid);
  if (relTxidRaw && !normalizeAltarRelatedTxid(relTxidRaw)) {
    return 'relatedTxid';
  }
  // A relationship needs both a type and a linked altar — one without the
  // other is an incomplete / stale entry.
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

/**
 * Pack altar fields for the DANA memorial note.
 * Omits trailing empty fields. Throws if required fields missing.
 * Always writes the title slot first (may be empty) so readers detect new wire.
 */
export function encodeAltarNote(fields: AltarFields): string {
  const err = validateAltarFields(fields);
  if (err) throw new Error(`invalid altar field: ${err}`);

  const parts = [
    normalizeAltarHonorific(fields.title),
    scrub(fields.name),
    scrub(fields.note),
    scrub(fields.birthPlace),
    scrub(fields.birthYear),
    scrub(fields.deathDate),
    scrub(fields.deathPlace),
    scrub(fields.funeralPlace),
    normalizeAltarRelationshipType(fields.relationshipType),
    normalizeAltarRelatedTxid(fields.relatedTxid),
  ];
  while (parts.length > 2 && !parts[parts.length - 1]) parts.pop();
  const packed = parts.join(ALTAR_SEP);
  return truncateUtf8Bytes(packed, MEMORIAL_NOTE_MAX_BYTES);
}
