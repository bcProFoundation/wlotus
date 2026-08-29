import {
  encodeAltarNote,
  emptyAltarFields,
} from '../src/offering/altarFields.js';
import type { LocalOffer } from '../apps/web/src/lib/groupOffers.js';
import {
  groupOfferedInPastYear,
  isOwnOffer,
  pruneUnownedAndExpiredOffers,
  remindAltarsFromOffers,
  rootHasRecentOwnOffer,
} from '../apps/web/src/lib/ownOffers.js';
import { groupOffersByOriginal } from '../apps/web/src/lib/groupOffers.js';

const ROOT = 'a'.repeat(64);
const REMINT = 'b'.repeat(64);
const BURN = 'c'.repeat(64);
const OTHER = 'd'.repeat(64);
const VIEW = 'e'.repeat(64);
const INDEX_BURN = 'f'.repeat(64);

const NOW = Date.parse('2026-08-29T03:00:00.000Z');
const SIX_MONTHS = '2026-02-28T00:00:00.000Z';
const TWO_YEARS = '2024-08-01T00:00:00.000Z';

function packedPerson(): string {
  return encodeAltarNote({
    ...emptyAltarFields(),
    name: 'Cao Lâm Quả',
    deathDate: '2001-10-20',
  });
}

describe('isOwnOffer', () => {
  it('treats own flag, pow fields, and distinct remint tx as device offers', () => {
    expect(isOwnOffer({ remintTxid: '', burnTxid: ROOT, note: 'x', at: SIX_MONTHS })).toBe(
      false,
    );
    expect(
      isOwnOffer({
        remintTxid: ROOT,
        burnTxid: ROOT,
        note: 'seed',
        at: SIX_MONTHS,
      }),
    ).toBe(false);
    expect(
      isOwnOffer({
        remintTxid: REMINT,
        burnTxid: BURN,
        note: '',
        at: SIX_MONTHS,
        own: true,
      }),
    ).toBe(true);
    expect(
      isOwnOffer({
        remintTxid: REMINT,
        burnTxid: BURN,
        note: '',
        at: SIX_MONTHS,
        powMs: 12_000,
      }),
    ).toBe(true);
    expect(
      isOwnOffer({
        remintTxid: REMINT,
        burnTxid: BURN,
        note: '',
        at: SIX_MONTHS,
      }),
    ).toBe(true);
  });
});

describe('pruneUnownedAndExpiredOffers', () => {
  it('drops view-only index rows and altars last offered more than a year ago', () => {
    const offers: LocalOffer[] = [
      {
        remintTxid: '',
        burnTxid: VIEW,
        note: packedPerson(),
        at: SIX_MONTHS,
      },
      {
        remintTxid: ROOT,
        burnTxid: ROOT,
        note: packedPerson(),
        at: TWO_YEARS,
      },
      {
        remintTxid: 'r-old',
        burnTxid: OTHER,
        note: packedPerson(),
        at: TWO_YEARS,
        powMs: 1000,
        parentBurnTxid: OTHER,
      },
      {
        remintTxid: REMINT,
        burnTxid: BURN,
        note: 'extra',
        at: SIX_MONTHS,
        own: true,
        parentBurnTxid: ROOT,
      },
      {
        remintTxid: '',
        burnTxid: INDEX_BURN,
        note: '',
        at: SIX_MONTHS,
        parentBurnTxid: ROOT,
      },
    ];
    const next = pruneUnownedAndExpiredOffers(offers, NOW);
    const ids = next.map(o => o.burnTxid);
    expect(ids).toEqual([ROOT, BURN, INDEX_BURN]);
    expect(rootHasRecentOwnOffer(next, ROOT, NOW)).toBe(true);
    expect(rootHasRecentOwnOffer(next, VIEW, NOW)).toBe(false);
    expect(rootHasRecentOwnOffer(offers, OTHER, NOW)).toBe(false);
  });
});

describe('remindAltarsFromOffers', () => {
  it('lists dated Recent altars and skips hidden / undated / unoffered', () => {
    const offers: LocalOffer[] = [
      {
        remintTxid: ROOT,
        burnTxid: ROOT,
        note: packedPerson(),
        at: SIX_MONTHS,
      },
      {
        remintTxid: REMINT,
        burnTxid: BURN,
        note: '',
        at: SIX_MONTHS,
        own: true,
        parentBurnTxid: ROOT,
      },
      {
        remintTxid: OTHER,
        burnTxid: OTHER,
        note: 'Living',
        at: SIX_MONTHS,
        own: true,
      },
    ];
    const groups = groupOffersByOriginal(offers);
    expect(groups.some(g => groupOfferedInPastYear(g, NOW))).toBe(true);
    const reminders = remindAltarsFromOffers(offers, 'vi', undefined, NOW);
    expect(reminders).toEqual([
      {
        txid: ROOT,
        name: 'Cao Lâm Quả',
        deathYmd: '2001-10-20',
        kind: 'person',
      },
    ]);
    const hidden = remindAltarsFromOffers(offers, 'vi', new Set([ROOT]), NOW);
    expect(hidden).toEqual([]);
  });
});
