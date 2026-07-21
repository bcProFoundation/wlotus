/**
 * Parallel Web Workers with partitioned nonce space (experimental phone path).
 */
import { toHex } from 'ecash-lib';
import type { MineProgress, MineResult } from '../clientMine.js';
import type { WorkerIn, WorkerOut } from '../powWorker.js';

function workerCount(): number {
  const hc =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, hc > 1 ? hc - 1 : 1));
}

export async function mineMultiWorker(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult & { backend: 'multi-worker'; workers: number }> {
  const n = workerCount();
  const nonceLen = opts.nonceLength ?? 4;
  const controllers = Array.from({ length: n }, () => new AbortController());
  const linkAbort = () => {
    for (const c of controllers) c.abort();
  };
  opts.signal?.addEventListener('abort', linkAbort, { once: true });

  let jobSeq = 1;
  let attemptsBest = 0;
  const t0 = performance.now();

  const tasks = controllers.map((ctl, workerIndex) => {
    const worker = new Worker(new URL('../powWorker.ts', import.meta.url), {
      type: 'module',
    });
    const jobId = jobSeq++;
    const start = new Uint8Array(nonceLen);
    start[0] = workerIndex & 0xff;
    if (nonceLen > 1) start[1] = (workerIndex >> 8) & 0xff;

    return new Promise<MineResult>((resolve, reject) => {
      const onAbort = () => {
        worker.postMessage({ type: 'abort', jobId } satisfies WorkerIn);
        worker.terminate();
        reject(new DOMException('Mining aborted', 'AbortError'));
      };
      ctl.signal.addEventListener('abort', onAbort, { once: true });

      worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const msg = ev.data;
        if (msg.jobId !== jobId) return;
        if (msg.type === 'progress') {
          attemptsBest = Math.max(attemptsBest, msg.attempts * n);
          const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
          opts.onProgress?.({
            attempts: attemptsBest,
            elapsedMs,
            hashrateHps: Math.round(attemptsBest / (elapsedMs / 1000)),
          });
          return;
        }
        ctl.signal.removeEventListener('abort', onAbort);
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
        ctl.signal.removeEventListener('abort', onAbort);
        worker.terminate();
        reject(ev.error ?? new Error(ev.message || 'Worker error'));
      };

      const startMsg: WorkerIn = {
        type: 'mine',
        jobId,
        powPrefixHex: opts.powPrefixHex,
        bits: opts.bits,
        nonceLength: nonceLen,
        nonceStartHex: toHex(start),
        nonceStride: n,
      };
      worker.postMessage(startMsg);
    });
  });

  try {
    const winner = await Promise.any(tasks);
    linkAbort();
    const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
    const totalAttempts = Math.max(winner.attempts * n, attemptsBest);
    return {
      nonceHex: winner.nonceHex,
      attempts: totalAttempts,
      elapsedMs,
      hashrateHps: Math.round(totalAttempts / (elapsedMs / 1000)),
      backend: 'multi-worker',
      workers: n,
    };
  } finally {
    opts.signal?.removeEventListener('abort', linkAbort);
    linkAbort();
  }
}
