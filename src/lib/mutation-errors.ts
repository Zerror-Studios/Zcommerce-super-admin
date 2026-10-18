/**
 * One place that turns a failed mutation into user copy (review C-M5).
 *
 * `FORBIDDEN` and `MFA_REQUIRED` are handled once by the Apollo error link
 * (a global toast, and the `/mfa` redirect), so call sites get `null` for
 * them and show nothing. `CONFLICT` and `BAD_USER_INPUT` carry a message
 * the user can act on; everything else is the generic line.
 */

import { toasts } from "../copy";
import { errorCodeOf } from "./apollo-client";

// ─── Constants ────────────────────────────────────────────────────────────

/** Codes the Apollo error link already reports; never toast them twice. */
const GLOBALLY_HANDLED_CODES = new Set(["FORBIDDEN", "MFA_REQUIRED"]);

const USER_MESSAGE_CODES = new Set(["CONFLICT", "BAD_USER_INPUT"]);

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The toast text for a failed mutation, or `null` when nothing more should be shown. */
export function mutationFailureCopy(error: unknown): string | null {
  const code = errorCodeOf(error);
  if (code && GLOBALLY_HANDLED_CODES.has(code)) return null;
  if (code && USER_MESSAGE_CODES.has(code)) return (error as Error).message;
  return toasts.genericError;
}

/** True for the validation errors a form should show inline instead of toasting. */
export function isUserInputError(error: unknown): boolean {
  return errorCodeOf(error) === "BAD_USER_INPUT";
}
