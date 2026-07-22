import type { MineProgress, MineResult } from './clientMine.js';
import {
  getPowBackendPreference,
  isExperimentalPowEnabled,
  mineExperimental,
} from './pow/experimentalMine.js';
import { mineInWorkerSingle } from './singleWorkerMine.js';

export { mineInWorkerSingle };

/**
 * Mine Prayer PoW.
 * When `VITE_EXPERIMENTAL_POW=1` (launch WebGPU path): WebGPU → multi-worker → single.
 * Otherwise: single CPU Web Worker.
 */
export async function mineInWorker(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult> {
  if (isExperimentalPowEnabled()) {
    try {
      const r = await mineExperimental(opts);
      console.info(
        '[wlotus] pow backend:',
        r.backend,
        `(pref=${getPowBackendPreference()})`,
      );
      return r;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      console.warn('[wlotus] experimental pow failed, using single worker:', e);
    }
  }
  return mineInWorkerSingle(opts);
}
