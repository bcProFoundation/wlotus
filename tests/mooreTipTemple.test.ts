import {
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';

describe('wLotus mint split constants', () => {
  it('is 108 = 1 miner + 107 temple (one mala)', () => {
    expect(WLOTUS_MINER_ATOMS).toBe(1n);
    expect(WLOTUS_TEMPLE_ATOMS).toBe(107n);
    expect(WLOTUS_MINT_ATOMS).toBe(108n);
  });
});
