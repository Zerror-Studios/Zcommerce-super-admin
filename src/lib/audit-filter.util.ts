/**
 * Audit log search (PRD-014 close-out)
 *
 * The audit log search is a prefix match on the action name
 * (`PlatformAuditFilter.actionPrefix`): "coupon." finds every coupon change.
 * The server matches literally, case-sensitive, and refuses a prefix longer
 * than 64 characters with `BAD_USER_INPUT` / `ACTION_PREFIX_TOO_LONG`.
 */

import { errorReasonOf } from "./apollo-client";

// ─── Constants ────────────────────────────────────────────────────────────

/** The backend's cap (`AUDIT_ACTION_PREFIX_MAX_LENGTH`). */
export const AUDIT_ACTION_PREFIX_MAX_LENGTH = 64;

export const ACTION_PREFIX_TOO_LONG_REASON = "ACTION_PREFIX_TOO_LONG";

export const ACTION_PREFIX_TOO_LONG_COPY =
  `Search for at most ${AUDIT_ACTION_PREFIX_MAX_LENGTH} characters ` +
  "of an action name, e.g. coupon.";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The `platformAuditLog` filter for a search box value (empty = no filter). */
export function auditFilterOf(search: string): { actionPrefix?: string } {
  const actionPrefix = search.trim();
  return actionPrefix ? { actionPrefix } : {};
}

/** Inline copy for a refused search, or `null` for any other failure. */
export function auditSearchErrorCopy(error: unknown): string | null {
  return errorReasonOf(error) === ACTION_PREFIX_TOO_LONG_REASON
    ? ACTION_PREFIX_TOO_LONG_COPY
    : null;
}

// ─── Store activity (PRD-024 FR-1.12, P-04) ───────────────────────────────

/** Rows the store page's Activity section reads at a time. */
export const STORE_ACTIVITY_PAGE_SIZE = 20;

/** The server's page cap (`clampPagination`). */
export const STORE_ACTIVITY_MAX_ROWS = 100;

/**
 * The audit filter for one store: every row whose target is the tenant
 * (store lifecycle, details, subscription actions), newest first.
 */
export function tenantActivityFilter(tenantId: string): { targetId: string } {
  return { targetId: tenantId };
}

/** The next Activity page size, capped at the server's maximum. */
export function nextActivityLimit(current: number): number {
  return Math.min(STORE_ACTIVITY_MAX_ROWS, current + STORE_ACTIVITY_PAGE_SIZE);
}
