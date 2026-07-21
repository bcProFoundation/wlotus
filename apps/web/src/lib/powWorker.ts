/// <reference lib="webworker" />
/**
 * Web Worker entry — mines Prayer PoW off the main thread.
 */
import { minePrayerPow } from './clientMine.js';

export type WorkerIn =
  | {
      type: 'mine';
      jobId: number;
      powPrefixHex: string;
      bits: number;
      nonceLength?: number;
      /** LE start nonce hex (multi-worker partition). */
      nonceStartHex?: string;
      /** Stride between attempts (multi-worker partition). */
      nonceStride?: number;
    }
  | { type: 'abort'; jobId: number };

export type WorkerOut =
  | {
      type: 'progress';
      jobId: number;
      attempts: number;
      elapsedMs: number;
      hashrateHps: number;
    }
  | {
      type: 'done';
      jobId: number;
      nonceHex: string;
      attempts: number;
      elapsedMs: number;
      hashrateHps: number;
    }
  | { type: 'error'; jobId: number; message: string };

let controller: AbortController | null = null;
let activeJob = -1;

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type === 'abort') {
    if (msg.jobId === activeJob && controller) controller.abort();
    return;
  }
  if (msg.type !== 'mine') return;

  if (controller) controller.abort();
  controller = new AbortController();
  activeJob = msg.jobId;
  const jobId = msg.jobId;
  const signal = controller.signal;

  void minePrayerPow({
    powPrefixHex: msg.powPrefixHex,
    bits: msg.bits,
    nonceLength: msg.nonceLength,
    nonceStartHex: msg.nonceStartHex,
    nonceStride: msg.nonceStride,
    signal,
    onProgress: p => {
      const out: WorkerOut = { type: 'progress', jobId, ...p };
      self.postMessage(out);
    },
  })
    .then(result => {
      if (signal.aborted) return;
      const out: WorkerOut = { type: 'done', jobId, ...result };
      self.postMessage(out);
    })
    .catch((e: unknown) => {
      if (signal.aborted) return;
      const out: WorkerOut = {
        type: 'error',
        jobId,
        message: e instanceof Error ? e.message : String(e),
      };
      self.postMessage(out);
    });
};
