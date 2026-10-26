/**
 * Why a session read failed (PRD-014 FE-23)
 *
 * `platformMe` can fail because the session is gone (the server says so
 * with an auth code) or because the server couldn't be reached (network,
 * timeout, 5xx). Only the first signs the operator out; the second keeps
 * the session and offers Retry. Codes, never message text.
 */

// ─── Constants ────────────────────────────────────────────────────────────

/** `extensions.code` values that mean the session itself is not valid. */
const SESSION_REJECTION_CODES = new Set([
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "INVALID_AUTH_TOKEN",
  "ACCOUNT_DISABLED",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────

/** True when the server rejected the session (sign out); false for an outage. */
export function isSessionRejection(error: unknown): boolean {
  const graphQLErrors = (
    error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> }
  )?.graphQLErrors;
  return (graphQLErrors ?? []).some((entry) =>
    SESSION_REJECTION_CODES.has(String(entry.extensions?.code ?? "")),
  );
}
