/**
 * Store data lifecycle and go-live rules for the console (PRD-018 §6;
 * PRD-017 FR-4.5)
 *
 * Pure helpers behind the store page's Lifecycle and Go live sections and
 * the store details form: suspension categories, the money-in-flight rows
 * (which of them block a delete), the delete and go-live variables with
 * their local checks, the purge countdown, domain and checklist labels,
 * and the console copy for the PRD-018 `extensions.reason` values. The
 * server decides every rule; these only shape what the operator sees and
 * sends.
 */

import type { Tone } from "../components/ui/tones";
import type { Client } from "../types";
import type {
  GoLiveCheck,
  GoLiveCheckState,
  TenantDomainStatus,
  TenantMoneyInFlight,
  TenantSuspendCategory,
  UpdateTenantInput,
} from "../types/platform-api";
import { errorReasonOf } from "./apollo-client";
import { mutationFailureCopy } from "./mutation-errors";

// ─── Constants ────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/** The backend's waivable go-live checks (`WAIVABLE_CHECKS`, FR-4.3). */
export const WAIVABLE_GO_LIVE_CHECKS: readonly string[] = [
  "payment_app",
  "legal_pages",
];

/** The default category of a console suspension (FR-1.1). */
export const DEFAULT_SUSPEND_CATEGORY: TenantSuspendCategory = "POLICY";

/** Shape of a public domain: labels of letters, digits and hyphens, a TLD. */
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

// ─── Suspension categories (FR-1.1, FR-1.5) ───────────────────────────────

export const SUSPEND_CATEGORY_OPTIONS: ReadonlyArray<{
  value: TenantSuspendCategory;
  label: string;
  description: string;
}> = [
  {
    value: "POLICY",
    label: "Policy",
    description:
      "Abuse, fraud or a legal reason. Store staff can't sign in; only a " +
      "Zerror login can settle orders.",
  },
  {
    value: "BILLING",
    label: "Billing",
    description:
      "Unpaid platform invoices. Staff can still fulfil and refund orders " +
      "and pay invoices.",
  },
  {
    value: "OWNER_REQUEST",
    label: "Owner's request",
    description:
      "The owner asked to pause the store. Staff keep the restricted " +
      "dashboard.",
  },
  {
    value: "MAINTENANCE",
    label: "Maintenance",
    description:
      "Planned work, such as a restore. Staff keep the restricted dashboard.",
  },
];

export function suspendCategoryLabel(
  category: TenantSuspendCategory | null | undefined,
): string {
  return (
    SUSPEND_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.label ?? "Not recorded"
  );
}

// ─── Money in flight (FR-1.2, FR-2.1) ─────────────────────────────────────

type MoneyCountKey = Exclude<keyof TenantMoneyInFlight, "partial">;

export interface MoneyInFlightRow {
  key: MoneyCountKey;
  label: string;
  count: number;
  /** The server refuses a delete while this count is above 0 (FR-2.1). */
  blocksDelete: boolean;
}

const MONEY_ROWS: ReadonlyArray<{
  key: MoneyCountKey;
  label: string;
  blocksDelete: boolean;
}> = [
  { key: "pendingPayments", label: "Payments pending (last 48 h)", blocksDelete: true },
  { key: "paidUnfulfilledOrders", label: "Paid orders not yet fulfilled", blocksDelete: true },
  { key: "refundsInProgress", label: "Refunds in progress", blocksDelete: true },
  { key: "needsRefundOrders", label: "Orders waiting for a refund", blocksDelete: true },
  { key: "needsAttentionOrders", label: "Orders needing attention", blocksDelete: false },
  { key: "openReturns", label: "Open return requests", blocksDelete: false },
  { key: "activeHolds", label: "Checkouts holding stock", blocksDelete: false },
  { key: "activeMarketplaceListings", label: "Active marketplace listings", blocksDelete: false },
  { key: "openPlatformInvoices", label: "Open platform invoices", blocksDelete: false },
];

