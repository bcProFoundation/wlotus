import {
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
      'co-hon': ROOT2,
    });
  });
});
