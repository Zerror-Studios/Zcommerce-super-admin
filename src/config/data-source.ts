/**
 * Gateway endpoint (PRD-005 FR-11.1). The console reads everything through
 * the one Apollo client; the `mock` data source was removed on 2026-10-17
 * (PRD-005 §8 Q14). Same-origin `/v1/graphql` keeps the HttpOnly refresh
 * cookie first-party: the Vite proxy forwards it in dev, the edge in prod.
 */

export const GATEWAY_URL: string =
  import.meta.env.VITE_GATEWAY_URL || "/v1/graphql";
