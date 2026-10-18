/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GraphQL endpoint; default "/v1/graphql" (same-origin). */
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_REFRESH_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
