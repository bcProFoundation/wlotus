/**
 * Experimental miner orchestration.
 * Default order: WebGPU → multi-worker → single worker.
 * Override with getPowBackendPreference() (`multi-worker` skips GPU).
 */
import type { MineProgress, MineResult } from '../clientMine.js';
import {
  getPowBackendPreference,
  isExperimentalPowEnabled,
} from './experimentalFlags.js';
import { mineMultiWorker } from './multiWorkerMine.js';
import { isWebGpuAvailable, mineWebGpu } from './webgpuMine.js';

export type ExperimentalMineResult = MineResult & {
  backend: 'webgpu' | 'multi-worker' | 'worker' | 'main';
};

export async function mineExperimental(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<ExperimentalMineResult> {
  const pref = getPowBackendPreference();

  const tryWebGpu = async (): Promise<ExperimentalMineResult | null> => {
    if (!isWebGpuAvailable()) return null;
    try {
      return await mineWebGpu(opts);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      console.warn('[wlotus] WebGPU mine failed, falling back:', e);
      return null;
    }
  };

  const tryMulti = async (): Promise<ExperimentalMineResult | null> => {
    try {
      return await mineMultiWorker(opts);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      console.warn('[wlotus] multi-worker mine failed, falling back:', e);
      return null;
    }
  };

  const trySingle = async (): Promise<ExperimentalMineResult> => {
    const { mineInWorkerSingle } = await import('../singleWorkerMine.js');
    const r = await mineInWorkerSingle(opts);
    return { ...r, backend: 'worker' };
  };

  if (pref === 'webgpu') {
    return (await tryWebGpu()) ?? (await tryMulti()) ?? (await trySingle());
  }
  if (pref === 'multi-worker') {
    return (await tryMulti()) ?? (await trySingle());
  }
  if (pref === 'worker') {
    return trySingle();
  }

  // auto
  return (
    (await tryWebGpu()) ?? (await tryMulti()) ?? (await trySingle())
  );
}

export {
  getPowBackendPreference,
  isExperimentalPowEnabled,
  setPowBackendPreference,
  setExperimentalPowEnabled,
} from './experimentalFlags.js';
