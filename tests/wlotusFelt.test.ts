import { resolveFeltSecondsPerExtraBit } from '../src/covenant/mooreTip.js';
import {
  WLOTUS_FELT_DAYS_PER_EXTRA_BIT,
  MOORE_DAY_SECONDS,
} from '../src/params/consensus.js';
import {
  WLOTUS_FELT_COVENANT,
  WLOTUS_FELT_DESK_KEEP_AFTER_BURN,
  WLOTUS_FELT_MINER_ATOMS,
  WLOTUS_FELT_MODE,
  WLOTUS_FELT_TEMPLE_ATOMS,
  WLOTUS_MINT_ATOMS,
  isWlotusDeskCovenant,
  isWlotusFeltCovenant,
  isWlotusTempleCovenant,
} from '../src/params/wlotusMint.js';

describe('WLotus felt no-tax recut', () => {
  it('constants: 108 to miner, 0 temple, desk keeps 107 after burn-1', () => {
    expect(WLOTUS_FELT_MINER_ATOMS).toBe(108n);
    expect(WLOTUS_FELT_TEMPLE_ATOMS).toBe(0n);
    expect(WLOTUS_FELT_MINER_ATOMS).toBe(WLOTUS_MINT_ATOMS);
    expect(WLOTUS_FELT_DESK_KEEP_AFTER_BURN).toBe(107n);
  });

  it('defaults to 730 days (2× / ~2 years), not whole-byte 500', () => {
    expect(WLOTUS_FELT_DAYS_PER_EXTRA_BIT).toBe(730);
    expect(resolveFeltSecondsPerExtraBit()).toBe(730 * MOORE_DAY_SECONDS);
    expect(resolveFeltSecondsPerExtraBit('500')).toBe(500 * MOORE_DAY_SECONDS);
  });

  it('classifies covenants without treating felt as temple', () => {
    const felt = {
      covenant: WLOTUS_FELT_COVENANT,
      mode: WLOTUS_FELT_MODE,
      tier: 'wlotus',
    };
    const temple = {
      covenant: 'WlotusPowRemintMooreTipTemple',
      mode: 'moore-tip-temple-hard-bind',
      tier: 'wlotus',
    };
    expect(isWlotusFeltCovenant(felt)).toBe(true);
    expect(isWlotusTempleCovenant(felt)).toBe(false);
    expect(isWlotusDeskCovenant(felt)).toBe(true);
    expect(isWlotusTempleCovenant(temple)).toBe(true);
    expect(isWlotusFeltCovenant(temple)).toBe(false);
  });
});
