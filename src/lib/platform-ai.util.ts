/**
 * ZCOM AI console rules (PRD-021 FR-6, backend guide §9)
 *
 * Pure helpers for the AI screens: money in USD (staff only), the
 * `ai_config` form (what changed, and only that, is sent), the per-store
 * override form (always sent whole: the server treats an omitted field like
 * null, "back to the plan"), top-up checks, server errors mapped to the
 * field they name, the usage CSV file and the data-health reasons. The
 * limits mirror `services/platform-admin/src/services/platform-ai.service.ts`;
 * the server still decides.
 */

import { formatCount, formatMoney, formatPercent } from "../components/ui/money";
import type {
  PlatformAiConfig,
  PlatformAiConfigInput,
  PlatformAiDataHealthRow,
  PlatformAiModelPrice,
  PlatformAiOverrideInput,
  PlatformAiTenantSetting,
  PlatformAiTopUpRequestStatus,
} from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

/** Most questions one top-up may grant (`TOPUP_MAX_QUESTIONS`). */
export const AI_TOPUP_MAX_QUESTIONS = 10_000;

/** Longest note / pause reason the server keeps. */
export const AI_NOTE_MAX_LENGTH = 300;

/** Cost-price coverage a store needs for profitability insights. */
export const AI_COST_COVERAGE_TARGET_PCT = 80;

/** Connector calls value that means "fair use" (no weekly cap). */
export const AI_FAIR_USE = -1;

/** How long a saved change takes to reach every service. */
export const AI_CONFIG_PROPAGATION_COPY =
  "Saved. Every service picks it up within 60 seconds.";

const UTF8_BOM = "﻿";

const HOUR_MINUTE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Server limits per override field (`setOverride`). */
const OVERRIDE_LIMITS: Record<
  keyof PlatformAiOverrideInput,
  { min: number; max: number }
> = {
  questionsPerWeek: { min: 0, max: 100_000 },
  connectorCallsPerWeek: { min: AI_FAIR_USE, max: 1_000_000 },
  monthlyTokenBudget: { min: 0, max: 10_000_000_000 },
};

/** Server limits per numeric config field (`AiConfigPatchSchema`). */
const CONFIG_LIMITS = {
  globalDailySpendCapUsd: { min: 0, max: 100_000, integer: false },
  monthlyBudgetUsd: { min: 0, max: 1_000_000, integer: false },
  usdInrRate: { min: 1, max: 1000, integer: false },
  perQuestionTokenCeiling: { min: 1000, max: 1_000_000, integer: true },
  rateLimitPerMinute: { min: 1, max: 1000, integer: true },
  benchmarkMinStores: { min: 2, max: 1000, integer: true },
} as const;

type NumericConfigField = keyof typeof CONFIG_LIMITS;

const NUMERIC_CONFIG_FIELDS = Object.keys(CONFIG_LIMITS) as NumericConfigField[];

const PRICE_FIELDS = [
  "inputPerMTok",
  "outputPerMTok",
  "cacheWritePerMTok",
  "cacheReadPerMTok",
  "batchDiscount",
] as const;

type PriceField = (typeof PRICE_FIELDS)[number];

// ─── Types ────────────────────────────────────────────────────────────────

/** The config form: text inputs as typed, lists as arrays. */
export interface AiConfigDraft {
  enabled: boolean;
  defaultModel: string;
  reasoningModel: string;
  allowedModels: string[];
  pricing: Record<string, Record<PriceField, string>>;
  globalDailySpendCapUsd: string;
  monthlyBudgetUsd: string;
  /** Whole percentages, comma-separated ("50, 80, 100"). */
  alertThresholds: string;
  usdInrRate: string;
  nightCoolingStart: string;
  nightCoolingEnd: string;
  perQuestionTokenCeiling: string;
  rateLimitPerMinute: string;
  benchmarkMinStores: string;
}

/** Field → message; `form` for an error that names no known field. */
export type FieldErrors = Partial<Record<string, string>>;

