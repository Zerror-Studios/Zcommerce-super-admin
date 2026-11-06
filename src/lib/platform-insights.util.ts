/**
 * Super Admin AI console rules (backend PRD-026, guide §1, §4, §5, §7, §12)
 *
 * Pure helpers shared by Home, the snapshot tabs, the Stores filters and
 * the staff chat:
 * - a metric's value in its unit (₹ with Indian grouping, $ for AI cost,
 *   a PERCENT value already ×100), its change and its three statuses (OK,
 *   SMALL_SAMPLE with count and names, UNAVAILABLE with reason and fix);
 * - "Last updated" in IST, stale after 26 hours (the server says so), the
 *   first-run copy, coverage ("Based on 12 of 15 stores");
 * - the labels for periods, lifecycle statuses, risk and churn reasons;
 * - Refresh now's cooldown and error copy, and the chat's error copy.
 *
 * The console never computes a business number: never a percentage from
 * `count` (guide §4).
 */

import { formatCount, formatDelta, formatMoney, formatPercent } from "../components/ui/money";
import type {
  PlatformMetric,
  PlatformMetricsPeriod,
  PlatformStoreAgeBand,
  PlatformStoreLifecycleStatus,
} from "../types/platform-insights";

// ─── Constants ────────────────────────────────────────────────────────────

const IST_TIME_ZONE = "Asia/Kolkata";
const EMPTY = "—";

/** Guide §1: before the first snapshot. */
export const FIRST_SNAPSHOT_COPY = "The first snapshot runs at 08:30 IST";

/** Guide §3 block 5: before the first daily summary. */
export const FIRST_SUMMARY_COPY = "The first summary arrives tomorrow morning";

/** Guide §4: the tabs open on this period. */
export const DEFAULT_METRICS_PERIOD: PlatformMetricsPeriod = "MTD";

/** Guide §12: the chat's run is polled about once a second. */
export const ASK_POLL_MS = 1000;

/** Guide §12: 1–1000 characters per question. */
export const ASK_MAX_LENGTH = 1000;

/** Guide §12: questions to suggest in the empty chat. */
export const ASK_SUGGESTIONS: readonly string[] = [
  "Who hasn't paid this month?",
  "Which stores are at risk and what should we do?",
  "How did MRR move this month?",
  "Which stores are still on Nimbbl?",
  "How much are we spending on AI?",
];

// ─── Labels (guide §4, §7) ────────────────────────────────────────────────

export const PERIOD_LABELS: Record<PlatformMetricsPeriod, string> = {
  TODAY: "Today",
  LAST_7D: "Last 7 days",
  LAST_30D: "Last 30 days",
  MTD: "This month",
  LAST_MONTH: "Last month",
  LAST_12M: "Last 12 months",
  ALL_TIME: "All time",
};

export const PERIOD_ORDER: readonly PlatformMetricsPeriod[] = [
  "TODAY",
  "LAST_7D",
  "LAST_30D",
  "MTD",
  "LAST_MONTH",
  "LAST_12M",
  "ALL_TIME",
];

export const LIFECYCLE_LABELS: Record<PlatformStoreLifecycleStatus, string> = {
  DEVELOPMENT: "In development",
  LIVE: "Live",
  GRACE: "In grace",
  SUSPENDED: "Suspended",
  CHURNED: "Churned",
  DELETED: "Deleted",
};

/** Tone per lifecycle status, for `StatusChip` / `Badge`. */
export const LIFECYCLE_TONES: Record<
  PlatformStoreLifecycleStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  DEVELOPMENT: "info",
  LIVE: "success",
  GRACE: "warning",
  SUSPENDED: "danger",
  CHURNED: "neutral",
  DELETED: "neutral",
};

export const AGE_BAND_LABELS: Record<PlatformStoreAgeBand, string> = {
  UNDER_3M: "Under 3 months",
  M3_TO_6: "3–6 months",
  M6_TO_12: "6–12 months",
  M12_TO_24: "1–2 years",
  OVER_24M: "Over 2 years",
};

export const RISK_REASON_LABELS: Record<string, string> = {
  OVERDUE_PAST_GRACE: "Overdue past grace",
  NO_ORDERS: "No orders in 14 days",
  NO_LOGIN: "No login in 14 days",
  CHECKOUT_OR_PAYMENT_FAILURES: "Checkout or payment failures",
  GMV_DROP: "Sales down sharply",
  ORDERS_PAUSED: "Orders paused",
  EVENT_BACKLOG: "Stuck events",
};

