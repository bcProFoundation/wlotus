import {
  burnAtomsFromTokenEntries,
  groupLotusAtoms,
  parseBurnAtoms,
  sumLotusAtoms,
} from '../src/offering/lotusAtoms.js';

describe('lotusAtoms', () => {
  it('parses on-chain atom strings', () => {
    expect(parseBurnAtoms('102')).toBe(102);
    expect(parseBurnAtoms(1n)).toBe(1);
    expect(parseBurnAtoms(undefined)).toBe(1);
    expect(parseBurnAtoms('0')).toBe(1);
  });

  it('sums event-day burns instead of counting offerings', () => {
    expect(
      sumLotusAtoms([
        { burnAtoms: '1' },
        { burnAtoms: '1' },
        { burnAtoms: '102' },
      ]),
    ).toBe(104);
    expect(sumLotusAtoms([], 8)).toBe(8);
  });

  it('prefers index totalLotus on trending rows with burns stripped', () => {
    expect(
      groupLotusAtoms({ totalBurns: 8, totalLotus: 109, burns: [] }),
    ).toBe(109);
    expect(groupLotusAtoms({ totalBurns: 8, burns: [] })).toBe(8);
  });

  it('reads actualBurnAtoms for the token', () => {
    const token = 'aa'.repeat(32);
    expect(
      burnAtomsFromTokenEntries(
        [
          {
            tokenId: token,
            actualBurnAtoms: 102n,
            intentionalBurnAtoms: 102n,
          },
        ],
        token,
      ),
    ).toBe('102');
    expect(burnAtomsFromTokenEntries([], token)).toBe('1');
  });
});
