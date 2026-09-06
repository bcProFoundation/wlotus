import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveFeltSecondsPerExtraBit } from '../src/covenant/mooreTip.js';
import {
  WLOTUS_FELT_DAYS_PER_EXTRA_BIT,
  MOORE_DAY_SECONDS,
} from '../src/params/consensus.js';
import {
  WLOTUS_FELT_COVENANT,
  WLOTUS_FELT_COVENANT_LEGACY,
  WLOTUS_FELT_DESK_KEEP_AFTER_BURN,
  WLOTUS_FELT_MINER_ATOMS,
  WLOTUS_FELT_MODE,
  WLOTUS_FELT_TEMPLE_ATOMS,
  WLOTUS_MINT_ATOMS,
  WLOTUS_SOFT_TEMPLE_ATOMS,
  WLOTUS_MOORE_TIP_COVENANT,
  WLOTUS_MOORE_TIP_MODE,
  isWLotusCovenantExchangePeer,
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

  it('defaults genesis to WLotusCovenant felt redeem; temple / whole-byte are opt-in', () => {
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
    expect(WLOTUS_FELT_COVENANT).toBe('WLotusCovenant');
    expect(
      isWlotusFeltCovenant({ covenant: WLOTUS_FELT_COVENANT_LEGACY }),
    ).toBe(true);
  });

  it('treats same-econ same-genesisUnix forks as 1:1 exchange peers', () => {
    const live = {
      covenant: WLOTUS_FELT_COVENANT_LEGACY,
      mode: WLOTUS_FELT_MODE,
      genesisUnix: 1_700_000_000,
      mintAtomsPerRemint: '108',
      secondsPerExtraBit: 500 * 86_400,
      baseZeroBits: 0,
      mintSplit: { miner: '108', temple: '0' },
      powBatonCount: 28,
    };
    const fork = {
      covenant: WLOTUS_FELT_COVENANT,
      genesisUnix: 1_700_000_000,
      mintAtomsPerRemint: 108n,
      secondsPerExtraBit: 500 * 86_400,
      baseZeroBits: 0,
      powBatonCount: 28,
    };
    expect(isWLotusCovenantExchangePeer(live, fork)).toBe(true);
    expect(
      isWLotusCovenantExchangePeer(live, {
        ...fork,
        genesisUnix: 1_700_000_001,
      }),
    ).toBe(false);
    expect(
      isWLotusCovenantExchangePeer(live, {
        ...fork,
        secondsPerExtraBit: 845 * 86_400,
      }),
    ).toBe(false);
    expect(
      isWLotusCovenantExchangePeer(
        {
          ...live,
          covenant: WLOTUS_MOORE_TIP_COVENANT,
          mode: WLOTUS_MOORE_TIP_MODE,
        },
        fork,
      ),
    ).toBe(false);
  });

  it('keeps the historical Glotus alias bytecode-identical to WLotusCovenant', () => {
    const strip = (src: string) =>
      src
        .replace(/^\/\/.*$/gm, '')
        .replace(/contract\s+\w+/, 'contract X')
        .replace(/\s+/g, ' ')
        .trim();
    const ref = readFileSync(
      resolve(process.cwd(), 'contracts/WLotusCovenant.spedn'),
      'utf8',
    );
    const alias = readFileSync(
      resolve(process.cwd(), 'contracts/GlotusPowRemintMooreTip.spedn'),
      'utf8',
    );
    expect(strip(ref)).toBe(strip(alias));
    expect(ref).toContain('contract WLotusCovenant(');
    expect(alias).toContain('contract GlotusPowRemintMooreTip(');
  });
});
