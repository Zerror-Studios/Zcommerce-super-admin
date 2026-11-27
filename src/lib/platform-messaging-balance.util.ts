/**
 * Console › Messaging › Balances and Top-up requests (backend PRD-050
 * FR-4.6): types, labels, money display in paise, the grant / correction
 * form, the record-payment and withdraw forms, and the server's reasons.
 * Pure: no React.
 *
 * The checks mirror core `billing/message-balance.ts` and the platform-admin
 * controller (amount 1 paisa to ₹1,00,000, a correction never above the
 * available balance, reasons up to 500 characters, references up to 200),
 * so most mistakes show before a round trip; the server stays the judge.
 */

import { toasts } from "../copy";
import { formatMoney } from "../components/ui/money";
import { errorCodeOf, errorReasonOf } from "./apollo-client";
import { mutationFailureCopy } from "./mutation-errors";
import { rupeesToPaise, type Tone } from "./platform-messaging.util";

// ─── Enums ────────────────────────────────────────────────────────────────

export const messagingTopUpStatusEnum = {
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;

export type MessagingTopUpStatus =
  (typeof messagingTopUpStatusEnum)[keyof typeof messagingTopUpStatusEnum];

export const messagingLedgerKindEnum = {
  TOP_UP: "TOP_UP",
  GRANT: "GRANT",
  ADJUSTMENT: "ADJUSTMENT",
  RESERVE: "RESERVE",
  SETTLE: "SETTLE",
  DEBIT: "DEBIT",
} as const;

export type MessagingLedgerKind =
  (typeof messagingLedgerKindEnum)[keyof typeof messagingLedgerKindEnum];

export const balanceLevelEnum = {
  LOW: "LOW",
  EMPTY: "EMPTY",
} as const;

export type BalanceLevel =
  (typeof balanceLevelEnum)[keyof typeof balanceLevelEnum];

export const adjustDirectionEnum = {
  GRANT: "GRANT",
  CORRECTION: "CORRECTION",
} as const;

export type AdjustDirection =
  (typeof adjustDirectionEnum)[keyof typeof adjustDirectionEnum];

// ─── Constants ────────────────────────────────────────────────────────────

/** core `MESSAGE_TOPUP_MAX_PAISE`: ₹1,00,000 per grant or correction. */
export const BALANCE_ADJUST_MAX_PAISE = 10_000_000;
export const BALANCE_REASON_MAX_CHARS = 500;
export const TOPUP_REFERENCE_MAX_CHARS = 200;

/** Every query that shows a balance or a top-up (refetched after a change). */
export const BALANCE_REFETCH = [
  "PlatformMessagingBalances",
  "PlatformMessagingBalance",
  "PlatformMessagingTopUps",
];

// ─── Types ────────────────────────────────────────────────────────────────

export interface MessagingBalance {
  tenantId: string;
  tenantName: string | null;
  balancePaise: number;
  reservedPaise: number;
  availablePaise: number;
  lastTopUpPaise: number;
  level: string | null;
  updatedAt: string | null;
  /** Backend PRD-050 D22: the store's automatic top-up (read-only here). */
  autoTopUpEnabled?: boolean;
  autoTopUpThresholdPaise?: number | null;
  autoTopUpAmountPaise?: number | null;
}

export interface MessagingLedgerEntry {
  id: string;
  kind: string;
  amountPaise: number;
  reservedDeltaPaise: number;
  balanceAfterPaise: number;
  reason: string | null;
  by: string | null;
  campaignId: string | null;
  automationRunId: string | null;
  topUpId: string | null;
  createdAt: string;
}

export interface MessagingTopUp {
  id: string;
  tenantId: string;
  tenantName: string | null;
  number: string;
  amountPaise: number;
  status: MessagingTopUpStatus;
  provider: string | null;
  reference: string | null;
  requestedBy: string | null;
  /** Backend PRD-050 D22: opened by the store's automatic top-up. */
  auto?: boolean;
  paidAt: string | null;
  paidBy: string | null;
  createdAt: string;
}

/** Backend PRD-050 D22: who asked for a top-up, as the list shows it. */
export function topUpRequesterText(row: Pick<MessagingTopUp, "auto" | "requestedBy">): string | null {
  if (row.auto) return "Automatic (balance under the store's threshold)";
  return row.requestedBy ? `By ${row.requestedBy}` : null;
}

// ─── Labels ───────────────────────────────────────────────────────────────

export const TOPUP_STATUS_LABEL: Readonly<Record<MessagingTopUpStatus, string>> =
  { PENDING: "Waiting for payment", PAID: "Paid", CANCELLED: "Withdrawn" };

export const TOPUP_STATUS_TONE: Readonly<Record<MessagingTopUpStatus, Tone>> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "neutral",
};