/** Every count as a row, in the order the dialogs show them. */
export function moneyInFlightRows(
  counts: Partial<TenantMoneyInFlight>,
): MoneyInFlightRow[] {
  return MONEY_ROWS.map((row) => ({
    ...row,
    count: Number(counts[row.key] ?? 0) || 0,
  }));
}

/** The rows that stop a delete (count above 0). */
export function deleteBlockers(
  counts: Partial<TenantMoneyInFlight>,
): MoneyInFlightRow[] {
  return moneyInFlightRows(counts).filter(
    (row) => row.blocksDelete && row.count > 0,
  );
}

/** True when nothing is open at all. */
export function isMoneySettled(counts: Partial<TenantMoneyInFlight>): boolean {
  return moneyInFlightRows(counts).every((row) => row.count === 0);
}

/** `extensions.counts` of a `MONEY_IN_FLIGHT` refusal, or `null`. */
export function moneyCountsFromError(
  error: unknown,
): Partial<TenantMoneyInFlight> | null {
  if (errorReasonOf(error) !== "MONEY_IN_FLIGHT") return null;
  const counts = firstExtensions(error)?.counts;
  return counts && typeof counts === "object"
    ? (counts as Partial<TenantMoneyInFlight>)
    : {};
}

// ─── Delete and restore (FR-2.1, FR-2.3) ──────────────────────────────────

export interface DeleteDraft {
  id: string;
  slug: string | undefined;
  confirmSlug: string;
  force: boolean;
  forceReason: string;
}

export interface DeleteVariables {
  id: string;
  confirmSlug: string;
  force: boolean;
  forceReason: string | null;
}

/** The `deleteTenant` variables, or the local error that stops them. */
export function deleteVariables(
  draft: DeleteDraft,
): { variables: DeleteVariables; error: null } | { variables: null; error: string } {
  const confirmSlug = draft.confirmSlug.trim();
  if (draft.slug && confirmSlug !== draft.slug) {
    return { variables: null, error: "Type the slug exactly to confirm." };
  }
  const forceReason = draft.forceReason.trim();
  if (draft.force && !forceReason) {
    return {
      variables: null,
      error: "Give a reason for deleting with money in flight; it goes to the audit log.",
    };
  }
  return {
    variables: {
      id: draft.id,
      confirmSlug,
      force: draft.force,
      forceReason: draft.force ? forceReason : null,
    },
    error: null,
  };
}

export interface PurgeCountdown {
  /** Whole days until `purgeAfter`, 0 on the day itself. */
  daysLeft: number;
  /** `purgeAfter` has passed: restore is refused (`PURGE_STARTED`). */
  expired: boolean;
}

/** Days left in a deleted store's grace period, or `null` without a date. */
export function purgeCountdown(
  purgeAfter: string | null | undefined,
  now: Date = new Date(),
): PurgeCountdown | null {
  if (!purgeAfter) return null;
  const at = new Date(purgeAfter).getTime();
  if (Number.isNaN(at)) return null;
  const remaining = at - now.getTime();
  return {
    daysLeft: Math.max(0, Math.ceil(remaining / MS_PER_DAY)),
    expired: remaining <= 0,
  };
}

// ─── Domains and go-live (FR-4) ───────────────────────────────────────────

export const DOMAIN_STATUS_VIEW: Readonly<
  Record<TenantDomainStatus, { label: string; tone: Tone }>
> = {
  NONE: { label: "Not verified", tone: "neutral" },
  PENDING: { label: "Verification pending", tone: "info" },
  VERIFIED: { label: "Verified", tone: "success" },
  LIVE: { label: "Live", tone: "success" },
  FAILED: { label: "Verification failed", tone: "danger" },
};

export const GO_LIVE_STATE_VIEW: Readonly<
  Record<GoLiveCheckState, { label: string; tone: Tone }>
> = {
  PASS: { label: "Pass", tone: "success" },
  FAIL: { label: "Fail", tone: "danger" },
  UNKNOWN: { label: "Unknown", tone: "warning" },
  WAIVED: { label: "Waived", tone: "neutral" },
};

/**
 * A typed domain as the server will store it: lower case, without a
 * scheme, path, port or trailing dot. `null` when it can't be a domain.
 */
