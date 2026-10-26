/**
 * Store billing, plan change, review queue and dunning rules for the
 * console (PRD-016 FR-6, FR-14..FR-21, FR-26; PRD-017 FR-4.2, FR-4.3)
 *
 * Every amount here is the server's: these helpers only label it, pick
 * which rows an action applies to, and check what a form sends. Money is
 * never computed in the browser (root CLAUDE.md §4).
 */

import type {
  EntitlementsMode,
  FlaggedPaymentAction,
  PlanChangeEffective,
  PlatformDunningSettings,
  PlatformInvoice,
  PlatformPayment,
  PlatformPlan,
  PlatformPlanChangePreview,
} from "../types/platform-api";
import { isPlanSellable } from "./plan-catalog.util";

// ─── Constants ────────────────────────────────────────────────────────────

/** Upper bound of a dunning timing (the server's `MAX_DAYS`). */
export const MAX_DUNNING_DAYS = 365;

/**
 * PRD-016 D6/D7: `dunning.enabled` may be switched on only after a lawyer
 * confirms the payment-overdue timeline and the merchant terms publish it
 * (and PRD-017 FR-3.8, PRD-014 FR-2.4 and PRD-018 FR-1.5 are live, D9).
 * The console never switches it on; it can only switch it off.
 */
export const DUNNING_SWITCH_ON_GATED = true;

export const DUNNING_GATE_COPY =
  "Switch-on gated: the legal timeline must be confirmed (PRD-016 D6/D7). " +
  "Dunning stays off until a lawyer confirms the overdue timeline, the " +
  "merchant terms publish it, and stores can pay every invoice in the " +
  "dashboard. The timings below can be prepared now.";

export const ENTITLEMENTS_MODE_COPY: Record<
  EntitlementsMode,
  { label: string; description: string }
> = {
  OFF: {
    label: "Off",
    description: "Plan limits are not checked at all.",
  },
  LOG: {
    label: "Log only",
    description:
      "Limits are checked and counted, but nothing is blocked. Use this to " +
      "see who would be blocked before enforcing.",
  },
  ENFORCE: {
    label: "Enforce",
    description:
      "Stores can't add products, staff or campaigns past their plan's " +
      "limits, and sales channels need a plan that includes them.",
  },
};

export const BILLING_REASON_LABELS: Record<
  PlatformInvoice["billingReason"],
  string
> = {
  PERIOD: "Plan period",
  PRORATION: "Proration",
};

export const CREDIT_REASON_LABELS: Readonly<Record<string, string>> = {
  PRORATION: "Plan change",
  OVERPAYMENT: "Overpayment",
  MANUAL: "Issued by Zerror",
};

/** Why a payment is in the review queue (PRD-016 FR-19, FR-27). */
export const FLAGGED_REASON_LABELS: Readonly<Record<string, string>> = {
  AMOUNT_MISMATCH: "Amount doesn't match the invoice",
  SUBSCRIPTION_NOT_PAYABLE: "Paid while the subscription was stopped",
  INVOICE_NOT_OPEN: "Paid an invoice that was already closed",
};

export const RESOLUTION_LABELS: Readonly<Record<string, string>> = {
  APPLIED: "Applied to an invoice",
  REFUNDED_OUTSIDE: "Refunded outside the platform",
  DISMISSED: "Dismissed",
};

export const FLAGGED_ACTION_COPY: Record<
  FlaggedPaymentAction,
  { label: string; description: string; confirm: string }
> = {
  APPLY: {
    label: "Apply to an invoice",
    description:
      "Settles the chosen open invoice with this payment. Enough pays it; " +
      "more becomes credit for the store; less leaves it partly paid.",
    confirm: "Apply payment",
  },
  REFUNDED_OUTSIDE: {
    label: "Refunded outside",
    description:
      "You returned the money outside the platform. The payment is closed " +
      "and no invoice changes.",
    confirm: "Mark refunded",
  },
  DISMISS: {
    label: "Dismiss",
    description:
      "Close the flag without applying or refunding (for example a test " +
      "payment). No invoice changes.",
    confirm: "Dismiss",
  },
};

