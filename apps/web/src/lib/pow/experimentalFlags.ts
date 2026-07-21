/**
 * Experimental phone PoW backends (WebGPU + multi-core workers).
 * Default production path remains single Web Worker + ecash-lib SHA256d.
 *
 * Enable:
 *   VITE_EXPERIMENTAL_POW=1
 *   or localStorage.setItem('wlotus.experimentalPow', '1')
 *
 * See docs/research/phone-webgpu-wasm-mining.md
 */

export type PowBackend = 'webgpu' | 'multi-worker' | 'worker' | 'main';

export const EXPERIMENTAL_POW_KEY = 'wlotus.experimentalPow';

/** Build-time or runtime opt-in for experimental miners. */
export function isExperimentalPowEnabled(): boolean {
  const env = (import.meta.env.VITE_EXPERIMENTAL_POW as string | undefined)
    ?.trim()
    .toLowerCase();
  if (env === '1' || env === 'true' || env === 'yes') return true;
  if (env === '0' || env === 'false' || env === 'no') return false;
  try {
    const v = localStorage.getItem(EXPERIMENTAL_POW_KEY)?.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

export function setExperimentalPowEnabled(on: boolean): void {
  try {
    localStorage.setItem(EXPERIMENTAL_POW_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
