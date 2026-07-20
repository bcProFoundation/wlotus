import {
  REMINT_FUEL_MAX_SATS,
  REMINT_FUEL_SATS,
  isOversizedFuelSats,
  isSizedFuelSats,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
  pureXecBalance,
  tipFeeAccountNumber,
} from '../src/mint/fuelUtxo.js';

function u(txid: string, outIdx: number, sats: bigint, token?: unknown) {
  return { outpoint: { txid, outIdx }, sats, token };
}

describe('fuelUtxo sizing', () => {
  it('accepts only small fuel sats', () => {
    expect(isSizedFuelSats(REMINT_FUEL_SATS)).toBe(true);
    expect(isSizedFuelSats(REMINT_FUEL_MAX_SATS)).toBe(true);
    expect(isSizedFuelSats(REMINT_FUEL_SATS - 1n)).toBe(false);
    expect(isSizedFuelSats(REMINT_FUEL_MAX_SATS + 1n)).toBe(false);
    expect(isOversizedFuelSats(1_000_000n)).toBe(true);
  });

  it('never picks an oversized coin as remint fuel', () => {
    const coins = [
      u('big', 0, 1_000_000n),
      u('ok', 0, REMINT_FUEL_SATS),
      u('tok', 0, REMINT_FUEL_SATS, { tokenId: 'x' }),
    ];
    const pick = pickSizedFuelUtxo(coins);
    expect(pick?.outpoint.txid).toBe('ok');
  });

  it('respects blocked outpoints (other tips)', () => {
    const coins = [
      u('a', 0, REMINT_FUEL_SATS),
      u('b', 0, REMINT_FUEL_SATS + 100n),
    ];
    const pick = pickSizedFuelUtxo(coins, new Set(['a:0']));
    expect(pick?.outpoint.txid).toBe('b');
  });

  it('picks largest eligible split source', () => {
    const coins = [
      u('small', 0, REMINT_FUEL_SATS),
      u('mid', 0, 20_000n),
      u('big', 0, 100_000n),
    ];
    expect(pickSplitSourceUtxo(coins)?.outpoint.txid).toBe('big');
  });

  it('sums pure XEC only', () => {
    expect(
      pureXecBalance([
        u('a', 0, 1000n),
        u('b', 0, 546n, { t: 1 }),
        u('c', 0, 4000n),
      ]),
    ).toBe(5000n);
  });

  it('maps tip index to BIP44 account tipIndex+1', () => {
    expect(tipFeeAccountNumber(0)).toBe(1);
    expect(tipFeeAccountNumber(1)).toBe(2);
    expect(() => tipFeeAccountNumber(-1)).toThrow(/non-negative/);
  });
});
