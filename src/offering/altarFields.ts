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
 * On the wire, relationship type is packed as a one-letter code (`s`/`p`/`c`)
 * to save OP_RETURN budget; readers still accept the long forms.
 *
 * Writing / amending this pair is intentionally left OPEN (any device, at
 * setup or later via a star-fragment burn under the same root) — see
 * docs/ALTAR.md § "Relationships — open for now, restrict later" for the
 * planned minter-only restriction and why a device `installId` cannot be a
 * durable creator credential.
 */

export const ALTAR_SEP = '\u001f';

/**
 * eCash standard relay policy: max OP_RETURN *script* size (bytes).
 * ALP BURN + DANA memorial EMPP must fit under this.
 */
export const OP_RETURN_SCRIPT_MAX_BYTES = 223;

/**
 * Max UTF-8 bytes for the DANA memorial *note* so the full burn OP_RETURN
 * (ALP BURN + DANA EMPP, offeringId `wlotus`) stays ≤ 223.
 *
 * Empirically measured with ecash-lib `emppScript([alpBurn, memorial])`:
 *   - DANA v1 (root, no parent): note ≤ 157
 *   - DANA v2 (amend / re-offer with 32-byte parent): note ≤ 124
 *
 * Soft caps leave a small margin under those ceilings.
 * EMPP `noteLen` is still a u8 (max 255) — the OP_RETURN limit binds first.
 */
export const MEMORIAL_NOTE_MAX_BYTES = 150;
/** Stricter note budget when DANA v2 embeds a parent burn txid. */
export const MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT = 120;

/** Soft UI cap for the free-text quick-offer note (characters). */
export const MEMORIAL_NOTE_MAX_CHARS = 200;

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

function utf8ByteLength(raw: string): number {
  return new TextEncoder().encode(raw).length;
}

export function memorialNoteMaxBytes(hasParentBurnTxid: boolean): number {
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
 * Merge altar-packed notes (latest-first). For each field, keep the first
 * non-empty value so a size-trimmed relationship amend can omit places and
 * still display birth/death place from the original root burn.
 */
export function mergeAltarFields(
  notes: Iterable<string>,
): AltarFields | null {
  let merged: AltarFields | null = null;
  for (const raw of notes) {
    const parsed = parseAltarNote(raw);
    if (!parsed) continue;
    if (!merged) {
      merged = { ...parsed };
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
      relationshipType: merged.relationshipType || parsed.relationshipType,
      relatedTxid: merged.relatedTxid || parsed.relatedTxid,
    };
  }
  return merged;
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

export type EncodeAltarNoteOptions = {
  /**
   * Max UTF-8 note bytes. Defaults to {@link MEMORIAL_NOTE_MAX_BYTES}.
   * Use {@link memorialNoteMaxBytes}(true) when the burn will carry a DANA v2
   * parent (amend / re-offer under a star).
   */
  maxBytes?: number;
};

function joinAltarParts(parts: string[]): string {
  const out = [...parts];
  while (out.length > 2 && !out[out.length - 1]) out.pop();
  return out.join(ALTAR_SEP);
}

/**
 * Pack altar fields for the DANA memorial note.
 * Omits trailing empty fields. Throws if required fields missing.
 * Always writes the title slot first (may be empty) so readers detect new wire.
 *
 * Fits within `maxBytes` by dropping optional fields (funeral → note → death
 * place → birth place → birth year) before touching name / deathDate /
 * relationship. Never mid-truncates `relatedTxid` (that would corrupt the link).
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
  const relType = normalizeAltarRelationshipType(fields.relationshipType);
  const relTxid = normalizeAltarRelatedTxid(fields.relatedTxid);
  const relWire = wireRelationshipType(relType);

  let note = scrub(fields.note);
  let birthPlace = scrub(fields.birthPlace);
  let birthYear = scrub(fields.birthYear);
  let deathPlace = scrub(fields.deathPlace);
  let funeralPlace = scrub(fields.funeralPlace);

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
      relWire,
      relTxid,
    ]);

  // Drop whole optional fields first so a later merge can restore them from
  // an earlier (richer) burn under the same star — mid-truncation would
  // block that fallback.
  const dropOrder: Array<() => void> = [
    () => {
      funeralPlace = '';
    },
    () => {
      note = '';
    },
    () => {
      deathPlace = '';
    },
    () => {
      birthPlace = '';
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
