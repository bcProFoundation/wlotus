/**
 * WLotus altar memorial note packing (on-chain, separator fields — not JSON).
 * See docs/ALTAR.md.
 *
 * Wire (UTF-8), Unit Separator U+001F between fields:
 *   name \x1f note \x1f birthPlace \x1f birthYear \x1f deathDate \x1f deathPlace \x1f funeralPlace
 *
 * Places are coarse free text for now. Geotag later via OpenStreetMap Nominatim
 * → compact geohash in the same place slots (no AI geocoding).
 */

export const ALTAR_SEP = '\u001f';

/** Soft UI / mint cap — EMPP noteLen is u8 (max 255 UTF-8 bytes). */
export const MEMORIAL_NOTE_MAX_CHARS = 200;
export const MEMORIAL_NOTE_MAX_BYTES = 220;

export interface AltarFields {
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
}

export function emptyAltarFields(): AltarFields {
  return {
    name: '',
    note: '',
    birthPlace: '',
    birthYear: '',
    deathDate: '',
    deathPlace: '',
    funeralPlace: '',
  };
}

function scrub(raw: string): string {
  return raw.replaceAll(ALTAR_SEP, ' ').replace(/\s+/g, ' ').trim();
}

/** True when the on-chain note uses altar separator packing. */
export function isAltarPackedNote(raw: string): boolean {
  return raw.includes(ALTAR_SEP);
}

export function parseAltarNote(raw: string): AltarFields | null {
  if (!isAltarPackedNote(raw)) return null;
  const parts = raw.split(ALTAR_SEP);
  return {
    name: (parts[0] ?? '').trim(),
    note: (parts[1] ?? '').trim(),
    birthPlace: (parts[2] ?? '').trim(),
    birthYear: (parts[3] ?? '').trim(),
    deathDate: (parts[4] ?? '').trim(),
    deathPlace: (parts[5] ?? '').trim(),
    funeralPlace: (parts[6] ?? '').trim(),
  };
}

/**
 * Display name for Recent / share labels.
 * Packed altar → name (fallback note); plain note → as-is.
 */
export function memorialDisplayName(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const altar = parseAltarNote(t);
  if (!altar) return t;
  return altar.name || altar.note || t;
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
  if (!scrub(a.name)) return 'name';
  const death = scrub(a.deathDate);
  if (!death || !ALTAR_DATE_RE.test(death)) return 'deathDate';
  const birth = scrub(a.birthYear);
  if (birth && !ALTAR_DATE_RE.test(birth)) return 'birthYear';
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
 */
export function encodeAltarNote(fields: AltarFields): string {
  const err = validateAltarFields(fields);
  if (err) throw new Error(`invalid altar field: ${err}`);

  const parts = [
    scrub(fields.name),
    scrub(fields.note),
    scrub(fields.birthPlace),
    scrub(fields.birthYear),
    scrub(fields.deathDate),
    scrub(fields.deathPlace),
    scrub(fields.funeralPlace),
  ];
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
  const packed = parts.join(ALTAR_SEP);
  return truncateUtf8Bytes(packed, MEMORIAL_NOTE_MAX_BYTES);
}
