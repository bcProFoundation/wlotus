/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_PRAYER_TOKEN_ID?: string;
  readonly VITE_PRAYER_TICKER?: string;
  readonly VITE_MINT_API_BASE?: string;
  readonly VITE_CHRONIK_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
