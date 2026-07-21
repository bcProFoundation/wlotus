/**
 * Experimental miner orchestration: WebGPU → multi-worker → single worker.
 */
import type { MineProgress, MineResult } from '../clientMine.js';
import { isExperimentalPowEnabled } from './experimentalFlags.js';
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
  if (isWebGpuAvailable()) {
    try {
      return await mineWebGpu(opts);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      console.warn('[wlotus] WebGPU mine failed, falling back:', e);
    }
  }

  try {
    return await mineMultiWorker(opts);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    console.warn('[wlotus] multi-worker mine failed, falling back:', e);
  }

  // Avoid importing mineRunner here (circular). Single-thread worker fallback:
  const { mineInWorkerSingle } = await import('../singleWorkerMine.js');
  const r = await mineInWorkerSingle(opts);
  return { ...r, backend: 'worker' };
}

export { isExperimentalPowEnabled };
