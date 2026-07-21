import type { MineProgress, MineResult } from './clientMine.js';
import { mineInWorkerSingle } from './singleWorkerMine.js';

export { mineInWorkerSingle };

/**
 * Mine Prayer PoW — single CPU Web Worker only (fairest ritual time).
 *
 * Experimental WebGPU / multi-worker backends remain in `pow/` for local
 * research (`VITE_EXPERIMENTAL_POW`) but are not used on the official path.
 */
export async function mineInWorker(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult> {
  return mineInWorkerSingle(opts);
}
