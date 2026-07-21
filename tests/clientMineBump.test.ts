import { bumpNonceLe, meetsPowBits } from '../apps/web/src/lib/powBits.js';

describe('powBits helpers', () => {
  test('bumpNonceLe strides across bytes', () => {
    const n = new Uint8Array(4);
    bumpNonceLe(n, 1);
    expect([...n]).toEqual([1, 0, 0, 0]);
    bumpNonceLe(n, 255);
    expect([...n]).toEqual([0, 1, 0, 0]);
    n.fill(0);
    n[0] = 3;
    bumpNonceLe(n, 4);
    expect([...n]).toEqual([7, 0, 0, 0]);
  });

  test('meetsPowBits whole-byte', () => {
    const h = new Uint8Array(32);
    expect(meetsPowBits(h, 16)).toBe(true);
    h[1] = 1;
    expect(meetsPowBits(h, 16)).toBe(false);
  });
});