export interface AiConfigPatchResult {
  input: PlatformAiConfigInput;
  errors: FieldErrors;
}

/** The override form: empty = the plan's value. */
export interface AiOverrideDraft {
  questionsPerWeek: string;
  connectorCallsPerWeek: string;
  monthlyTokenBudget: string;
  /** "Fair use" ticked: connector calls -1. */
  connectorFairUse: boolean;
}

export interface AiOverrideResult {
  input: PlatformAiOverrideInput | null;
  errors: FieldErrors;
}

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

// ─── Formatting ───────────────────────────────────────────────────────────

/** "$12.50"; amounts under a dollar keep four decimals ("$0.0042"). */
export function formatUsd(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  if (safe !== 0 && Math.abs(safe) < 1) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(safe);
  }
  return formatMoney(safe, { currency: "USD", paise: true });
}

/** "₹1,234" for the INR equivalents (whole rupees). */
export function formatInr(amount: number | null | undefined): string {
  return formatMoney(amount, { whole: true });
}

/**
 * A US-dollar AI cost with its rupee value (04 S-00b): "$0.093 (₹8)". Under a rupee the paise show
 * ("$0.0038 (₹0.32)"); without a rate (`inr` null) only the dollars.
 */
export function formatUsdInr(usd: number | null | undefined, inr: number | null | undefined): string {
  const dollars = formatUsd(usd);
  if (inr == null || !Number.isFinite(inr)) return dollars;
  const rupees = inr > 0 && inr < 1 ? formatMoney(inr, { paise: true }) : formatInr(inr);
  return `${dollars} (${rupees})`;
}

/**
 * Rupees per dollar for the AI screens: the rate in Settings › ZCOM AI settings, else the one implied by this
 * month's spend; null when neither is known.
 */
export function aiInrRate(configRate: number | null | undefined, spendUsd?: number | null, spendInr?: number | null): number | null {
  if (configRate != null && Number.isFinite(configRate) && configRate > 0) return configRate;
  if (spendUsd && spendInr && spendUsd > 0) return spendInr / spendUsd;
  return null;
}

/** A 0–1 rate as "42.5%". */
export function formatRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return formatPercent(rate * 100);
}

/** "grossMarginPct" → "Gross margin pct" (benchmarks carry keys only). */
export function metricKeyLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

