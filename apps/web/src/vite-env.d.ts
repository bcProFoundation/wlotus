/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRAYER_TOKEN_ID?: string;
  readonly VITE_PRAYER_TICKER?: string;
  readonly VITE_CHRONIK_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