/** Console copy for the PRD-016 reasons a store-billing screen can get. */
export const BILLING_REASON_COPY: Readonly<Record<string, string>> = {
  OPEN_INVOICE:
    "This store has an open invoice. It has to be paid before the plan can " +
    "change now; schedule the change for the end of the period instead.",
  DOWNGRADE_AT_PERIOD_END:
    "A cheaper plan starts at the end of the current period. To move now, " +
    "use the override: the store gets credit for the difference.",
  CYCLE_CHANGE_AT_PERIOD_END:
    "A yearly plan moves to monthly at the end of its period.",
  INVALID_EFFECTIVE: "Pick when the change takes effect.",
  NOTE_REQUIRED: "Give a reason; it goes to the audit log.",
  PAYMENT_ALREADY_RESOLVED:
    "Someone has already resolved this payment. The list has been reloaded.",
  INVOICE_NOT_OPEN:
    "That invoice is no longer open. Pick another open invoice.",
  REFUND_EXCEEDS_PAYMENT: "A refund can't be more than the payment.",
  INVALID_CREDIT_AMOUNT: "Enter a credit above 0.",
  PAYMENT_REQUIRED:
    "This needs a payment first: nothing reactivates while an invoice is " +
    "unpaid. Record the payment, or reactivate with an override and a " +
    "reason.",
  PLAN_NOT_SELLABLE: "That plan can't be assigned: it isn't active.",
  PLAN_OTHER_TENANT: "That custom plan belongs to another store.",
};

// ─── Invoices ─────────────────────────────────────────────────────────────

export interface InvoiceStatusView {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
}

/** "Plan period", "Proration", or "Restart" for a stopped store's new period (FR-27). */
export function invoiceReasonLabel(
  invoice: Pick<PlatformInvoice, "restart" | "billingReason">,
): string {
  if (invoice.restart) return "Restart";
  return BILLING_REASON_LABELS[invoice.billingReason] ?? invoice.billingReason;
}

/** True for an invoice the store still owes on (ISSUED or OVERDUE). */
export function isInvoiceOpen(
  invoice: Pick<PlatformInvoice, "status">,
): boolean {
  return invoice.status === "ISSUED" || invoice.status === "OVERDUE";
}

/**
 * The invoice's status chip. `PARTIALLY_PAID` is not a server status: an
 * open invoice with `amountPaid > 0` shows it (PRD-016 §5.2 as built).
 */
export function invoiceStatusView(
  invoice: Pick<PlatformInvoice, "status" | "amountPaid">,
): InvoiceStatusView {
  if (isInvoiceOpen(invoice) && (invoice.amountPaid ?? 0) > 0) {
    return { label: "Partially paid", tone: "warning" };
  }
  switch (invoice.status) {
    case "PAID":
      return { label: "Paid", tone: "success" };
    case "OVERDUE":
      return { label: "Overdue", tone: "danger" };
    case "ISSUED":
      return { label: "Due", tone: "info" };
    case "REFUNDED":
      return { label: "Refunded", tone: "neutral" };
    case "VOID":
      return { label: "Void", tone: "neutral" };
    default:
      return { label: String(invoice.status), tone: "neutral" };
  }
}

/**
 * The row the existing invoice actions take (record payment, discount,
 * void). `amount` is what the server says is still owed, the default for
 * Record payment.
 */
export function toInvoiceActionRow(invoice: PlatformInvoice): {
  id: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "failed" | "refunded";
  transactionId: string;
} {
  const status =
    invoice.status === "OVERDUE"
      ? "overdue"
      : invoice.status === "ISSUED"
        ? "pending"
        : invoice.status === "PAID"
          ? "paid"
          : invoice.status === "REFUNDED"
            ? "refunded"
            : "failed";
  return {
    id: invoice.id,
    amount: invoice.amountDue,
    status,
    transactionId: invoice.number,
  };
}

