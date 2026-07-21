/**
 * WLBR memorial EMPP payload (pure; no wallet deps).
 *
 *   v1: WLBR | ver=1 | idLen | id | noteLen | note
 *   v2: WLBR | ver=2 | idLen | id | noteLen | note | parentLen | parentTxid
 *       parentLen is 0 or 32; parentTxid is 32 raw bytes when set.
 *       Re-offers use v2 with empty note + parent = prior burn txid.
 */

export const WLBR_LOKAD = new TextEncoder().encode('WLBR');
export const WLBR_VERSION = 1;
export const WLBR_VERSION_PARENT = 2;
export const WLBR_PARENT_TXID_LEN = 32;

export const OFFERING_ID_PRAYER = 'prayer' as const;
export const OFFERING_ID_WLOTUS = 'wlotus' as const;
/** @deprecated use OFFERING_ID_PRAYER */
export const OFFERING_ID = OFFERING_ID_PRAYER;

const TXID_HEX_RE = /^[0-9a-fA-F]{64}$/;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0');
  }
  return s;
}

/** Normalize / validate a 32-byte txid hex string. */
export function parseParentBurnTxidHex(
  raw: string | undefined | null,
): string | undefined {
  if (raw == null) return undefined;
  const hex = String(raw).trim().toLowerCase();
  if (!hex) return undefined;
  if (!TXID_HEX_RE.test(hex)) {
    throw new Error('parentBurnTxid must be 64 hex characters');
  }
  return hex;
}

export interface MemorialFields {
  version: number;
  offeringId: string;
  note: string;
  /** Prior burn txid (hex), when WLBR v2 parent present. */
  parentBurnTxid?: string;
}

/** EMPP memorial push — see file header for byte layout. */
export function memorialPushdata(
  note: string,
  offeringId: string = OFFERING_ID_PRAYER,
  parentBurnTxidHex?: string,
): Uint8Array {
  const idBytes = new TextEncoder().encode(offeringId);
  const noteBytes = new TextEncoder().encode(note.slice(0, 80));
  if (idBytes.length > 255 || noteBytes.length > 255) {
    throw new Error('memorial fields too long');
  }

  const parentHex = parentBurnTxidHex
    ? parseParentBurnTxidHex(parentBurnTxidHex)
    : undefined;
  const parentBytes = parentHex ? hexToBytes(parentHex) : undefined;
  if (parentBytes && parentBytes.length !== WLBR_PARENT_TXID_LEN) {
    throw new Error('parentBurnTxid must decode to 32 bytes');
  }

  const version = parentBytes ? WLBR_VERSION_PARENT : WLBR_VERSION;
  const parentLen = parentBytes ? WLBR_PARENT_TXID_LEN : 0;
  const out = new Uint8Array(
    4 +
      1 +
      1 +
      idBytes.length +
      1 +
      noteBytes.length +
      (version >= WLBR_VERSION_PARENT ? 1 + parentLen : 0),
  );
  let o = 0;
  out.set(WLBR_LOKAD, o);
  o += 4;
  out[o++] = version;
  out[o++] = idBytes.length;
  out.set(idBytes, o);
  o += idBytes.length;
  out[o++] = noteBytes.length;
  out.set(noteBytes, o);
  o += noteBytes.length;
  if (version >= WLBR_VERSION_PARENT) {
    out[o++] = parentLen;
    if (parentBytes) {
      out.set(parentBytes, o);
    }
  }
  return out;
}

/** Decode a WLBR EMPP payload (v1 or v2). */
export function parseMemorialPushdata(data: Uint8Array): MemorialFields {
  if (data.length < 6) throw new Error('memorial too short');
  for (let i = 0; i < 4; i++) {
    if (data[i] !== WLBR_LOKAD[i]) throw new Error('not WLBR');
  }
  let o = 4;
  const version = data[o++]!;
  if (version !== WLBR_VERSION && version !== WLBR_VERSION_PARENT) {
    throw new Error(`unsupported WLBR version ${version}`);
  }
  const idLen = data[o++]!;
  if (o + idLen > data.length) throw new Error('offeringId truncated');
  const offeringId = new TextDecoder().decode(data.subarray(o, o + idLen));
  o += idLen;
  if (o >= data.length) throw new Error('noteLen missing');
  const noteLen = data[o++]!;
  if (o + noteLen > data.length) throw new Error('note truncated');
  const note = new TextDecoder().decode(data.subarray(o, o + noteLen));
  o += noteLen;

  let parentBurnTxid: string | undefined;
  if (version >= WLBR_VERSION_PARENT) {
    if (o >= data.length) throw new Error('parentLen missing');
    const parentLen = data[o++]!;
    if (parentLen !== 0 && parentLen !== WLBR_PARENT_TXID_LEN) {
      throw new Error(`invalid parentLen ${parentLen}`);
    }
    if (parentLen > 0) {
      if (o + parentLen > data.length) throw new Error('parent txid truncated');
      parentBurnTxid = bytesToHex(data.subarray(o, o + parentLen));
      o += parentLen;
    }
  }

  return { version, offeringId, note, parentBurnTxid };
}
