import {
  WLOTUS_DESK_KEEP_AFTER_BURN,
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';

describe('wLotus mint split constants', () => {
  it('is 108 = 102 miner + 6 temple (one mala; light issuer tax)', () => {
    expect(WLOTUS_MINER_ATOMS).toBe(102n);
    expect(WLOTUS_TEMPLE_ATOMS).toBe(6n);
    expect(WLOTUS_MINT_ATOMS).toBe(108n);
    expect(WLOTUS_DESK_KEEP_AFTER_BURN).toBe(101n);
  });
});
