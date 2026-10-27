/**
 * Settings › Plans form and list rules (PRD-017 FR-1, FR-4.1, FR-7.3)
 *
 * The plan editor holds strings as typed; `validatePlanDraft` turns them
 * into a `createPlan` input, and `toPlanUpdateInput` sends only what
 * changed. Each limit has an explicit "Unlimited" choice, stored as 0
 * (PRD-016 D12). Price, limits and features of a plan any store uses are
 * locked: saving creates the next version (FR-1.4), which
 * `versioningNoticeOf` says before the save. The ZCOM AI settings are not
 * commercial terms: they change in place on the edited version, for every
 * store on it, and never version a plan (PRD-017 D14). The server still
 * decides.
 */

import type { PlanName } from "../types";
import type {
  PlatformPlan,
  PlatformPlanFeatures,
  PlatformPlanInput,
  PlatformPlanLimits,
  PlatformPlanStatus,
  PlatformPlanUpdateInput,
} from "../types/platform-api";
import { PLAN_LABELS, PLAN_NAMES } from "./display-labels.util";

// ─── Constants ────────────────────────────────────────────────────────────

/** A limit of 0 means "no limit" on the server (PRD-016 D12). */
export const UNLIMITED_LIMIT = 0;

/** The AI limits (PRD-021): 0 means none here, never unlimited. */
export type AiLimitKey =
  | "aiQuestionsPerWeek"
  | "aiConnectorCallsPerWeek"
  | "aiMonthlyTokenBudget";

export type CommercialLimitKey = Exclude<keyof PlatformPlanLimits, AiLimitKey>;

const AI_LIMIT_KEYS: readonly AiLimitKey[] = [
  "aiQuestionsPerWeek",
  "aiConnectorCallsPerWeek",
  "aiMonthlyTokenBudget",
];

const AI_FEATURE_KEYS = ["aiEnabled", "aiDailySummary"] as const;

/** `aiConnectorCallsPerWeek` with no weekly cap (core `AI_FAIR_USE`). */
export const AI_FAIR_USE = -1;

export const PLAN_LIMIT_FIELDS: readonly {
  key: CommercialLimitKey;
  label: string;
}[] = [
  // PRD-016 D11: maxSkus counts products, so the UI says "products".
  { key: "maxSkus", label: "Products" },
  { key: "maxStaffAccounts", label: "Staff accounts" },
  { key: "emailsPerMonth", label: "Emails a month" },
  { key: "smsPerMonth", label: "SMS a month" },
  { key: "whatsappPerMonth", label: "WhatsApp messages a month" },
  { key: "internationalMarkets", label: "International markets" },
  { key: "developmentHours", label: "Development hours" },
];

export const PLAN_STATUS_LABELS: Record<PlatformPlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  LEGACY: "Legacy",
  ARCHIVED: "Archived",
};

export const PLAN_STATUS_TONES: Record<
  PlatformPlanStatus,
  "success" | "warning" | "neutral" | "info"
> = {
  DRAFT: "info",
  ACTIVE: "success",
  LEGACY: "warning",
  ARCHIVED: "neutral",
};

/** Feature values the backend plan schema accepts (core `billing/models`). */
export const BLOG_SYSTEM_OPTIONS = [
  { key: "NONE", label: "No blog" },
  { key: "STANDARD", label: "Standard blog" },
  { key: "ADVANCED", label: "Advanced blog" },
] as const;

export const ANALYTICS_OPTIONS = [
  { key: "BASIC", label: "Basic analytics" },
  { key: "STANDARD", label: "Standard analytics" },
  { key: "ADVANCED", label: "Advanced analytics" },
] as const;

export const SUPPORT_OPTIONS = [
  { key: "24_HOURS", label: "Reply within 24 hours" },
  { key: "12_HOURS", label: "Reply within 12 hours" },
  { key: "6_HOURS", label: "Reply within 6 hours" },
  { key: "CUSTOM", label: "Custom support terms" },
] as const;

