import {
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';

describe('wLotus mint split constants', () => {
  it('is 7 = 1 miner + 6 temple (reduced issuer tax)', () => {
    expect(WLOTUS_MINER_ATOMS).toBe(1n);
    expect(WLOTUS_TEMPLE_ATOMS).toBe(6n);
    expect(WLOTUS_MINT_ATOMS).toBe(7n);
  });
});
