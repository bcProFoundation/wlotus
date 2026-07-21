/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="@webgpu/types" />

interface ImportMetaEnv {
  readonly VITE_PRAYER_TOKEN_ID?: string;
  readonly VITE_PRAYER_TICKER?: string;
  readonly VITE_MINT_API_BASE?: string;
  readonly VITE_CHRONIK_URLS?: string;
  /** Tip-epoch poll interval while mining (ms). Default 2000. */
  readonly VITE_TIP_POLL_MS?: string;
  /**
   * Minimum wall-clock prayer time before submit (ms). Default 60000.
   * Set to 0 to disable. Floor for early PoW finds on single-CPU mining.
   */
  readonly VITE_MIN_PRAY_MS?: string;
  /**
   * Experimental phone PoW: WebGPU → multi-worker.
   * Default off — see docs/research/phone-webgpu-wasm-mining.md
   * Official Offer path uses single CPU worker regardless.
   */
  readonly VITE_EXPERIMENTAL_POW?: string;
  /**
   * When experimental PoW is on: auto | webgpu | multi-worker | worker.
   * Use multi-worker (or cpu) for multi-core CPU only.
   * Not used by the official Offer path (single worker).
   */
  readonly VITE_POW_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
