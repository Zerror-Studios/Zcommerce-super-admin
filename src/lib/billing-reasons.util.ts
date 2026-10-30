/**
 * Cancellation and void reasons for the console (PRD-025 FR-4, FR-6.4)
 *
 * Staff must name why a subscription is cancelled and why an invoice is
 * voided (`SubscriptionCancelReason`, `InvoiceVoidReason`). These helpers
 * hold the option lists and labels, build the mutation variables after
 * the local checks (a reason is required, the cancel note is at most 500
 * characters) and say which field a server refusal belongs to. The
 * server repeats every rule.
 */

import {
  invoiceVoidReasonEnum,
  subscriptionCancelReasonEnum,
  type InvoiceVoidReason,
  type SubscriptionCancelReason,
} from "../types/platform-api";
import { errorReasonOf } from "./apollo-client";
import { humaniseConstant } from "./store-profile.util";

// ─── Constants ────────────────────────────────────────────────────────────

export const CANCEL_NOTE_MAX_LENGTH = 500;

export const CANCEL_REASON_OPTIONS: ReadonlyArray<{
  key: SubscriptionCancelReason;
  label: string;
}> = [
  { key: subscriptionCancelReasonEnum.PRICE, label: "Price" },
  { key: subscriptionCancelReasonEnum.CLOSED_BUSINESS, label: "Closed the business" },
  { key: subscriptionCancelReasonEnum.MOVED_PLATFORM, label: "Moved to another platform" },
  { key: subscriptionCancelReasonEnum.UNHAPPY_WITH_SERVICE, label: "Unhappy with the service" },
  { key: subscriptionCancelReasonEnum.OTHER, label: "Other" },
];

export const VOID_REASON_OPTIONS: ReadonlyArray<{
  key: InvoiceVoidReason;
  label: string;
}> = [
  { key: invoiceVoidReasonEnum.WRITTEN_OFF, label: "Written off (bad debt)" },
  { key: invoiceVoidReasonEnum.ISSUED_IN_ERROR, label: "Issued in error" },
  { key: invoiceVoidReasonEnum.SUPERSEDED, label: "Superseded by another invoice" },
  { key: invoiceVoidReasonEnum.OTHER, label: "Other" },
];

export const CANCEL_REASON_REQUIRED_COPY = "Choose a cancellation reason.";

export const VOID_REASON_REQUIRED_COPY = "Choose why the invoice is voided.";

export const CANCEL_NOTE_TOO_LONG_COPY = `Keep the note under ${CANCEL_NOTE_MAX_LENGTH} characters.`;

// ─── Types ────────────────────────────────────────────────────────────────

export interface CancelSubscriptionDraft {
  immediate: boolean;
  /** "" until chosen. */
  reason: string;
  note: string;
}

export interface CancelSubscriptionVariables {
  tenantId: string;
  immediate: boolean;
  reason: SubscriptionCancelReason;
  note: string | null;
}

export interface VoidInvoiceDraft {
  /** "" until chosen. */
  voidReason: string;
  /** The free-text `reason` argument (kept for compatibility, FR-4.4). */
  note: string;
}

export interface VoidInvoiceVariables {
  id: string;
  reason: string;
  voidReason: InvoiceVoidReason;
}

export type ReasonFormField = "reason" | "note";

export type ReasonFormResult<T> =
  | { variables: T; error?: undefined; field?: undefined }
  | { variables?: undefined; error: string; field: ReasonFormField };

// ─── Labels ───────────────────────────────────────────────────────────────

export function cancelReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return CANCEL_REASON_OPTIONS.find((option) => option.key === reason)?.label ?? humaniseConstant(reason);
}

export function voidReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return VOID_REASON_OPTIONS.find((option) => option.key === reason)?.label ?? humaniseConstant(reason);
}

// ─── Variables ────────────────────────────────────────────────────────────

function isCancelReason(value: string): value is SubscriptionCancelReason {
  return (Object.values(subscriptionCancelReasonEnum) as string[]).includes(value);
}

function isVoidReason(value: string): value is InvoiceVoidReason {
  return (Object.values(invoiceVoidReasonEnum) as string[]).includes(value);
}

/** FR-4.2: the reason is required; the note is optional and at most 500 characters. */
export function cancelSubscriptionVariables(
  tenantId: string,
  draft: CancelSubscriptionDraft,
): ReasonFormResult<CancelSubscriptionVariables> {
  if (!isCancelReason(draft.reason)) {
    return { error: CANCEL_REASON_REQUIRED_COPY, field: "reason" };
  }
  const note = draft.note.trim();
  if (note.length > CANCEL_NOTE_MAX_LENGTH) {
    return { error: CANCEL_NOTE_TOO_LONG_COPY, field: "note" };
  }
  return {
    variables: { tenantId, immediate: draft.immediate, reason: draft.reason, note: note || null },
  };
}

/** FR-4.4: the enum is required; the free-text note stays the `reason` argument. */
export function voidInvoiceVariables(
  id: string,
  draft: VoidInvoiceDraft,
): ReasonFormResult<VoidInvoiceVariables> {
  if (!isVoidReason(draft.voidReason)) {
    return { error: VOID_REASON_REQUIRED_COPY, field: "reason" };
  }
  return { variables: { id, reason: draft.note.trim(), voidReason: draft.voidReason } };
}

// ─── Server errors ────────────────────────────────────────────────────────

/**
 * Which dialog field a server `BAD_USER_INPUT` belongs to:
 * `INVALID_CANCEL_REASON` (or `field: reason`) → the select, `field: note` →
 * the note; null for anything else (the caller toasts it).
 */
export function reasonFormFieldOf(error: unknown): ReasonFormField | null {
  const first = (error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> })
    ?.graphQLErrors?.[0];
  if (String(first?.extensions?.code ?? "") !== "BAD_USER_INPUT") return null;
  const reason = errorReasonOf(error);
  const field = String(first?.extensions?.field ?? "");
  if (reason === "INVALID_CANCEL_REASON" || field === "reason" || field === "voidReason") {
    return "reason";
  }
  if (field === "note") return "note";
  return null;
}