export const LEDGER_KIND_LABEL: Readonly<Record<MessagingLedgerKind, string>> =
  {
    TOP_UP: "Top-up",
    GRANT: "Grant",
    ADJUSTMENT: "Correction",
    RESERVE: "Held for a send",
    SETTLE: "Send settled",
    DEBIT: "Charged",
  };

/** A ledger kind's label; an unknown kind reads as itself. */
export function ledgerKindLabel(kind: string): string {
  return LEDGER_KIND_LABEL[kind as MessagingLedgerKind] ?? kind;
}

export interface LevelChip {
  label: string;
  tone: Tone;
}

/** LOW / EMPTY as a chip; null when the balance is fine. */
export function balanceLevelChip(level: string | null): LevelChip | null {
  if (level === balanceLevelEnum.EMPTY) return { label: "Empty", tone: "danger" };
  if (level === balanceLevelEnum.LOW) return { label: "Low", tone: "warning" };
  return null;
}

/** Who moved the money: SYSTEM, a person, or nobody recorded. */
export function ledgerByLabel(by: string | null): string {
  if (!by) return "—";
  if (by === "SYSTEM") return "System";
  return by;
}

// ─── Money ────────────────────────────────────────────────────────────────

/**
 * Integer paise as rupees with two decimals ("₹1,234.50", "₹0.00");
 * `showSign` writes "+" and "−" for ledger movements.
 */
export function formatPaise(
  paise: number | null | undefined,
  { showSign = false }: { showSign?: boolean } = {},
): string {
  const value = Number(paise ?? 0);
  if (!Number.isFinite(value) || value === 0) return "₹0.00";
  return formatMoney(value / 100, { paise: true, showSign });
}

// ─── Grant or correct (adjustMessagingBalance) ───────────────────────────

export interface AdjustDraft {
  direction: AdjustDirection;
  /** Rupees as typed, always positive; the direction gives the sign. */
  amount: string;
  reason: string;
}

export type AdjustErrors = Partial<Record<"amount" | "reason" | "form", string>>;

export function adjustDraftOf(): AdjustDraft {
  return { direction: adjustDirectionEnum.GRANT, amount: "", reason: "" };
}

export interface AdjustCheck {
  errors: AdjustErrors;
  /** The signed whole paise to send, or null while the draft is invalid. */
  amountPaise: number | null;
}

/**
 * Checks the grant / correction form against the store's available balance:
 * an amount above zero with at most two decimals, up to ₹1,00,000; a
 * correction never above what's available; a reason.
 */
export function validateAdjustDraft(
  draft: AdjustDraft,
  availablePaise: number,
): AdjustCheck {
  const errors: AdjustErrors = {};
  const paise = rupeesToPaise(draft.amount);
  if (!draft.amount.trim()) {
    errors.amount = "Enter an amount";
  } else if (paise === null || paise <= 0) {
    errors.amount = "Enter rupees above zero, with at most two decimals";
  } else if (paise > BALANCE_ADJUST_MAX_PAISE) {
    errors.amount = `Keep it to ${formatPaise(BALANCE_ADJUST_MAX_PAISE)} or less`;
  } else if (
    draft.direction === adjustDirectionEnum.CORRECTION &&
    paise > Math.max(0, availablePaise)
  ) {
    errors.amount = `Only ${formatPaise(Math.max(0, availablePaise))} is available to remove`;
  }
  const reason = draft.reason.trim();
  if (!reason) errors.reason = "Say why the balance changes";
  else if (reason.length > BALANCE_REASON_MAX_CHARS) {
    errors.reason = `Keep the reason under ${BALANCE_REASON_MAX_CHARS} characters`;
  }
  const valid = Object.keys(errors).length === 0 && paise !== null;
  return {
    errors,
    amountPaise: valid
      ? draft.direction === adjustDirectionEnum.CORRECTION
        ? -paise
        : paise
      : null,
  };
}