/** Default notice before a migrated store changes plan (PRD-017 D3). */
export const DEFAULT_MIGRATION_NOTICE_DAYS = 30;

export const MAX_MIGRATION_NOTICE_DAYS = 365;

/** Reason copy for the plan catalog's `CONFLICT` / `BAD_USER_INPUT`. */
export const PLAN_REASON_COPY: Readonly<Record<string, string>> = {
  PLAN_IN_USE:
    "Stores still use this plan. Pick a replacement: they move to it at " +
    "their next renewal.",
  ACTIVE_VERSION_EXISTS:
    "This tier already has an active plan here. Edit that plan (it gets a " +
    "new version) or archive it first.",
  PLAN_NOT_SELLABLE: "That plan can't be assigned: it isn't active.",
  PLAN_OTHER_TENANT: "That custom plan belongs to another store.",
  INVALID_PRICE: "Enter a price of 0 or more for both cycles.",
};

const FORM_ERROR_CODES = new Set(["CONFLICT", "BAD_USER_INPUT"]);

// ─── Types ────────────────────────────────────────────────────────────────

export interface PlanLimitDraft {
  unlimited: boolean;
  value: string;
}

/** The plan's AI allowance as typed (PRD-017 D14). */
export interface PlanAiDraft {
  questionsPerWeek: string;
  monthlyTokenBudget: string;
  connectorFairUse: boolean;
  connectorCallsPerWeek: string;
}

/** What the editor holds (numbers as typed). */
export interface PlanDraft {
  tenantId: string | null;
  name: PlanName;
  displayName: string;
  description: string;
  status: "DRAFT" | "ACTIVE";
  isPublic: boolean;
  sortOrder: string;
  priceMonthly: string;
  priceYearly: string;
  limits: Record<CommercialLimitKey, PlanLimitDraft>;
  features: PlatformPlanFeatures;
  ai: PlanAiDraft;
}

export type PlanFormErrors = Partial<Record<string, string>>;

export interface PlanGroup {
  key: string;
  title: string;
  tenantId: string | null;
  plans: PlatformPlan[];
}

// ─── Draft ────────────────────────────────────────────────────────────────

const DEFAULT_FEATURES: PlatformPlanFeatures = {
  onlineStore: true,
  blogSystem: "NONE",
  lookCreation: false,
  analytics: "BASIC",
  salesChannels: false,
  prioritySupport: "24_HOURS",
  unlimitedWebHosting: true,
  sslCertificate: true,
  aiEnabled: false,
  aiDailySummary: false,
};

function limitDraftOf(value: number | undefined): PlanLimitDraft {
  const unlimited = !value || value <= UNLIMITED_LIMIT;
  return { unlimited, value: unlimited ? "" : String(value) };
}

function limitDraftsOf(
  limits: Partial<PlatformPlanLimits> = {},
): Record<CommercialLimitKey, PlanLimitDraft> {
  const drafts = {} as Record<CommercialLimitKey, PlanLimitDraft>;
  for (const { key } of PLAN_LIMIT_FIELDS) {
    drafts[key] = limitDraftOf(limits[key]);
  }
  return drafts;
}

/**
 * The plan's features without Apollo's `__typename`, which an input type
 * refuses (the save would fail GraphQL validation).
 */
function featuresOf(features: Partial<PlatformPlanFeatures> = {}): PlatformPlanFeatures {
  const out = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(DEFAULT_FEATURES) as (keyof PlatformPlanFeatures)[]) {
    if (features[key] !== undefined) Object.assign(out, { [key]: features[key] });
  }
  return out;
}

function aiDraftOf(limits: Partial<PlatformPlanLimits> = {}): PlanAiDraft {
  const connector = limits.aiConnectorCallsPerWeek ?? 0;
  return {
    questionsPerWeek: String(limits.aiQuestionsPerWeek ?? 0),
    monthlyTokenBudget: String(limits.aiMonthlyTokenBudget ?? 0),
    connectorFairUse: connector === AI_FAIR_USE,
    connectorCallsPerWeek: connector === AI_FAIR_USE ? "" : String(connector),
  };
}

