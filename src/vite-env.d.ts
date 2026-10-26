/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GraphQL endpoint; default "/v1/graphql" (same-origin). */
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_REFRESH_TIMEOUT_MS?: string;
  /** Deadline for one API request, in ms; default 30000 (PRD-014 FE-23). */
  readonly VITE_HTTP_TIMEOUT_MS?: string;
  /** Store admin address with {slug}; see config/data-source.ts (UX-26). */
  readonly VITE_STORE_ADMIN_URL_TEMPLATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The build's version (vite.config.ts `define`, PRD-024 FR-1.5). */
declare const __APP_VERSION__: string;
