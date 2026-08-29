import {
  BURN_POSTAGE_MAX_SATS,
  BURN_POSTAGE_MIN_SATS,
  BURN_POSTAGE_SATS,
  OFFERING_PAIR_SATS,
  REMINT_FUEL_MAX_SATS,
  REMINT_FUEL_SATS,
  isBurnPostageSats,
  isOversizedFuelSats,
  isSizedFuelSats,
  pickBurnPostageUtxo,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
  pureXecBalance,
  tipFeeAccountNumber,
} from '../src/mint/fuelUtxo.js';

function u(txid: string, outIdx: number, sats: bigint, token?: unknown) {
  return { outpoint: { txid, outIdx }, sats, token };
}

describe('fuelUtxo sizing', () => {
  it('accepts only small remint fuel sats', () => {
    expect(isSizedFuelSats(REMINT_FUEL_SATS)).toBe(true);
    expect(isSizedFuelSats(REMINT_FUEL_MAX_SATS)).toBe(true);
    expect(isSizedFuelSats(REMINT_FUEL_SATS - 1n)).toBe(false);
    expect(isSizedFuelSats(REMINT_FUEL_MAX_SATS + 1n)).toBe(false);
    expect(isOversizedFuelSats(1_000_000n)).toBe(true);
  });

  it('keeps burn postage below remint fuel so pickers do not overlap', () => {
    expect(BURN_POSTAGE_SATS).toBe(2_500n);
    expect(isBurnPostageSats(BURN_POSTAGE_SATS)).toBe(true);
    expect(isBurnPostageSats(BURN_POSTAGE_MIN_SATS)).toBe(true);
    expect(isBurnPostageSats(BURN_POSTAGE_MAX_SATS)).toBe(true);
    expect(isSizedFuelSats(BURN_POSTAGE_SATS)).toBe(false);
    expect(isBurnPostageSats(REMINT_FUEL_SATS)).toBe(false);
    expect(BURN_POSTAGE_MAX_SATS).toBeLessThan(REMINT_FUEL_SATS);
    expect(OFFERING_PAIR_SATS).toBe(REMINT_FUEL_SATS + BURN_POSTAGE_SATS);
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

  it('never picks the oversized reserve or remint fuel as burn postage', () => {
    const coins = [
      u('big', 0, 1_000_000n),
      u('fuel', 0, REMINT_FUEL_SATS),
      u('dust', 0, 546n),
      u('post', 0, BURN_POSTAGE_SATS),
    ];
    expect(pickBurnPostageUtxo(coins)?.outpoint.txid).toBe('post');
    expect(pickBurnPostageUtxo([u('big', 0, 1_000_000n), u('dust', 0, 546n)])).toBeNull();
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

  it('desk auto-fund sends remint fuel plus postage, not a treasury chunk', () => {
    expect(REMINT_FUEL_SATS).toBe(4_000n);
    expect(BURN_POSTAGE_SATS).toBe(2_500n);
    expect(isSizedFuelSats(OFFERING_PAIR_SATS)).toBe(false);
    expect(isOversizedFuelSats(OFFERING_PAIR_SATS)).toBe(true);
  });
});