export const CHURN_REASON_LABELS: Record<string, string> = {
  PRICE: "Price",
  CLOSED_BUSINESS: "Closed the business",
  MOVED_PLATFORM: "Moved to another platform",
  UNHAPPY_WITH_SERVICE: "Unhappy with the service",
  OTHER: "Other",
};

/** A lifecycle status in either case (snapshot lists send lower case). */
export function lifecycleLabel(status: string | null | undefined): string {
  const key = String(status ?? "").toUpperCase() as PlatformStoreLifecycleStatus;
  return LIFECYCLE_LABELS[key] ?? (status ? String(status) : EMPTY);
}

export function lifecycleTone(
  status: string | null | undefined,
): "neutral" | "success" | "warning" | "danger" | "info" {
  const key = String(status ?? "").toUpperCase() as PlatformStoreLifecycleStatus;
  return LIFECYCLE_TONES[key] ?? "neutral";
}

export function riskReasonLabel(reason: string): string {
  return RISK_REASON_LABELS[reason] ?? reason;
}

export function churnReasonLabel(reason: string): string {
  return CHURN_REASON_LABELS[reason] ?? reason;
}

// ─── Metric values (guide §1) ─────────────────────────────────────────────

/** A number in a metric's unit; "—" when there is none. */
export function formatMetricValue(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  switch (unit) {
    case "CURRENCY":
      return formatMoney(value, { whole: true });
    case "USD":
      return formatMoney(value, { currency: "USD", paise: Math.abs(value) < 100 });
    case "PERCENT":
      return formatPercent(value);
    case "DAYS":
      return `${formatCount(value)} ${Math.round(value) === 1 ? "day" : "days"}`;
    case "MONTHS":
      return `${formatCount(value)} ${Math.round(value) === 1 ? "month" : "months"}`;
    case "RATIO":
      return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
    default:
      return formatCount(value);
  }
}

/** "+12%" against the previous period; "—" when there is no change to show. */
export function formatMetricChange(metric: Pick<PlatformMetric, "changePercent">): string {
  return formatDelta(metric.changePercent);
}

/** Up is good for most metrics; these read better when they go down. */
const LOWER_IS_BETTER = new Set([
  "outstanding",
  "overdue",
  "inGrace",
  "churned",
  "churnRate",
  "revenueLostToChurn",
  "writtenOff",
  "checkoutFailures7d",
  "paymentFailures7d",
  "eventBacklog",
  "webhookIssues7d",
  "analyticsSyncFailing",
  "dormantStores",
  "atRisk",
  "aiCostUsd",
  "costPerQuestion",
  "storesAtLimit",
  "storesOnNimbbl",
]);

/** The tone of a change: positive, negative or neutral for this metric. */
export function changeTone(
  metric: Pick<PlatformMetric, "key" | "changePercent">,
): "success" | "danger" | "neutral" {
  const change = metric.changePercent;
  if (change == null || !Number.isFinite(change) || change === 0) return "neutral";
  const better = LOWER_IS_BETTER.has(metric.key) ? change < 0 : change > 0;
  return better ? "success" : "danger";
}

/**
 * Guide §1 SMALL_SAMPLE: "2 stores churned: Nahara, Kesar & Kin". The
 * count with the metric's label, and the names when there are any.
 */
export function smallSampleText(
  metric: Pick<PlatformMetric, "count" | "names" | "label">,
): string {
  const count = metric.count ?? 0;
  const names = (metric.names ?? []).filter(Boolean);
  const head = `${formatCount(count)} ${count === 1 ? "store" : "stores"}`;
  return names.length ? `${head}: ${names.join(", ")}` : head;
}

/** Guide §1: "Rates are shown from 20 stores" (the server's reason first). */
export function smallSampleNote(
  metric: Pick<PlatformMetric, "reason">,
  threshold: number | null | undefined,
): string {
  if (metric.reason) return metric.reason;
  return threshold ? `Rates are shown from ${threshold} stores` : "Too few stores for a rate";
}

/** Guide §1 coverage: "Based on 12 of 15 stores"; null without coverage. */
export function coverageText(
  coverage: { covered: number; total: number } | null | undefined,
): string | null {
  if (!coverage || coverage.total <= 0) return null;
  return `Based on ${formatCount(coverage.covered)} of ${formatCount(coverage.total)} stores`;
}

