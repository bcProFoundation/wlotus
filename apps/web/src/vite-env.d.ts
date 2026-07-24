/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="@webgpu/types" />

interface ImportMetaEnv {
  readonly VITE_PRAYER_TOKEN_ID?: string;
  readonly VITE_PRAYER_TICKER?: string;
  readonly VITE_MINT_API_BASE?: string;
  /** DANA index base — empty = same origin `/index-api`. */
  readonly VITE_DANA_INDEX_BASE?: string;
  readonly VITE_CHRONIK_URLS?: string;
  /** Tip-epoch poll interval while mining (ms). Default 2000. */
  readonly VITE_TIP_POLL_MS?: string;
  /**
   * Soft pray floor in **seconds** between remint and memorial burn. Default 108
   * (~2 min — one second per mala bead). Set to 0 to disable. Remint still
   * submits immediately on PoW success.
   */
  readonly VITE_MIN_PRAY_SECONDS?: string;
  /**
   * Experimental phone PoW: WebGPU → multi-worker.
   * Default off — see docs/research/phone-webgpu-wasm-mining.md
   */
  readonly VITE_EXPERIMENTAL_POW?: string;
  /**
   * When experimental PoW is on: auto | webgpu | multi-worker | worker.
   * Use multi-worker (or cpu) for multi-core CPU only.
   */
  readonly VITE_POW_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