/** At most one decimal, Indian grouping ("2.4", "1,234"). */
function oneDecimal(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

/** A benchmark value in its metric's unit (CURRENCY in the store's INR). */
export function formatMetricValue(value: number, unit: string): string {
  switch (unit) {
    case "CURRENCY":
      return formatMoney(value, { whole: true });
    case "PERCENT":
      return formatPercent(value);
    case "RATIO":
      return `${oneDecimal(value)}×`;
    case "DAYS":
      return `${oneDecimal(value)} days`;
    default:
      return formatCount(value);
  }
}

// ─── Config form ──────────────────────────────────────────────────────────

/** The form state for the server's config. */
export function aiConfigDraft(config: PlatformAiConfig): AiConfigDraft {
  const pricing: AiConfigDraft["pricing"] = {};
  for (const row of config.pricing) {
    pricing[row.model] = {
      inputPerMTok: String(row.inputPerMTok),
      outputPerMTok: String(row.outputPerMTok),
      cacheWritePerMTok: String(row.cacheWritePerMTok),
      cacheReadPerMTok: String(row.cacheReadPerMTok),
      batchDiscount: String(row.batchDiscount),
    };
  }
  return {
    enabled: config.enabled,
    defaultModel: config.defaultModel,
    reasoningModel: config.reasoningModel,
    allowedModels: [...config.allowedModels],
    pricing,
    globalDailySpendCapUsd: String(config.globalDailySpendCapUsd),
    monthlyBudgetUsd: String(config.monthlyBudgetUsd),
    alertThresholds: config.alertThresholds
      .map((threshold) => String(Math.round(threshold * 1000) / 10))
      .join(", "),
    usdInrRate: String(config.usdInrRate),
    nightCoolingStart: config.nightCoolingStart,
    nightCoolingEnd: config.nightCoolingEnd,
    perQuestionTokenCeiling: String(config.perQuestionTokenCeiling),
    rateLimitPerMinute: String(config.rateLimitPerMinute),
    benchmarkMinStores: String(config.benchmarkMinStores),
  };
}

/** Every model the form can offer: priced models first, then allowed ones. */
export function aiKnownModels(config: PlatformAiConfig): string[] {
  const models = config.pricing.map((row) => row.model);
  for (const model of config.allowedModels) {
    if (!models.includes(model)) models.push(model);
  }
  return models;
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function samePrice(a: PlatformAiModelPrice, b: PlatformAiModelPrice): boolean {
  return PRICE_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * The changed fields of `draft` against `config`, checked against the same
 * limits as the server. Pricing is sent as the changed models' rows only
 * (a row replaces that model's prices).
 */
export function aiConfigPatch(
  config: PlatformAiConfig,
  draft: AiConfigDraft,
): AiConfigPatchResult {
  const input: PlatformAiConfigInput = {};
  const errors: FieldErrors = {};

  if (draft.enabled !== config.enabled) input.enabled = draft.enabled;

  const allowed = draft.allowedModels;
  if (allowed.length === 0) {
    errors.allowedModels = "Allow at least one model.";
  } else if (
    [...allowed].sort().join("\n") !== [...config.allowedModels].sort().join("\n")
  ) {
    input.allowedModels = [...allowed];
  }
  for (const field of ["defaultModel", "reasoningModel"] as const) {
    if (!allowed.includes(draft[field])) {
      errors[field] = "Pick one of the allowed models.";
    } else if (draft[field] !== config[field]) {
      input[field] = draft[field];
    }
  }

  for (const field of NUMERIC_CONFIG_FIELDS) {
    const limits = CONFIG_LIMITS[field];
    const value = parseNumber(draft[field]);
    if (
      value === null ||
      value < limits.min ||
      value > limits.max ||
      (limits.integer && !Number.isInteger(value))
    ) {
      errors[field] = `Enter ${limits.integer ? "a whole number" : "a number"} from ${formatCount(limits.min)} to ${formatCount(limits.max)}.`;
    } else if (value !== config[field]) {
      input[field] = value;
    }
  }

  const thresholdText = draft.alertThresholds.trim();
  const percents = thresholdText
    ? thresholdText.split(",").map((part) => parseNumber(part))
    : [];
  if (
    percents.length > 5 ||
    percents.some((value) => value === null || value <= 0 || value > 100)
  ) {
    errors.alertThresholds =
      "Up to five percentages above 0 and at most 100, separated by commas.";
  } else {
    const fractions = (percents as number[])
      .map((value) => Math.round(value * 10) / 1000)
      .sort((a, b) => a - b);
    if (!sameNumbers(fractions, [...config.alertThresholds].sort((a, b) => a - b))) {
      input.alertThresholds = fractions;
    }
  }

  for (const field of ["nightCoolingStart", "nightCoolingEnd"] as const) {
    const value = draft[field].trim();
    if (!HOUR_MINUTE.test(value)) {
      errors[field] = "Use 24-hour HH:mm, like 01:30.";
    } else if (value !== config[field]) {
      input[field] = value;
    }
  }
  if (
    !errors.nightCoolingStart &&
    !errors.nightCoolingEnd &&
    draft.nightCoolingStart.trim() === draft.nightCoolingEnd.trim()
  ) {
    errors.nightCoolingEnd = "The night window can't start and end at the same time.";
  }

  const changedPrices: PlatformAiModelPrice[] = [];
  for (const row of config.pricing) {
    const typed = draft.pricing[row.model];
    if (!typed) continue;
    const next = { model: row.model } as PlatformAiModelPrice;
    let rowValid = true;
    for (const field of PRICE_FIELDS) {
      const value = parseNumber(typed[field]);
      const max = field === "batchDiscount" ? 1 : 1000;
      const invalid =
        value === null ||
        value > max ||
        (field === "batchDiscount" ? value <= 0 : value < 0);
      if (invalid) {
        rowValid = false;
        errors.pricing = `Check the prices for ${row.model}: 0–1000 per million tokens, batch discount above 0 and at most 1.`;
        break;
      }
      next[field] = value;
    }
    if (rowValid && !samePrice(row, next)) changedPrices.push(next);
  }
  if (!errors.pricing && changedPrices.length > 0) input.pricing = changedPrices;

  return { input: Object.keys(errors).length > 0 ? {} : input, errors };
}

// ─── Per-store overrides ──────────────────────────────────────────────────

/** The form state for a store's setting (empty = plan value). */
export function aiOverrideDraft(
  setting: PlatformAiTenantSetting | null | undefined,
): AiOverrideDraft {
  const calls = setting?.connectorCallsPerWeek ?? null;
  return {
    questionsPerWeek:
      setting?.questionsPerWeek != null ? String(setting.questionsPerWeek) : "",
    connectorCallsPerWeek: calls != null && calls !== AI_FAIR_USE ? String(calls) : "",
    monthlyTokenBudget:
      setting?.monthlyTokenBudget != null ? String(setting.monthlyTokenBudget) : "",
    connectorFairUse: calls === AI_FAIR_USE,
  };
}

/**
 * The whole override input (every field, null = plan value), or field
 * errors. Always all three fields: the server clears an omitted one.
 */
export function aiOverrideInput(draft: AiOverrideDraft): AiOverrideResult {
  const errors: FieldErrors = {};
  const read = (
    field: keyof PlatformAiOverrideInput,
    text: string,
  ): number | null => {
    if (!text.trim()) return null;
    const value = parseNumber(text);
    const { max } = OVERRIDE_LIMITS[field];
    const min = Math.max(0, OVERRIDE_LIMITS[field].min);
    if (value === null || !Number.isInteger(value) || value < min || value > max) {
      errors[field] = `Enter a whole number from ${formatCount(min)} to ${formatCount(max)}, or leave it empty for the plan's value.`;
      return null;
    }
    return value;
  };
  const input: PlatformAiOverrideInput = {
    questionsPerWeek: read("questionsPerWeek", draft.questionsPerWeek),
    connectorCallsPerWeek: draft.connectorFairUse
      ? AI_FAIR_USE
      : read("connectorCallsPerWeek", draft.connectorCallsPerWeek),
    monthlyTokenBudget: read("monthlyTokenBudget", draft.monthlyTokenBudget),
  };
  return Object.keys(errors).length > 0 ? { input: null, errors } : { input, errors };
}

/** "Plan value" or the override, for the read-only view. */
export function aiOverrideLabel(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null) return "Plan value";
  if (value === AI_FAIR_USE) return "Fair use";
  return `${formatCount(value)} ${unit}`;
}

// ─── Top-ups ──────────────────────────────────────────────────────────────

/** The grant variables, or the message to show under the questions field. */
export function aiTopUpVariables(
  tenantId: string,
  questionsText: string,
  note: string,
): { variables: { tenantId: string; questions: number; note: string | null } } | { error: string } {
  const questions = parseNumber(questionsText);
  if (
    questions === null ||
    !Number.isInteger(questions) ||
    questions < 1 ||
    questions > AI_TOPUP_MAX_QUESTIONS
  ) {
    return {
      error: `Enter a whole number of questions from 1 to ${formatCount(AI_TOPUP_MAX_QUESTIONS)}.`,
    };
  }
  const trimmed = note.trim().slice(0, AI_NOTE_MAX_LENGTH);
  return { variables: { tenantId, questions, note: trimmed || null } };
}

// ─── Server errors ────────────────────────────────────────────────────────

function firstError(error: unknown): GraphQLErrorLike | undefined {
  return (error as { graphQLErrors?: GraphQLErrorLike[] })?.graphQLErrors?.[0];
}

/**
 * A `BAD_USER_INPUT` with one of `reasons`, as `{ field: message }`. The
 * server names nested fields by path ("pricing.0.inputPerMTok"); the form
 * shows them on the top-level field. `null` for any other error.
 */
export function aiFieldErrorsFromServer(
  error: unknown,
  reasons: readonly string[],
  fields: readonly string[],
): FieldErrors | null {
  const first = firstError(error);
  if (String(first?.extensions?.code ?? "") !== "BAD_USER_INPUT") return null;
  if (!reasons.includes(String(first?.extensions?.reason ?? ""))) return null;
  const field = String(first?.extensions?.field ?? "").split(".")[0];
  const key = fields.includes(field) ? field : "form";
  return { [key]: first?.message || "Check this value." };
}

/** Every field of the config form, for `aiFieldErrorsFromServer`. */
export const AI_CONFIG_FORM_FIELDS = [
  "enabled",
  "defaultModel",
  "reasoningModel",
  "allowedModels",
  "pricing",
  "alertThresholds",
  "nightCoolingStart",
  "nightCoolingEnd",
  ...NUMERIC_CONFIG_FIELDS,
] as const;

/** Every field of the override form. */
export const AI_OVERRIDE_FORM_FIELDS = [
  "questionsPerWeek",
  "connectorCallsPerWeek",
  "monthlyTokenBudget",
] as const;

// ─── Usage CSV ────────────────────────────────────────────────────────────

/**
 * The usage export as a file: exactly one UTF-8 BOM (so Excel reads ₹ and
 * store names), whatever the server sent, and a dated name.
 */
export function aiUsageCsvFile(
  csv: string,
  now: Date = new Date(),
): { filename: string; content: string } {
  const body = csv.startsWith(UTF8_BOM) ? csv.slice(UTF8_BOM.length) : csv;
  const day = now.toISOString().slice(0, 10);
  return { filename: `ai-usage-${day}.csv`, content: `${UTF8_BOM}${body}` };
}

// ─── Data health ──────────────────────────────────────────────────────────

/** Why a store is on the data-health list, in the order to fix them. */
export function aiDataHealthIssues(row: PlatformAiDataHealthRow): string[] {
  const issues: string[] = [];
  if (row.computeStatus === "FAILED") issues.push("Last insights run failed");
  if (row.costCoveragePct < AI_COST_COVERAGE_TARGET_PCT) {
    issues.push(
      `Cost prices on ${formatPercent(row.costCoveragePct)} of products (needs ${AI_COST_COVERAGE_TARGET_PCT}%)`,
    );
  }
  if (!row.settingsFilled) issues.push("Business settings not filled in");
  return issues;
}

// ─── Top-ups and data health filters (PRD-024 FR-1.10, B-11) ─────────────

/** The top-up list's status filter, in the order the tab offers it. */
export const TOP_UP_STATUS_OPTIONS: readonly {
  key: PlatformAiTopUpRequestStatus;
  label: string;
}[] = [
  { key: "OPEN", label: "Open" },
  { key: "GRANTED", label: "Granted" },
  { key: "DISMISSED", label: "Dismissed" },
];

/** A status from the URL or a picker; anything else is the default, Open. */
export function topUpStatusOf(value: unknown): PlatformAiTopUpRequestStatus {
  return TOP_UP_STATUS_OPTIONS.some((option) => option.key === value)
    ? (value as PlatformAiTopUpRequestStatus)
    : "OPEN";
}

/** The empty state of the top-up list for a status. */
export function topUpEmptyCopy(status: PlatformAiTopUpRequestStatus): string {
  if (status === "GRANTED") return "No granted requests";
  if (status === "DISMISSED") return "No dismissed requests";
  return "No open requests";
}