/** The tooltip under a metric: its definition and formula. */
export function metricHelp(metric: Pick<PlatformMetric, "definition" | "formula">): string {
  return [metric.definition, metric.formula ? `Formula: ${metric.formula}` : ""]
    .filter(Boolean)
    .join("\n");
}

/** A metric of the snapshot by key, across sections. */
export function findMetric(
  sections: { key: string; metrics: PlatformMetric[] }[] | null | undefined,
  key: string,
): PlatformMetric | null {
  for (const section of sections ?? []) {
    const found = section.metrics.find((metric) => metric.key === key);
    if (found) return found;
  }
  return null;
}

/** The metrics of one section, in the server's order; [] when absent. */
export function sectionMetrics(
  sections: { key: string; metrics: PlatformMetric[] }[] | null | undefined,
  key: string,
): PlatformMetric[] {
  return sections?.find((section) => section.key === key)?.metrics ?? [];
}

/** Guide §2: a tab shows only when its section came back (permissions). */
export function hasSection(
  sections: { key: string }[] | null | undefined,
  key: string,
): boolean {
  return (sections ?? []).some((section) => section.key === key);
}

// ─── Time (guide §1, §5) ──────────────────────────────────────────────────

const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const istDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Round 2 G13: upper-case AM/PM everywhere (en-IN writes "am"). */
const upperMeridiem = (text: string) => text.replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());

/** "2 Nov, 8:31 AM" in IST; "—" when missing. */
export function formatIst(value: string | Date | null | undefined): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : upperMeridiem(istDateTime.format(date));
}

/** "3:42 PM" in IST (Refresh now's "Available at …"). */
export function formatIstTime(value: string | Date | null | undefined): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : upperMeridiem(istTime.format(date));
}

/** Today's date in IST, `YYYY-MM-DD` (the summary's `date` is one). */
export function istToday(now: Date = new Date()): string {
  return istDay.format(now);
}

/** Whole hours since `computedAt`; null when unknown. */
export function hoursSince(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!value) return null;
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now.getTime() - at) / 3_600_000));
}

/**
 * The header line: "Last updated 2 Nov, 8:31 am", or "Last updated 30 h
 * ago" when the server says the snapshot is stale (shown in amber).
 */
export function lastUpdatedText(
  computedAt: string | null | undefined,
  stale: boolean,
  now: Date = new Date(),
): string {
  if (!computedAt) return FIRST_SNAPSHOT_COPY;
  if (stale) {
    const hours = hoursSince(computedAt, now);
    return hours == null ? "Last updated a while ago" : `Last updated ${hours} h ago`;
  }
  return `Last updated ${formatIst(computedAt)}`;
}

/** True while Refresh now is cooling down. */
export function isRefreshCoolingDown(
  refreshAvailableAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!refreshAvailableAt) return false;
  const at = new Date(refreshAvailableAt).getTime();
  return Number.isFinite(at) && at > now.getTime();
}

/** Guide §3 block 1: "3 days overdue" or "Due on 5 Nov". */
export function moneyDueWhen(row: { daysOverdue: number; dueAt: string }): string {
  if (row.daysOverdue > 0) {
    return `${row.daysOverdue} ${row.daysOverdue === 1 ? "day" : "days"} overdue`;
  }
  const date = new Date(row.dueAt);
  if (Number.isNaN(date.getTime())) return "Due soon";
  return `Due on ${new Intl.DateTimeFormat("en-IN", { timeZone: IST_TIME_ZONE, day: "numeric", month: "short" }).format(date)}`;
}

// ─── Errors (guide §5, §9, §12) ───────────────────────────────────────────

interface GraphQlErrorLike {
  graphQLErrors?: readonly { extensions?: Record<string, unknown> }[];
  extensions?: Record<string, unknown>;
  networkError?: unknown;
}

/** The first error's `extensions` (code, reason and the rest). */
export function errorExtensions(error: unknown): Record<string, unknown> {
  const e = error as GraphQlErrorLike | null;
  return (e?.graphQLErrors?.[0]?.extensions ?? e?.extensions ?? {}) as Record<string, unknown>;
}

/**
 * Refresh now's outcome: a cooldown carries `refreshAvailableAt`; a
 * failed refresh doesn't use the cooldown up.
 */
