/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL of the API service, e.g. https://your-api.up.railway.app (no trailing slash) */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
