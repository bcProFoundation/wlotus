import {
  parseServingTipCount,
  parseServingTipIndex,
  selectServingTips,
} from '../src/mint/servingTips.js';

describe('selectServingTips', () => {
  const tips = [2, 0, 1].map(index => ({ index }));

  it('serves tip 0 by default (prod launch)', () => {
    expect(
      selectServingTips(tips, { count: 1, index: 0 }).map(t => t.index),
    ).toEqual([0]);
  });

  it('lets test pin baton 27 (last of 28)', () => {
    const twentyEight = Array.from({ length: 28 }, (_, index) => ({ index }));
    expect(
      selectServingTips(twentyEight, { count: 1, index: 27 }).map(
        t => t.index,
      ),
    ).toEqual([27]);
  });

  it('matches baton index, not array position', () => {
    const sparse = [{ index: 27 }, { index: 0 }];
    expect(
      selectServingTips(sparse, { count: 1, index: 27 }).map(t => t.index),
    ).toEqual([27]);
    expect(
      selectServingTips(sparse, { count: 1, index: 0 }).map(t => t.index),
    ).toEqual([0]);
  });

  it('parses env (invalid → count 1, index 0)', () => {
    expect(parseServingTipCount(undefined)).toBe(1);
    expect(parseServingTipCount('0')).toBe(1);
    expect(parseServingTipIndex(undefined)).toBe(0);
    expect(parseServingTipIndex('-3')).toBe(0);
    expect(parseServingTipIndex('1')).toBe(1);
    expect(parseServingTipIndex('27')).toBe(27);
    expect(parseServingTipIndex('1.5')).toBe(0);
    expect(parseServingTipIndex('28')).toBe(27);
    expect(parseServingTipIndex('Infinity')).toBe(0);
    expect(parseServingTipCount('Infinity')).toBe(1);
    expect(parseServingTipCount('99')).toBe(28);
  });

  it('does not allocate from count', () => {
    const sparse = [{ index: 0 }, { index: 27 }];
    expect(
      selectServingTips(sparse, { count: Number.POSITIVE_INFINITY, index: 0 }).map(
        t => t.index,
      ),
    ).toEqual([0]);
  });

  it('prefers MINT_SERVING_TIP_INDEX over deprecated OFFSET env', () => {
    const prevIndex = process.env.MINT_SERVING_TIP_INDEX;
    const prevOffset = process.env.MINT_SERVING_TIP_OFFSET;
    try {
      process.env.MINT_SERVING_TIP_OFFSET = '1';
      delete process.env.MINT_SERVING_TIP_INDEX;
      expect(parseServingTipIndex()).toBe(1);
      process.env.MINT_SERVING_TIP_INDEX = '27';
      expect(parseServingTipIndex()).toBe(27);
    } finally {
      if (prevIndex === undefined) delete process.env.MINT_SERVING_TIP_INDEX;
      else process.env.MINT_SERVING_TIP_INDEX = prevIndex;
      if (prevOffset === undefined) delete process.env.MINT_SERVING_TIP_OFFSET;
      else process.env.MINT_SERVING_TIP_OFFSET = prevOffset;
    }
  });
});
