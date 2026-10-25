/**
 * One place that turns a failed mutation into user copy (review C-M5).
 *
 * `FORBIDDEN` and `MFA_REQUIRED` are handled once by the Apollo error link
 * (a global toast, and the `/mfa` redirect), so call sites get `null` for
 * them and show nothing, except a business-rule `FORBIDDEN` with a known
 * reason (`PAYMENT_REQUIRED`), which the link leaves to the screen. A known `extensions.reason` gets the console's own
 * copy; otherwise `CONFLICT` and `BAD_USER_INPUT` carry a message the user
 * can act on, and everything else is the generic line. Never branch on the
 * message text.
 */

import { toasts } from "../copy";
import { errorCodeOf, errorReasonOf } from "./apollo-client";

// ─── Constants ────────────────────────────────────────────────────────────

/** Codes the Apollo error link already reports; never toast them twice. */
const GLOBALLY_HANDLED_CODES = new Set(["FORBIDDEN", "MFA_REQUIRED"]);

const USER_MESSAGE_CODES = new Set(["CONFLICT", "BAD_USER_INPUT"]);

/** Console copy for the `extensions.reason` values it knows (PRD-014). */
export const MUTATION_REASON_COPY: Readonly<Record<string, string>> = {
  // D6 / FR-0.10: no proration yet, so a plan change waits for period end.
  PRORATION_NOT_AVAILABLE:
    "Immediate plan changes need prorated invoicing. Schedule the change " +
    "for the end of the period.",
  // SEC-04: only a recorded payment (or the audited override) activates.
  PAYMENT_REQUIRED:
    "This subscription becomes active when its payment is recorded. Record " +
    "the payment, or use Activate without payment.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The toast text for a failed mutation, or `null` when nothing more should be shown. */
export function mutationFailureCopy(error: unknown): string | null {
  const code = errorCodeOf(error);
  const reason = errorReasonOf(error);
  if (reason && MUTATION_REASON_COPY[reason]) return MUTATION_REASON_COPY[reason];
  if (code && GLOBALLY_HANDLED_CODES.has(code)) return null;
  if (code && USER_MESSAGE_CODES.has(code)) return (error as Error).message;
  return toasts.genericError;
}

/** True for the validation errors a form should show inline instead of toasting. */
export function isUserInputError(error: unknown): boolean {
  return errorCodeOf(error) === "BAD_USER_INPUT";
}
