/**
 * Recent / reminder eligibility: only altars this device offered in the
 * last year. Viewing a dedication (index sync) or seeding a named root
 * does not count as an offer.
 */

import {
  altarIsEvent,
  mergeAltarFields,
  memorialDisplayName,
  parseAltarNote,
  type AltarLocale,
} from './altarFields.js';
import {
  groupOffersByOriginal,
  resolveOriginalTxid,
  type LocalOffer,
  type OfferGroup,
} from './groupOffers.js';

export const OWN_OFFER_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const TXID_RE = /^[0-9a-f]{64}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isOwnOffer(offer: LocalOffer): boolean {
  if (offer.own === true) return true;
  if (
    offer.powMs != null ||
    offer.powAttempts != null ||
    offer.hashrateHps != null ||
    offer.bits != null
  ) {
    return true;
  }
  const remint = (offer.remintTxid || '').trim().toLowerCase();
  const burn = (offer.burnTxid || '').trim().toLowerCase();
  return TXID_RE.test(remint) && remint !== burn;
}

function ownOfferAgeOk(offer: LocalOffer, nowMs: number): boolean {
  const at = Date.parse(offer.at);
  return Number.isFinite(at) && nowMs - at <= OWN_OFFER_MAX_AGE_MS;
}

/** Roots this device offered to within the last year. */
export function recentOwnOfferRoots(
  offers: LocalOffer[],
  nowMs = Date.now(),
): Set<string> {
  const keep = new Set<string>();
  for (const o of offers) {
    if (!isOwnOffer(o) || !ownOfferAgeOk(o, nowMs)) continue;
    keep.add(resolveOriginalTxid(o));
  }
  return keep;
}

export function rootHasRecentOwnOffer(
  offers: LocalOffer[],
  rootTxid: string,
  nowMs = Date.now(),
): boolean {
  const root = rootTxid.trim().toLowerCase();
  return recentOwnOfferRoots(offers, nowMs).has(root);
}

/**
 * Drop view-only / index-only rows and altars whose last device offer is
 * older than a year. Burns under a kept root (including the named seed)
 * stay so History counts can still merge.
 */
export function pruneUnownedAndExpiredOffers(
  offers: LocalOffer[],
  nowMs = Date.now(),
): LocalOffer[] {
  const keep = recentOwnOfferRoots(offers, nowMs);
  if (keep.size === 0) return [];
  return offers.filter(o => keep.has(resolveOriginalTxid(o)));
}

export function groupOfferedInPastYear(
  group: OfferGroup,
  nowMs = Date.now(),
): boolean {
  return group.burns.some(b => isOwnOffer(b) && ownOfferAgeOk(b, nowMs));
}

export interface RemindAltar {
  txid: string;
  name: string;
  deathYmd: string;
  kind: 'event' | 'person';
}

/** Dated altars still in Recent that can get a morning giỗ / event ping. */
export function remindAltarsFromOffers(
  offers: LocalOffer[],
  locale: string,
  hiddenRoots?: Set<string>,
  nowMs = Date.now(),
): RemindAltar[] {
  const out: RemindAltar[] = [];
  const seen = new Set<string>();
  for (const g of groupOffersByOriginal(offers)) {
    if (!groupOfferedInPastYear(g, nowMs)) continue;
    const txid = g.original.burnTxid.trim().toLowerCase();
    if (!TXID_RE.test(txid) || seen.has(txid)) continue;
    if (hiddenRoots?.has(txid)) continue;
    seen.add(txid);
    const notes = g.burns.map(b => (b.note || '').trim()).filter(Boolean);
    const altar = mergeAltarFields(notes) ?? parseAltarNote(g.note);
    const deathYmd = (altar?.deathDate || '').trim();
    if (!YMD_RE.test(deathYmd)) continue;
    const loc: AltarLocale = locale.startsWith('en')
      ? 'en'
      : locale.startsWith('zh')
        ? 'zh'
        : 'vi';
    const name = (
      memorialDisplayName(g.note, loc) ||
      (altar?.name || '').trim()
    ).slice(0, 80);
    if (!name) continue;
    out.push({
      txid,
      name,
      deathYmd,
      kind: altarIsEvent(altar) ? 'event' : 'person',
    });
  }
  return out.slice(0, 40);
}