export function refreshErrorState(error: unknown): {
  message: string;
  refreshAvailableAt: string | null;
} {
  const ext = errorExtensions(error);
  if (ext.reason === "REFRESH_COOLDOWN") {
    const at = typeof ext.refreshAvailableAt === "string" ? ext.refreshAvailableAt : null;
    return {
      message: at ? `Refreshed recently. Available at ${formatIstTime(at)}` : "Refreshed recently. Try again later",
      refreshAvailableAt: at,
    };
  }
  if (ext.reason === "REFRESH_FAILED") {
    return { message: "Couldn't refresh, try again in a minute", refreshAvailableAt: null };
  }
  if (ext.code === "FORBIDDEN") {
    return { message: "You can't refresh the numbers", refreshAvailableAt: null };
  }
  return { message: "Couldn't refresh, try again shortly", refreshAvailableAt: null };
}

const ASK_ERROR_COPY: Record<string, string> = {
  QUESTION_EMPTY: "Type a question first",
  QUESTION_TOO_LONG: `Questions can be up to ${ASK_MAX_LENGTH} characters`,
  RUN_IN_PROGRESS: "Still answering the last question",
  DUPLICATE_QUESTION: "That question was already sent; reloading the conversation",
  CONVERSATION_FULL: "This conversation is full. Start a new conversation",
  AI_UNAVAILABLE: "Ask Zcom is unavailable right now. Try again later",
  AI_RESTING: "Ask Zcom is resting until tomorrow (daily spend cap)",
  AI_DISABLED: "Ask Zcom is switched off",
  RATE_LIMITED: "Too many questions at once. Try again in a moment",
  AI_TOKEN_BUDGET_EXHAUSTED: "This month's internal AI budget is used up",
  MFA_REQUIRED: "Turn on two-step sign-in to use Ask Zcom",
};

/** A refused question's copy, by `extensions.reason` (guide §12). */
export function askErrorMessage(error: unknown): string {
  const ext = errorExtensions(error);
  const reason = typeof ext.reason === "string" ? ext.reason : "";
  if (ASK_ERROR_COPY[reason]) return ASK_ERROR_COPY[reason];
  if (ext.code === "MFA_REQUIRED") return ASK_ERROR_COPY.MFA_REQUIRED;
  if (ext.code === "FORBIDDEN") return "You don't have access to Ask Zcom";
  if ((error as GraphQlErrorLike | null)?.networkError) {
    return "Couldn't reach the server. Check your connection and retry";
  }
  return "Ask Zcom couldn't answer, try again";
}

/** Guide §12: a finished run's note under the answer; null when none. */
export function runStatusNote(
  status: string,
  errorReason?: string | null,
): string | null {
  if (status === "COMPLETED_PARTIAL") {
    return errorReason === "TIME_LIMIT"
      ? "This answer was cut short. Try a narrower question"
      : "This answer was cut short";
  }
  if (status === "CANCELLED") return "Stopped";
  if (status === "FAILED") {
    // The console stopped waiting (2 minutes, or 3 failed polls in a row)
    if (errorReason === "POLL_TIMEOUT" || errorReason === "POLL_UNREACHABLE") {
      return "Couldn't reach Ask Zcom, try again";
    }
    return errorReason === "RUN_INTERRUPTED"
      ? "Something interrupted the answer, try again"
      : "Ask Zcom couldn't answer, try again";
  }
  return null;
}

/** Guide §12 usage bar copy, or the reason the chat can't answer. */
export function assistantUsageText(usage: {
  available: boolean;
  reason: string | null;
  budgetUsedPercent: number;
  monthlyTokenBudget: number;
  monthResetsAt: string;
}): string {
  if (!usage.available) {
    switch (usage.reason) {
      case "AI_TOKEN_BUDGET_EXHAUSTED":
        return "This month's internal AI budget is used up (raise it in AI settings)";
      case "AI_RESTING":
        return "Resting until tomorrow (platform daily spend cap)";
      case "AI_DISABLED":
        return "AI is switched off";
      default:
        return "Ask Zcom is unavailable: no API key, or the provider is failing";
    }
  }
  const budget = formatCount(usage.monthlyTokenBudget, true).replace(/k$/, "K");
  const resets = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST_TIME_ZONE }).format(
    new Date(usage.monthResetsAt),
  );
  return `AI budget: ${usage.budgetUsedPercent}% of this month's ${budget} tokens used · resets ${resets}`;
}
