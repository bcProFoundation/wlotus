import {
  parseServingTipCount,
  parseServingTipOffset,
  selectServingTips,
} from '../src/mint/servingTips.js';

describe('selectServingTips', () => {
  const tips = [2, 0, 1].map(index => ({ index }));

  it('serves the first tip by default (prod launch)', () => {
    expect(selectServingTips(tips, { count: 1, offset: 0 }).map(t => t.index)).toEqual(
      [0],
    );
  });

  it('lets test pin the last of 28 batons', () => {
    const twentyEight = Array.from({ length: 28 }, (_, index) => ({ index }));
    expect(
      selectServingTips(twentyEight, { count: 1, offset: 27 }).map(t => t.index),
    ).toEqual([27]);
  });

  it('parses env (invalid → count 1, offset 0)', () => {
    expect(parseServingTipCount(undefined)).toBe(1);
    expect(parseServingTipCount('0')).toBe(1);
    expect(parseServingTipOffset(undefined)).toBe(0);
    expect(parseServingTipOffset('-3')).toBe(0);
    expect(parseServingTipOffset('1')).toBe(1);
  });
});
