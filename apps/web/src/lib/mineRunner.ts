import type { MineProgress, MineResult } from './clientMine.js';
import {
  getPowBackendPreference,
  isExperimentalPowEnabled,
  mineExperimental,
} from './pow/experimentalMine.js';
import { mineInWorkerSingle } from './singleWorkerMine.js';

export { mineInWorkerSingle };

/**
 * Mine Prayer PoW. Default: single Web Worker.
 * When experimental PoW is enabled: WebGPU → multi-worker → single worker.
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
        '[wlotus] experimental pow backend:',
        r.backend,
        `(pref=${getPowBackendPreference()})`,
      );
      return r;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      console.warn('[wlotus] experimental pow failed, using default worker:', e);
    }
  }
  return mineInWorkerSingle(opts);
}
