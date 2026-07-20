import { MineElapsedClock } from '../apps/web/src/lib/mineElapsedClock.js';

describe('MineElapsedClock', () => {
  it('accumulates while running and does not count paused time', () => {
    let t = 1_000_000;
    const c = new MineElapsedClock(() => t);
    c.resetAndStart();
    t += 60_000;
    expect(c.readMs()).toBe(60_000);
    c.pause();
    t += 120_000; // background — not counted
    expect(c.readMs()).toBe(60_000);
    c.resume();
    t += 30_000;
    expect(c.readMs()).toBe(90_000);
  });

  it('keeps time across tip-retry style continue (no reset)', () => {
    let t = 0;
    const c = new MineElapsedClock(() => t);
    c.resetAndStart();
    t += 45_000;
    // tip moved — do not call resetAndStart again
    t += 45_000;
    expect(c.readMs()).toBe(90_000);
  });

  it('stop freezes the reading', () => {
    let t = 0;
    const c = new MineElapsedClock(() => t);
    c.resetAndStart();
    t += 10_000;
    c.stop();
    t += 50_000;
    expect(c.readMs()).toBe(10_000);
  });
});
