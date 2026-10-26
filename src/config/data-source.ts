/**
 * Gateway endpoint (PRD-005 FR-11.1). The console reads everything through
 * the one Apollo client; the `mock` data source was removed on 2026-10-17
 * (PRD-005 §8 Q14). Same-origin `/v1/graphql` keeps the HttpOnly refresh
 * cookie first-party: the Vite proxy forwards it in dev, the edge in prod.
 */

export const GATEWAY_URL: string =
  import.meta.env.VITE_GATEWAY_URL || "/v1/graphql";

/**
 * The store admin address with `{slug}` (ADR-003, PRD-007): the console's
 * fallback for "Log in to store" when the API sends no `adminUrl`, so the
 * copied sign-in link is a full address, not just the fragment (PRD-014
 * UX-26). Production defaults to the shared admin host; development to
 * the dashboard's Vite dev server.
 */
export const STORE_ADMIN_URL_TEMPLATE: string =
  import.meta.env.VITE_STORE_ADMIN_URL_TEMPLATE ||
  (import.meta.env.PROD
    ? "https://store.zerrorstudios.com/store/{slug}"
    : "http://localhost:5173/store/{slug}");

/** The build's version for the shell (vite.config.ts, PRD-024 FR-1.5). */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