/** Open invoices of one store, oldest due first: what APPLY can settle. */
export function openInvoicesForApply(
  invoices: readonly PlatformInvoice[],
  tenantId: string,
): PlatformInvoice[] {
  return invoices
    .filter((invoice) => invoice.tenantId === tenantId && isInvoiceOpen(invoice))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

// ─── Store billing state ──────────────────────────────────────────────────

export interface BillingStateView {
  label: string;
  tone: "success" | "warning" | "danger";
  detail: string | null;
}

/** The store's billing state chip (PRD-016 FR-15, FR-16). */
export function billingStateView(
  subscription:
    | { billingState?: string; ordersPauseAt?: string; suspendsAt?: string }
    | undefined,
  formatDay: (value: string) => string,
): BillingStateView {
  if (subscription?.billingState === "ORDERS_PAUSED") {
    return {
      label: "Orders paused",
      tone: "danger",
      detail: subscription.suspendsAt
        ? `Suspended on ${formatDay(subscription.suspendsAt)} unless paid.`
        : "Shoppers can't place new orders until the store pays.",
    };
  }
  if (subscription?.ordersPauseAt) {
    return {
      label: "Taking orders",
      tone: "warning",
      detail: `Orders pause on ${formatDay(subscription.ordersPauseAt)} unless paid.`,
    };
  }
  return { label: "Taking orders", tone: "success", detail: null };
}

// ─── Plan change ──────────────────────────────────────────────────────────

/**
 * Plans the console may offer a store (PRD-017 FR-2.1, FR-4.2): ACTIVE
 * plans in scope (global, or this store's custom plans), plus the store's
 * current version even if LEGACY, so its billing cycle can still change
 * (FR-2.2). Never another LEGACY, DRAFT or ARCHIVED plan.
 */
export function planChangeOptions(
  plans: readonly PlatformPlan[],
  tenantId: string,
  currentPlanId?: string,
): PlatformPlan[] {
  return plans.filter((plan) => {
    if (plan.tenantId && plan.tenantId !== tenantId) return false;
    if (plan.id === currentPlanId) return true;
    return isPlanSellable(plan);
  });
}

/**
 * The default timing: a trial changes at once anyway; elsewhere NOW is
 * allowed (PRD-016 FR-2) but the console starts on the period end.
 */
export function defaultEffective(): PlanChangeEffective {
  return "PERIOD_END";
}

export interface PreviewRow {
  key: string;
  label: string;
  amount: number;
}

/** The preview table rows (PRD-016 §6), in the order the dialog shows. */
export function previewRowsOf(preview: PlatformPlanChangePreview): PreviewRow[] {
  return [
    { key: "credit", label: "Credit for unused time", amount: preview.credit },
    { key: "charge", label: "Charge for the new plan", amount: preview.charge },
    { key: "due", label: "Due now", amount: preview.amountDueNow },
    { key: "next", label: "Next invoice", amount: preview.nextInvoiceAmount },
    // Shown only when the change issues credit (forced downgrade, cycle change)
    ...((preview.creditIssued ?? 0) > 0
      ? [{ key: "creditIssued", label: "Credit issued to the store", amount: preview.creditIssued ?? 0 }]
      : []),
  ];
}

/** The preview's over-limit reasons (`SKU_LIMIT`, `STAFF_LIMIT`) as words. */
export function overLimitLabels(overLimits: readonly string[]): string[] {
  const labels: Readonly<Record<string, string>> = {
    SKU_LIMIT: "more products than the new plan allows",
    STAFF_LIMIT: "more staff accounts than the new plan allows",
    MESSAGE_QUOTA: "more messages this month than the new plan allows",
    FEATURE_NOT_IN_PLAN: "a feature the new plan doesn't include",
  };
  return overLimits.map((key) => labels[key] ?? key);
}

/** True for the preview refusal the override answers (FR-3). */
export function isDowngradeRefusal(reason: string | undefined): boolean {
  return reason === "DOWNGRADE_AT_PERIOD_END";
}

export interface PlanChangeVariables {
  tenantId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  effective: PlanChangeEffective;
  override: boolean | null;
  reason: string | null;
}

/** What `changeTenantPlan` sends; the override needs a reason (FR-3). */
export function planChangeVariables(input: {
  tenantId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  effective: PlanChangeEffective;
  override: boolean;
  reason: string;
}): { variables: PlanChangeVariables; error: null } | { variables: null; error: string } {
  const reason = input.reason.trim();
  if (input.override && !reason) {
    return { variables: null, error: BILLING_REASON_COPY.NOTE_REQUIRED };
  }
  return {
    variables: {
      tenantId: input.tenantId,
      planId: input.planId,
      billingCycle: input.billingCycle,
      effective: input.effective,
      override: input.override ? true : null,
      reason: input.override ? reason : null,
    },
    error: null,
  };
}

// ─── Reactivation (PRD-016 FR-18) ─────────────────────────────────────────

export interface ReactivationVariables {
  override: boolean;
  reason: string | null;
}

/**
 * `override` and `reason` for `reactivateTenantSubscription` and
 * `reactivateTenant`: always sent (the backend refuses a bare call except
 * an undo inside a paid period). An override needs a reason.
 */
export function reactivationVariables(
  override: boolean,
  reason: string,
): { variables: ReactivationVariables; error: null } | { variables: null; error: string } {
  const note = reason.trim();
  if (override && !note) {
    return { variables: null, error: BILLING_REASON_COPY.NOTE_REQUIRED };
  }
  return { variables: { override, reason: note || null }, error: null };
}

/**
 * Whether the reactivate dialog starts on the override: a cancelled or
 * suspended subscription can't come back without a payment; a scheduled
 * cancel inside a paid period can be undone without one.
 */
export function reactivationNeedsOverride(status: string | undefined): boolean {
  return status === "CANCELLED" || status === "SUSPENDED";
}

// ─── Review queue (PRD-016 FR-19) ─────────────────────────────────────────

/** The `resolveFlaggedPlatformPayment` variables, or the form error. */
export function resolveFlaggedVariables(input: {
  paymentId: string;
  action: FlaggedPaymentAction;
  invoiceId: string | null;
  note: string;
}):
  | {
      variables: {
        id: string;
        action: FlaggedPaymentAction;
        invoiceId: string | null;
        note: string;
      };
      error: null;
    }
  | { variables: null; error: string } {
  const note = input.note.trim();
  if (!note) return { variables: null, error: BILLING_REASON_COPY.NOTE_REQUIRED };
  return {
    variables: {
      id: input.paymentId,
      action: input.action,
      // Only APPLY names an invoice; without one the flagged invoice is used.
      invoiceId: input.action === "APPLY" ? input.invoiceId : null,
      note,
    },
    error: null,
  };
}

/** True for a payment still waiting in the queue. */
export function isAwaitingReview(
  payment: Pick<PlatformPayment, "flagged" | "resolution">,
): boolean {
  return payment.flagged === true && !payment.resolution;
}

// ─── Credits and refunds (PRD-016 FR-5, FR-21) ────────────────────────────

/** A positive amount in rupees with at most two decimals, or `null`. */
export function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) === amount * 100 ? amount : null;
}