/** The balance after a signed movement, never below zero. */
export function balanceAfter(balancePaise: number, amountPaise: number): number {
  return Math.max(0, balancePaise + amountPaise);
}

// ─── Record payment / withdraw ────────────────────────────────────────────

/** The bank transfer's reference: required, up to 200 characters. */
export function validateTopUpReference(reference: string): string | undefined {
  const value = reference.trim();
  if (!value) return "Enter the bank transfer's reference";
  if (value.length > TOPUP_REFERENCE_MAX_CHARS) {
    return `Keep the reference under ${TOPUP_REFERENCE_MAX_CHARS} characters`;
  }
  return undefined;
}

/** Why a top-up is withdrawn: required, up to 500 characters. */
export function validateWithdrawReason(reason: string): string | undefined {
  const value = reason.trim();
  if (!value) return "Say why the top-up is withdrawn";
  if (value.length > BALANCE_REASON_MAX_CHARS) {
    return `Keep the reason under ${BALANCE_REASON_MAX_CHARS} characters`;
  }
  return undefined;
}

// ─── Lists ────────────────────────────────────────────────────────────────

export type BalanceFilter = "ALL" | "LOW";

export const BALANCE_FILTER_TABS: ReadonlyArray<{
  value: BalanceFilter;
  label: string;
}> = [
  { value: "ALL", label: "All stores" },
  { value: "LOW", label: "Low only" },
];

export function balanceListVariables(
  filter: BalanceFilter,
  limit: number,
  offset: number,
) {
  return { lowOnly: filter === "LOW", limit, offset };
}

export type TopUpStatusTab = MessagingTopUpStatus | "ALL";

export const TOPUP_STATUS_TABS: ReadonlyArray<{
  value: TopUpStatusTab;
  label: string;
}> = [
  { value: "PENDING", label: "Waiting for payment" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Withdrawn" },
  { value: "ALL", label: "All" },
];

export function topUpListVariables(
  status: TopUpStatusTab,
  limit: number,
  offset: number,
  tenantId: string | null = null,
) {
  return { status: status === "ALL" ? null : status, tenantId, limit, offset };
}

// ─── Server errors ────────────────────────────────────────────────────────

/** Console copy for the FR-4.6 `extensions.reason` values. */
export const BALANCE_REASON_COPY: Readonly<Record<string, string>> = {
  TOPUP_NOT_PENDING:
    "This top-up isn't waiting for payment any more. The list is reloaded.",
};

/** Reasons after which the balances and top-ups should be read again. */
const RELOAD_REASONS = new Set(["TOPUP_NOT_PENDING"]);

const FIELD_REASONS = new Set(["INVALID_AMOUNT", "REASON_REQUIRED"]);

/** The server's field names → this form's field names. */
const FIELD_ALIASES: Readonly<Record<string, string>> = {
  amountPaise: "amount",
};

/** The toast text for a failed balance or top-up mutation (null: nothing more). */
export function balanceFailureCopy(error: unknown): string | null {
  const reason = errorReasonOf(error);
  if (reason && BALANCE_REASON_COPY[reason]) return BALANCE_REASON_COPY[reason];
  return mutationFailureCopy(error) ?? null;
}

export function shouldReloadBalanceAfter(error: unknown): boolean {
  return RELOAD_REASONS.has(errorReasonOf(error) ?? "");
}

/**
 * A BAD_USER_INPUT answer as field errors keyed by this form's names
 * (`amount`, `reason`, `reference`), else null.
 */
export function balanceFieldErrorsFromServer(
  error: unknown,
): Record<string, string> | null {
  if (errorCodeOf(error) !== "BAD_USER_INPUT") return null;
  const first = (
    error as {
      graphQLErrors?: Array<{
        message?: string;
        extensions?: Record<string, unknown>;
      }>;
    }
  )?.graphQLErrors?.[0];
  const reason = String(first?.extensions?.reason ?? "");
  if (!FIELD_REASONS.has(reason)) return null;
  const raw = String(first?.extensions?.field ?? "");
  const field = FIELD_ALIASES[raw] ?? raw;
  const message = first?.message || toasts.genericError;
  return field ? { [field]: message } : { form: message };
}
