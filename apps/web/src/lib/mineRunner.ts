import type { MineProgress, MineResult } from './clientMine.js';
import type { WorkerIn, WorkerOut } from './powWorker.js';

let jobSeq = 1;

/**
 * Mine Prayer PoW in a Web Worker. Falls back to main-thread mining if workers fail.
 */
export async function mineInWorker(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult> {
  try {
    const worker = new Worker(new URL('./powWorker.ts', import.meta.url), {
      type: 'module',
    });
    const jobId = jobSeq++;
    return await new Promise<MineResult>((resolve, reject) => {
      const onAbort = () => {
        const msg: WorkerIn = { type: 'abort', jobId };
        worker.postMessage(msg);
        worker.terminate();
        reject(new DOMException('Mining aborted', 'AbortError'));
      };
      opts.signal?.addEventListener('abort', onAbort, { once: true });

      worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const msg = ev.data;
        if (msg.jobId !== jobId) return;
        if (msg.type === 'progress') {
          opts.onProgress?.({
            attempts: msg.attempts,
            elapsedMs: msg.elapsedMs,
            hashrateHps: msg.hashrateHps,
          });
          return;
        }
        opts.signal?.removeEventListener('abort', onAbort);
        worker.terminate();
        if (msg.type === 'done') {
          resolve({
            nonceHex: msg.nonceHex,
            attempts: msg.attempts,
            elapsedMs: msg.elapsedMs,
            hashrateHps: msg.hashrateHps,
          });
        } else {
          reject(new Error(msg.message));
        }
      };
      worker.onerror = ev => {
        opts.signal?.removeEventListener('abort', onAbort);
        worker.terminate();
        reject(ev.error ?? new Error(ev.message || 'Worker error'));
      };

      const start: WorkerIn = {
        type: 'mine',
        jobId,
        powPrefixHex: opts.powPrefixHex,
        bits: opts.bits,
        nonceLength: opts.nonceLength,
      };
      worker.postMessage(start);
    });
  } catch {
    const { minePrayerPow } = await import('./clientMine.js');
    return minePrayerPow(opts);
  }
}
