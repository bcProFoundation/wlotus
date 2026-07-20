import {
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';

describe('WLotus mint split constants', () => {
  it('is 100 = 1 miner + 99 temple', () => {
    expect(WLOTUS_MINER_ATOMS).toBe(1n);
    expect(WLOTUS_TEMPLE_ATOMS).toBe(99n);
    expect(WLOTUS_MINT_ATOMS).toBe(100n);
  });
});