/** The refund form's error, or `null` when it can be sent. */
export function refundFormError(input: {
  amount: string;
  paymentAmount: number;
  reference: string;
  reason: string;
}): string | null {
  const amount = parseAmount(input.amount);
  if (amount === null) return "Enter an amount above 0 (two decimals at most).";
  // A pre-check only; the server answers REFUND_EXCEEDS_PAYMENT too.
  if (amount > input.paymentAmount) return BILLING_REASON_COPY.REFUND_EXCEEDS_PAYMENT;
  if (!input.reference.trim()) return "Enter the bank or UPI reference of the refund.";
  if (!input.reason.trim()) return BILLING_REASON_COPY.NOTE_REQUIRED;
  return null;
}

// ─── Dunning settings (PRD-016 FR-16) ─────────────────────────────────────

export interface DunningDraft {
  enabled: boolean;
  pauseOrdersAfterDays: string;
  suspendAfterDays: string;
  trialSuspendAfterDays: string;
}

export type DunningErrors = Partial<
  Record<Exclude<keyof DunningDraft, "enabled">, string>
>;

export function dunningToDraft(settings: PlatformDunningSettings): DunningDraft {
  return {
    enabled: settings.enabled,
    pauseOrdersAfterDays: String(settings.pauseOrdersAfterDays),
    suspendAfterDays: String(settings.suspendAfterDays),
    trialSuspendAfterDays: String(settings.trialSuspendAfterDays),
  };
}

function parseDays(value: string): number | null {
  if (!value.trim()) return null;
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= MAX_DUNNING_DAYS
    ? days
    : null;
}

/**
 * The dunning patch, or the field errors. `enabled` is sent only to switch
 * dunning off: switching it on is gated (D6/D7) and never sent from here.
 */
export function validateDunningDraft(
  draft: DunningDraft,
  saved: PlatformDunningSettings,
):
  | { patch: Partial<PlatformDunningSettings>; errors: null }
  | { patch: null; errors: DunningErrors } {
  const errors: DunningErrors = {};
  const pause = parseDays(draft.pauseOrdersAfterDays);
  const suspend = parseDays(draft.suspendAfterDays);
  const trial = parseDays(draft.trialSuspendAfterDays);
  const daysError = `Use a whole number from 0 to ${MAX_DUNNING_DAYS}.`;
  if (pause === null) errors.pauseOrdersAfterDays = daysError;
  if (suspend === null) errors.suspendAfterDays = daysError;
  if (trial === null) errors.trialSuspendAfterDays = daysError;
  if (pause !== null && suspend !== null && suspend < pause) {
    errors.suspendAfterDays = "Suspension must come on or after the order pause.";
  }
  if (Object.keys(errors).length > 0) return { patch: null, errors };
  const patch: Partial<PlatformDunningSettings> = {
    pauseOrdersAfterDays: pause!,
    suspendAfterDays: suspend!,
    trialSuspendAfterDays: trial!,
  };
  if (saved.enabled && !draft.enabled) patch.enabled = false;
  return { patch, errors: null };
}

/**
 * Whether the switch may be pressed: only to turn a running dunning off
 * (the gate covers switching it on, PRD-016 D6/D7).
 */
export function canToggleDunning(saved: PlatformDunningSettings): boolean {
  return !DUNNING_SWITCH_ON_GATED || saved.enabled;
}