/** A new plan; `tenantId` makes it a custom plan for one store. */
export function emptyPlanDraft(tenantId: string | null = null): PlanDraft {
  return {
    tenantId,
    name: "STARTER",
    displayName: "",
    description: "",
    status: "DRAFT",
    isPublic: tenantId == null,
    sortOrder: "0",
    priceMonthly: "",
    priceYearly: "",
    limits: limitDraftsOf(),
    features: { ...DEFAULT_FEATURES },
    ai: aiDraftOf(),
  };
}

export function planToDraft(plan: PlatformPlan): PlanDraft {
  return {
    tenantId: plan.tenantId,
    name: plan.name,
    displayName: plan.displayName ?? PLAN_LABELS[plan.name] ?? plan.name,
    description: plan.description ?? "",
    status: plan.status === "DRAFT" ? "DRAFT" : "ACTIVE",
    isPublic: plan.isPublic ?? plan.tenantId == null,
    sortOrder: String(plan.sortOrder ?? 0),
    priceMonthly: String(plan.price.monthly),
    priceYearly: String(plan.price.yearly),
    limits: limitDraftsOf(plan.limits),
    features: featuresOf(plan.features),
    ai: aiDraftOf(plan.limits),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────

/** A whole number of `min` or more, or `null`. */
function parseWhole(value: string, min = 0): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= min ? number : null;
}

function parsePrice(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** The create input, or the field errors that stop it. */
export function validatePlanDraft(
  draft: PlanDraft,
):
  | { input: PlatformPlanInput; errors: null }
  | { input: null; errors: PlanFormErrors } {
  const errors: PlanFormErrors = {};
  const displayName = draft.displayName.trim();
  if (!displayName) errors.displayName = "Enter the name stores see.";
  if (!PLAN_NAMES.includes(draft.name)) errors.name = "Pick a tier.";
  const monthly = parsePrice(draft.priceMonthly);
  const yearly = parsePrice(draft.priceYearly);
  if (monthly === null) errors["price.monthly"] = "Enter 0 or more.";
  if (yearly === null) errors["price.yearly"] = "Enter 0 or more.";
  const sortOrder = draft.sortOrder.trim() ? Number(draft.sortOrder) : 0;
  if (!Number.isInteger(sortOrder)) errors.sortOrder = "Use a whole number.";

  const limits = {} as PlatformPlanLimits;
  for (const { key } of PLAN_LIMIT_FIELDS) {
    const limit = draft.limits[key];
    if (limit.unlimited) {
      limits[key] = UNLIMITED_LIMIT;
      continue;
    }
    const value = Number(limit.value);
    if (!limit.value.trim() || !Number.isInteger(value) || value < 1) {
      errors[`limits.${key}`] = "Enter a whole number above 0, or Unlimited.";
    } else {
      limits[key] = value;
    }
  }

  // PRD-021: 0 = none for the AI limits (not unlimited)
  const questions = parseWhole(draft.ai.questionsPerWeek);
  if (questions === null) errors["limits.aiQuestionsPerWeek"] = "Enter 0 or more (0 = none).";
  else limits.aiQuestionsPerWeek = questions;
  const budget = parseWhole(draft.ai.monthlyTokenBudget);
  if (budget === null) errors["limits.aiMonthlyTokenBudget"] = "Enter 0 or more (0 = none).";
  else limits.aiMonthlyTokenBudget = budget;
  const connector = draft.ai.connectorFairUse
    ? AI_FAIR_USE
    : parseWhole(draft.ai.connectorCallsPerWeek);
  if (connector === null) {
    errors["limits.aiConnectorCallsPerWeek"] = "Enter 0 or more, or Fair use.";
  } else limits.aiConnectorCallsPerWeek = connector;

  if (Object.keys(errors).length > 0) return { input: null, errors };
  const isCustom = draft.tenantId != null;
  return {
    input: {
      tenantId: draft.tenantId,
      name: draft.name,
      displayName,
      description: draft.description.trim() || null,
      status: draft.status,
      // A custom plan is never public (PRD-017 FR-1.3).
      isPublic: isCustom ? false : draft.isPublic,
      sortOrder,
      price: { monthly: monthly!, yearly: yearly! },
      limits,
      features: { ...draft.features },
    },
    errors: null,
  };
}

// ─── Updates and versioning ───────────────────────────────────────────────

function sameRecord<T extends object>(
  a: T,
  b: T,
  skip: readonly string[] = [],
): boolean {
  // `__typename` (from Apollo) isn't a term; comparing it made every save
  // look like a commercial change
  const keys = (Object.keys(a) as (keyof T & string)[]).filter(
    (key) => key !== "__typename" && !skip.includes(key),
  );
  return keys.every((key) => a[key] === b[key]);
}

/**
 * True when price, limits or features differ from the saved plan; the AI
 * settings don't count (D14).
 */
export function commercialTermsChanged(
  plan: PlatformPlan,
  input: PlatformPlanInput,
): boolean {
  return (
    plan.price.monthly !== input.price.monthly ||
    plan.price.yearly !== input.price.yearly ||
    !sameRecord(plan.limits, input.limits, AI_LIMIT_KEYS) ||
    !sameRecord(plan.features, input.features, AI_FEATURE_KEYS)
  );
}

/** The AI settings of `input`, when they differ from the saved plan. */
function aiSettingsPatch(
  plan: PlatformPlan,
  input: PlatformPlanInput,
): Pick<PlatformPlanUpdateInput, "limits" | "features"> | null {
  const changed =
    AI_LIMIT_KEYS.some((key) => (plan.limits[key] ?? 0) !== input.limits[key]) ||
    AI_FEATURE_KEYS.some((key) => (plan.features[key] ?? false) !== input.features[key]);
  if (!changed) return null;
  return {
    limits: Object.fromEntries(AI_LIMIT_KEYS.map((key) => [key, input.limits[key]])),
    features: Object.fromEntries(AI_FEATURE_KEYS.map((key) => [key, input.features[key]])),
  };
}

/** Only the fields that changed (FR-1.4), or `null` when nothing did. */
export function toPlanUpdateInput(
  plan: PlatformPlan,
  input: PlatformPlanInput,
): PlatformPlanUpdateInput | null {
  const patch: PlatformPlanUpdateInput = {};
  if (input.displayName !== (plan.displayName ?? "")) {
    patch.displayName = input.displayName;
  }
  if ((input.description ?? null) !== (plan.description ?? null)) {
    patch.description = input.description ?? "";
  }
  if (plan.tenantId == null && input.isPublic !== (plan.isPublic ?? true)) {
    patch.isPublic = input.isPublic;
  }
  if ((input.sortOrder ?? 0) !== (plan.sortOrder ?? 0)) {
    patch.sortOrder = input.sortOrder;
  }
  // The server moves DRAFT → ACTIVE only.
  if (plan.status === "DRAFT" && input.status === "ACTIVE") {
    patch.status = "ACTIVE";
  }
  if (commercialTermsChanged(plan, input)) {
    patch.price = { ...input.price };
    patch.limits = { ...input.limits };
    patch.features = { ...input.features };
  } else {
    // AI only: just its keys, so the server never versions the plan (D14)
    Object.assign(patch, aiSettingsPatch(plan, input));
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * True when a commercial edit makes a new version: some subscription (any
 * status) has the plan as its plan or its pending plan (FR-1.4).
 */
export function isPlanInUse(plan: PlatformPlan): boolean {
  return (plan.tenantCount ?? 0) > 0 || (plan.pendingCount ?? 0) > 0;
}

/** The inline versioning notice for the editor (PRD-017 §6), or `null`. */
export function versioningNoticeOf(plan: PlatformPlan): string | null {
  if (!isPlanInUse(plan)) return null;
  const version = plan.version ?? 1;
  const stores = plan.subscriberCount ?? plan.tenantCount ?? 0;
  const storeText = `${stores} ${stores === 1 ? "store" : "stores"}`;
  return (
    "Price, limits and features are locked while stores use this plan. " +
    `Saving a change to them creates version ${version + 1}. The ` +
    `${storeText} on version ${version} keep their price until you ` +
    "migrate them."
  );
}

// ─── Lists ────────────────────────────────────────────────────────────────

function tierIndex(name: PlanName): number {
  const index = PLAN_NAMES.indexOf(name);
  return index < 0 ? PLAN_NAMES.length : index;
}

/**
 * Global plans first, then custom plans per store (FR-4.1); inside a group
 * by tier, then newest version first.
 */
export function groupPlans(
  plans: readonly PlatformPlan[],
  storeName: (tenantId: string) => string = (id) => id,
): PlanGroup[] {
  const groups = new Map<string, PlanGroup>();
  for (const plan of plans) {
    const key = plan.tenantId ?? "global";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        tenantId: plan.tenantId,
        title: plan.tenantId
          ? `Custom plans · ${storeName(plan.tenantId)}`
          : "Global plans",
        plans: [],
      });
    }
    groups.get(key)!.plans.push(plan);
  }
  const sorted = [...groups.values()].map((group) => ({
    ...group,
    plans: [...group.plans].sort(
      (a, b) =>
        tierIndex(a.name) - tierIndex(b.name) ||
        (b.version ?? 1) - (a.version ?? 1),
    ),
  }));
  return sorted.sort((a, b) => {
    if (a.tenantId == null) return -1;
    if (b.tenantId == null) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** True for a plan that can be sold or assigned now (ACTIVE). */
export function isPlanSellable(plan: Pick<PlatformPlan, "status" | "isActive">): boolean {
  return plan.status ? plan.status === "ACTIVE" : plan.isActive;
}

/** ACTIVE plans in the same scope as `plan`, for archive and migrate. */
export function replacementOptionsFor(
  plan: PlatformPlan,
  plans: readonly PlatformPlan[],
): PlatformPlan[] {
  return plans.filter(
    (candidate) =>
      candidate.id !== plan.id &&
      isPlanSellable(candidate) &&
      (candidate.tenantId ?? null) === (plan.tenantId ?? null),
  );
}

/** "Premium v3" — the name the dialogs use for one version. */
export function planVersionLabel(plan: PlatformPlan): string {
  const name = plan.displayName || PLAN_LABELS[plan.name] || plan.name;
  return `${name} v${plan.version ?? 1}`;
}

/** A notice-days field: a whole number from 0 to 365, or `null`. */
export function parseNoticeDays(value: string): number | null {
  if (!value.trim()) return null;
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= MAX_MIGRATION_NOTICE_DAYS
    ? days
    : null;
}

// ─── Server errors ────────────────────────────────────────────────────────

/**
 * Form errors for a failed plan write: `CONFLICT` / `BAD_USER_INPUT` on
 * `extensions.field` (or `form`), with the console's copy for a known
 * reason. `null` means "not a form error"; the caller toasts as usual.
 */
export function planErrorsFromServer(error: unknown): PlanFormErrors | null {
  const first = (
    error as {
      graphQLErrors?: Array<{
        message?: string;
        extensions?: Record<string, unknown>;
      }>;
    }
  )?.graphQLErrors?.[0];
  const code = String(first?.extensions?.code ?? "");
  if (!FORM_ERROR_CODES.has(code)) return null;
  const reason = String(first?.extensions?.reason ?? "");
  const message =
    PLAN_REASON_COPY[reason] ?? (first?.message || "Check this value.");
  const field = String(first?.extensions?.field ?? "");
  return { [field || "form"]: message };
}
