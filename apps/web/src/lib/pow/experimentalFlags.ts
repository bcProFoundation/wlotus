/**
 * Experimental phone PoW backends (WebGPU + multi-core workers).
 * Default production path remains single Web Worker + ecash-lib SHA256d.
 *
 * Enable experimental stack:
 *   VITE_EXPERIMENTAL_POW=1
 *   or localStorage.setItem('wlotus.experimentalPow', '1')
 *
 * Prefer a backend (optional):
 *   VITE_POW_BACKEND=multi-worker|webgpu|worker|auto
 *   or localStorage.setItem('wlotus.powBackend', 'multi-worker')
 *
 * See docs/research/phone-webgpu-wasm-mining.md
 */

export type PowBackend = 'webgpu' | 'multi-worker' | 'worker' | 'main';
export type PowBackendPreference = 'auto' | 'webgpu' | 'multi-worker' | 'worker';

export const EXPERIMENTAL_POW_KEY = 'wlotus.experimentalPow';
export const POW_BACKEND_KEY = 'wlotus.powBackend';

function normalizeFlag(raw: string | undefined | null): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return null;
}

/** Build-time or runtime opt-in for experimental miners. */
export function isExperimentalPowEnabled(): boolean {
  const env = normalizeFlag(
    import.meta.env.VITE_EXPERIMENTAL_POW as string | undefined,
  );
  if (env != null) return env;
  try {
    const v = normalizeFlag(localStorage.getItem(EXPERIMENTAL_POW_KEY));
    return v === true;
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

function parseBackend(raw: string | undefined | null): PowBackendPreference | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (
    v === 'auto' ||
    v === 'webgpu' ||
    v === 'multi-worker' ||
    v === 'multicore' ||
    v === 'cpu' ||
    v === 'worker'
  ) {
    if (v === 'multicore' || v === 'cpu') return 'multi-worker';
    return v as PowBackendPreference;
  }
  return null;
}

/**
 * Preferred experimental backend.
 * `multi-worker` / `cpu` = phone multi-core CPU only (skip WebGPU).
 */
export function getPowBackendPreference(): PowBackendPreference {
  const env = parseBackend(
    import.meta.env.VITE_POW_BACKEND as string | undefined,
  );
  if (env) return env;
  try {
    return parseBackend(localStorage.getItem(POW_BACKEND_KEY)) ?? 'auto';
  } catch {
    return 'auto';
  }
}

export function setPowBackendPreference(pref: PowBackendPreference): void {
  try {
    localStorage.setItem(POW_BACKEND_KEY, pref);
  } catch {
    /* ignore */
  }
}
