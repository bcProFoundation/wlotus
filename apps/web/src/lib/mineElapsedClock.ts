/**
 * Elapsed mining clock for the Offer UI.
 *
 * - Does **not** reset across tip-race retries (same Offer session).
 * - Pauses while the document is hidden (screen off / other app) so wall
 *   time in the background is not counted.
 * - Separate from worker `elapsedMs` (PoW timer for the current attempt only).
 */
export class MineElapsedClock {
  private accumMs = 0;
  private segmentStart: number | null = null;
  private running = false;
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  /** Start or restart a new Offer session. */
  resetAndStart(): void {
    this.accumMs = 0;
    this.segmentStart = this.now();
    this.running = true;
  }

  /** Pause without clearing accumulated time (visibility hidden). */
  pause(): void {
    if (!this.running) return;
    if (this.segmentStart != null) {
      this.accumMs += Math.max(0, this.now() - this.segmentStart);
      this.segmentStart = null;
    }
  }

  /** Resume after pause; no-op if still in an open segment. */
  resume(): void {
    if (!this.running) return;
    if (this.segmentStart == null) {
      this.segmentStart = this.now();
    }
  }

  /** Stop the session (cancel / success). Keeps last reading via readMs(). */
  stop(): void {
    this.pause();
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  readMs(): number {
    let total = this.accumMs;
    if (this.segmentStart != null) {
      total += Math.max(0, this.now() - this.segmentStart);
    }
    return total;
  }
}