export function normaliseDomain(input: string): string | null {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

/** True when the check may be waived on go-live (payment app, legal pages). */
export function isWaivable(key: string): boolean {
  return WAIVABLE_GO_LIVE_CHECKS.includes(key);
}

/**
 * The required checks that still stop go-live once `waived` is applied:
 * required, not passing, and not waived (only waivable ones count).
 */
export function blockingChecks(
  checks: readonly GoLiveCheck[],
  waived: readonly string[] = [],
): GoLiveCheck[] {
  return checks.filter(
    (check) =>
      check.required &&
      check.state !== "PASS" &&
      check.state !== "WAIVED" &&
      !(isWaivable(check.key) && waived.includes(check.key)),
  );
}

/** The `markTenantLive` variables, or the local error that stops them. */
export function markLiveVariables(
  tenantId: string,
  waived: readonly string[],
  waiveReason: string,
):
  | {
      variables: { tenantId: string; waive: string[] | null; waiveReason: string | null };
      error: null;
    }
  | { variables: null; error: string } {
  const waive = [...new Set(waived)].filter(isWaivable);
  const reason = waiveReason.trim();
  if (waive.length > 0 && !reason) {
    return { variables: null, error: "Give a reason for the waived checks." };
  }
  return {
    variables: {
      tenantId,
      waive: waive.length ? waive : null,
      waiveReason: waive.length ? reason : null,
    },
    error: null,
  };
}

/** `extensions.failing` of a `CHECKLIST_FAILED` refusal (check keys). */
export function failingChecksFromError(error: unknown): string[] {
  if (errorReasonOf(error) !== "CHECKLIST_FAILED") return [];
  const failing = firstExtensions(error)?.failing;
  return Array.isArray(failing) ? failing.map(String) : [];
}

// ─── Error copy ───────────────────────────────────────────────────────────

/** Console copy for the PRD-018 `extensions.reason` values. */
export const LIFECYCLE_REASON_COPY: Readonly<Record<string, string>> = {
  MONEY_IN_FLIGHT:
    "This store still has money in flight. Settle the items below first, " +
    "or, as the platform owner, delete anyway with a reason.",
  OWNER_ONLY: "Only the platform owner can delete a store with money in flight.",
  PURGE_STARTED:
    "The grace period has ended and the purge has started, so this store " +
    "can't be restored.",
  NOTE_REQUIRED: "Give a reason; it goes to the audit log.",
  TENANT_CHANGED:
    "This store changed while you were deleting it, so nothing was " +
    "deleted. Reload the store and try again.",
  DOMAIN_TAKEN: "Another store has already proved control of this domain.",
  INVALID_DOMAIN: "Enter a domain like shop.example.com, without https:// or a path.",
  RESERVED_DOMAIN: "That domain belongs to the platform and can't be used by a store.",
  NO_PENDING_DOMAIN: "Start a domain verification before checking it.",
  CHECKLIST_FAILED: "Some required checks still fail. Fix them or re-run the checklist.",
  NOT_WAIVABLE: "Only the payment app and legal pages checks can be waived.",
  USE_DOMAIN_VERIFICATION:
    "The domain changes only through verification. Use Go live › Verify a domain.",
};

/** The text for a failed lifecycle or go-live call, or `null` (already reported). */
export function lifecycleFailureCopy(error: unknown): string | null {
  const reason = errorReasonOf(error);
  // CP3-02: the delete went through but undoing it failed, so the store is
  // left DELETED; "nothing was deleted" would be false.
  if (
    reason === "TENANT_CHANGED" &&
    firstExtensions(error)?.rollback === "MISSED"
  ) {
    return (
      "Money arrived while this store was being deleted and the delete " +
      "couldn't be undone, so the store is still deleted. Restore it, then " +
      "follow the tenant-purge runbook."
    );
  }
  if (reason && LIFECYCLE_REASON_COPY[reason]) return LIFECYCLE_REASON_COPY[reason];
  return mutationFailureCopy(error);
}

// ─── Store details form (PRD-017 FR-4.5) ──────────────────────────────────

export interface StoreDetailsDraft {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  billingContactEmail: string;
  gstin: string;
  timezone: string;
  currency: string;
}

export type StoreDetailsField = keyof StoreDetailsDraft;

export type StoreDetailsErrors = Partial<Record<StoreDetailsField | "form", string>>;

const STORE_DETAILS_FIELDS: readonly StoreDetailsField[] = [
  "name",
  "ownerName",
  "ownerEmail",
  "ownerPhone",
  "billingContactEmail",
  "gstin",
  "timezone",
  "currency",
];

/** What the form shows for a store ("—" placeholders become empty). */
export function storeDetailsDraftOf(client: Client): StoreDetailsDraft {
  const value = (text: string | undefined) => (text && text !== "—" ? text : "");
  return {
    name: client.storeName,
    ownerName: value(client.ownerName),
    ownerEmail: value(client.ownerEmail),
    ownerPhone: value(client.ownerPhone),
    billingContactEmail: value(client.billingContactEmail),
    gstin: value(client.gstin),
    timezone: value(client.timezone),
    currency: value(client.currency),
  };
}

/** Local checks the server would refuse anyway, shown on the field. */
export function validateStoreDetails(draft: StoreDetailsDraft): StoreDetailsErrors {
  const errors: StoreDetailsErrors = {};
  if (!draft.name.trim()) errors.name = "Enter a store name.";
  if (!draft.ownerEmail.trim().includes("@")) errors.ownerEmail = "Enter a valid email.";
  const billing = draft.billingContactEmail.trim();
  if (billing && !billing.includes("@")) errors.billingContactEmail = "Enter a valid email.";
  if (draft.currency.trim() && !/^[a-z]{3}$/i.test(draft.currency.trim())) {
    errors.currency = "Use a three-letter code, like INR.";
  }
  return errors;
}

/**
 * Only the changed fields, as `UpdateTenantInput`. Cleared optional fields
 * are sent as `null` (the server unsets them); the domain is never sent
 * (FR-4.4: it changes only through verification).
 */
export function storeDetailsPatch(
  before: StoreDetailsDraft,
  after: StoreDetailsDraft,
): UpdateTenantInput {
  const input: UpdateTenantInput = {};
  const changed = (field: StoreDetailsField) =>
    after[field].trim() !== before[field].trim();
  if (changed("name")) input.name = after.name.trim();
  if (changed("ownerName")) input.ownerName = after.ownerName.trim();
  if (changed("ownerEmail")) input.ownerEmail = after.ownerEmail.trim();
  if (changed("ownerPhone")) input.ownerPhone = after.ownerPhone.trim() || null;
  if (changed("billingContactEmail")) {
    input.billingContactEmail = after.billingContactEmail.trim() || null;
  }
  if (changed("gstin")) input.gstin = after.gstin.trim().toUpperCase() || null;
  // The server keeps the old timezone and currency when they are sent empty
  if (changed("timezone") && after.timezone.trim()) input.timezone = after.timezone.trim();
  if (changed("currency") && after.currency.trim()) {
    input.currency = after.currency.trim().toUpperCase();
  }
  return input;
}

/** A `BAD_USER_INPUT` / `CONFLICT` on `extensions.field`, or `null`. */
export function storeDetailsErrorsFromServer(error: unknown): StoreDetailsErrors | null {
  const first = firstError(error);
  const code = String(first?.extensions?.code ?? "");
  if (code !== "BAD_USER_INPUT" && code !== "CONFLICT") return null;
  const field = String(first?.extensions?.field ?? "");
  const message = first?.message || "Check this value.";
  const key = (STORE_DETAILS_FIELDS as readonly string[]).includes(field)
    ? (field as StoreDetailsField)
    : "form";
  return { [key]: message };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

function firstError(error: unknown): GraphQLErrorLike | undefined {
  return (error as { graphQLErrors?: GraphQLErrorLike[] })?.graphQLErrors?.[0];
}

function firstExtensions(error: unknown): Record<string, unknown> | undefined {
  return firstError(error)?.extensions;
}
