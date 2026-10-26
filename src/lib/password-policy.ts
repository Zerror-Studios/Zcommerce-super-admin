/**
 * Password policy (PRD-014 FR-1.10, UX-34)
 *
 * One rule for every platform password: at least 8 characters, the same
 * minimum the backend enforces (`BAD_USER_INPUT`, reason `WEAK_PASSWORD`).
 * The server still decides; this only lets the form answer before a
 * round trip.
 */

// ─── Constants ────────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 8;

/** `extensions.reason` values the set-password form understands. */
export const passwordErrorReasonEnum = {
  WEAK_PASSWORD: "WEAK_PASSWORD",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
} as const;

// ─── Checks ───────────────────────────────────────────────────────────────

/** The field error for `password`, or `null` when it meets the policy. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Loose shape check before asking for a reset link; the server decides. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
