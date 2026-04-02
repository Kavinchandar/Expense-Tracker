/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLAID_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
