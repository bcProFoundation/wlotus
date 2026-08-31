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
  WLOTUS_SOFT_TEMPLE_ATOMS,
  WLOTUS_MOORE_TIP_COVENANT,
  WLOTUS_MOORE_TIP_MODE,
  isWlotusDeskCovenant,
  isWlotusFeltCovenant,
  isWlotusMooreTipCovenant,
  isWlotusTempleCovenant,
  resolveWlotusGenesisRegime,
} from '../src/params/wlotusMint.js';

describe('WLotus felt no-tax recut', () => {
  it('constants: 108 to miner, 0 temple, desk keeps 107 after burn-1', () => {
    expect(WLOTUS_FELT_MINER_ATOMS).toBe(108n);
    expect(WLOTUS_FELT_TEMPLE_ATOMS).toBe(0n);
    expect(WLOTUS_FELT_MINER_ATOMS).toBe(WLOTUS_MINT_ATOMS);
    expect(WLOTUS_FELT_DESK_KEEP_AFTER_BURN).toBe(107n);
    expect(WLOTUS_SOFT_TEMPLE_ATOMS).toBe(6n);
  });

  it('keeps the aggressive 500-day arhat clock (felt every bit, not 256× / 11 y)', () => {
    expect(WLOTUS_FELT_DAYS_PER_EXTRA_BIT).toBe(500);
    expect(resolveFeltSecondsPerExtraBit()).toBe(500 * MOORE_DAY_SECONDS);
    expect(resolveFeltSecondsPerExtraBit('730')).toBe(730 * MOORE_DAY_SECONDS);
  });

  it('defaults genesis to GLotus felt redeem; temple / whole-byte are opt-in', () => {
    expect(resolveWlotusGenesisRegime({})).toBe('felt');
    expect(resolveWlotusGenesisRegime({ FELT: '1' })).toBe('felt');
    expect(resolveWlotusGenesisRegime({ COVENANT: 'moore-tip' })).toBe(
      'moore-tip',
    );
    expect(resolveWlotusGenesisRegime({ FELT: '0' })).toBe('temple');
    expect(resolveWlotusGenesisRegime({ COVENANT: 'temple' })).toBe('temple');
  });

  it('classifies covenants without treating felt or MooreTip as temple', () => {
    const felt = {
      covenant: WLOTUS_FELT_COVENANT,
      mode: WLOTUS_FELT_MODE,
      tier: 'wlotus',
    };
    const mooreTip = {
      covenant: WLOTUS_MOORE_TIP_COVENANT,
      mode: WLOTUS_MOORE_TIP_MODE,
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
    expect(isWlotusMooreTipCovenant(mooreTip)).toBe(true);
    expect(isWlotusFeltCovenant(mooreTip)).toBe(false);
    expect(isWlotusTempleCovenant(mooreTip)).toBe(false);
    expect(isWlotusDeskCovenant(mooreTip)).toBe(true);
    expect(isWlotusTempleCovenant(temple)).toBe(true);
    expect(isWlotusFeltCovenant(temple)).toBe(false);
    expect(isWlotusMooreTipCovenant(temple)).toBe(false);
  });
});
