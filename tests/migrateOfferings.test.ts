import {
  bindCatalogClaimsFromBurns,
  catalogSpecialIdFromNote,
  migrationNeedAtoms,
  orderBurnsForMigration,
  remapParentTxid,
  remapSpecialClaims,
  txidsCopiedFromDryrunToken,
} from '../src/offering/migrateOfferings.js';

const ROOT = 'a'.repeat(64);
const CHILD = 'b'.repeat(64);
const ROOT2 = 'c'.repeat(64);

describe('offering migration plan', () => {
  it('burns roots before re-offers and remaps parents', () => {
    const ordered = orderBurnsForMigration([
      {
        burnTxid: CHILD,
        note: 'reoffer',
        parentBurnTxid: ROOT,
        offeringId: 'wlotus',
        version: 2,
      },
      {
        burnTxid: ROOT,
        note: 'root',
        offeringId: 'wlotus',
        version: 1,
      },
      {
        burnTxid: ROOT2,
        note: 'other',
        offeringId: 'wlotus',
        version: 1,
      },
    ]);
    expect(ordered.map(b => b.burnTxid)).toEqual([ROOT, ROOT2, CHILD]);
    expect(migrationNeedAtoms(ordered)).toBe(3n);
    expect(migrationNeedAtoms(ordered, 107n)).toBe(324n);
  });

  it('excludes bulk copies whose source is the dryrun token', () => {
    const dry = 'a'.repeat(64);
    const prod = 'b'.repeat(64);
    const copied = 'c'.repeat(64);
    expect(
      txidsCopiedFromDryrunToken(dry, { [prod]: copied }, dry),
    ).toEqual(new Set([copied]));
    expect(
      txidsCopiedFromDryrunToken(prod, { [dry]: copied }, dry),
    ).toEqual(new Set());
  });

  it('remaps parents and special claims through the txid map', () => {
    const mapping = { [ROOT]: 'd'.repeat(64) };
    expect(remapParentTxid(CHILD, mapping)).toBe(CHILD);
    expect(remapParentTxid(ROOT, mapping)).toBe('d'.repeat(64));
    expect(remapParentTxid(undefined, mapping)).toBeUndefined();
    expect(remapSpecialClaims({ 'vu-lan': ROOT, 'co-hon': ROOT2 }, mapping)).toEqual({
      'vu-lan': 'd'.repeat(64),
    });
  });

  it('binds Nepal 26/8 / Remembrance / All Saints from packed altar names', () => {
    const nepalRoot = '2'.repeat(64);
    const nepalKid = '3'.repeat(64);
    const remembrance = '4'.repeat(64);
    const allSaints = '5'.repeat(64);
    expect(catalogSpecialIdFromNote('\u001fNepal 26/08')).toBe('nepal-26-08');
    expect(
      catalogSpecialIdFromNote('\u001fRemembrance Day\u001fRemembrance Day'),
    ).toBe('remembrance');
    expect(
      catalogSpecialIdFromNote("\u001fAll Saints' Day\u001fAll Saints' Day"),
    ).toBe('all-saints');

    const bound = bindCatalogClaimsFromBurns(
      { 'vu-lan': ROOT, 'co-hon': ROOT2 },
      [
        { burnTxid: nepalRoot, note: '\u001fNepal 26/08' },
        {
          burnTxid: nepalKid,
          note: 'Pray for Nepal',
          parentBurnTxid: nepalRoot,
        },
        {
          burnTxid: remembrance,
          note: '\u001fRemembrance Day\u001fRemembrance Day\u001f\u001f\u001f2026-11-11',
        },
        {
          burnTxid: allSaints,
          note: "\u001fAll Saints' Day\u001fAll Saints' Day\u001f\u001f\u001f2026-11-01",
        },
      ],
    );
    expect(bound['nepal-26-08']).toBe(nepalRoot);
    expect(bound.remembrance).toBe(remembrance);
    expect(bound['all-saints']).toBe(allSaints);
    expect(bound['vu-lan']).toBe(ROOT);
    expect(bound['co-hon']).toBe(ROOT2);
  });
});
