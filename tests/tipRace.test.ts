import { isTipRaceLost, liveTipEpochFromStatus } from '../apps/web/src/lib/tipRace.js';

describe('isTipRaceLost', () => {
  it('matches server race and stale-challenge errors', () => {
    expect(
      isTipRaceLost(
        'Someone else offered on this tip first. Pull to refresh and Offer again.',
      ),
    ).toBe(true);
    expect(isTipRaceLost('TIP_RACE_LOST')).toBe(true);
    expect(isTipRaceLost('Challenge is expired')).toBe(true);
    expect(isTipRaceLost('Challenge expired; request a new one')).toBe(true);
    expect(isTipRaceLost('Need XEC for fees')).toBe(false);
  });
});

describe('liveTipEpochFromStatus', () => {
  it('uses tipEpochs[tipIndex] when available', () => {
    expect(
      liveTipEpochFromStatus(
        { tipEpoch: 'primary', tipEpochs: { '0': 'a', '1': 'b' } },
        1,
        'b',
      ),
    ).toBe('b');
  });

  it('does not fall back to primary tipEpoch when tipIndex is known', () => {
    expect(
      liveTipEpochFromStatus({ tipEpoch: 'primary-changed' }, 1, 'mine-epoch'),
    ).toBe('mine-epoch');
  });
});
