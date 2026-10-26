import { describe, expect, it } from "vitest";
import type { PlatformAiConfig, PlatformAiDataHealthRow } from "../types/platform-api";
import {
  AI_CONFIG_FORM_FIELDS,
  AI_OVERRIDE_FORM_FIELDS,
  aiConfigDraft,
  aiConfigPatch,
  aiDataHealthIssues,
  aiFieldErrorsFromServer,
  aiKnownModels,
  aiOverrideDraft,
  aiOverrideInput,
  aiOverrideLabel,
  aiTopUpVariables,
  aiUsageCsvFile,
  formatMetricValue,
  formatRate,
  formatUsd,
  metricKeyLabel,
} from "./platform-ai.util";

const config: PlatformAiConfig = {
  enabled: true,
  defaultModel: "claude-haiku",
  reasoningModel: "claude-sonnet",
  allowedModels: ["claude-haiku", "claude-sonnet"],
  pricing: [
    {
      model: "claude-haiku",
      inputPerMTok: 1,
      outputPerMTok: 5,
      cacheWritePerMTok: 1.25,
      cacheReadPerMTok: 0.1,
      batchDiscount: 0.5,
    },
    {
      model: "claude-sonnet",
      inputPerMTok: 3,
      outputPerMTok: 15,
      cacheWritePerMTok: 3.75,
      cacheReadPerMTok: 0.3,
      batchDiscount: 0.5,
    },
  ],
  globalDailySpendCapUsd: 50,
  monthlyBudgetUsd: 1000,
  alertThresholds: [0.5, 0.8, 1],
  usdInrRate: 84,
  nightCoolingStart: "01:00",
  nightCoolingEnd: "06:00",
  perQuestionTokenCeiling: 40000,
  rateLimitPerMinute: 6,
  benchmarkMinStores: 5,
};

const gqlError = (extensions: Record<string, unknown>, message = "Bad value") => ({
  graphQLErrors: [{ message, extensions }],
});

describe("formatting", () => {
  it("shows USD with paise, and small amounts with four decimals", () => {
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatUsd(0.0042)).toBe("$0.0042");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(null)).toBe("$0.00");
  });

  it("shows 0–1 rates as percentages", () => {
    expect(formatRate(0.425)).toBe("42.5%");
    expect(formatRate(null)).toBe("—");
  });

  it("labels metric keys and formats benchmark values by unit", () => {
    expect(metricKeyLabel("grossMarginPct")).toBe("Gross margin pct");
    expect(metricKeyLabel("aov")).toBe("Aov");
    expect(formatMetricValue(12.5, "PERCENT")).toBe("12.5%");
    expect(formatMetricValue(2.44, "RATIO")).toBe("2.4×");
    expect(formatMetricValue(6.5, "DAYS")).toBe("6.5 days");
    expect(formatMetricValue(120000, "CURRENCY")).toBe("₹1,20,000");
    expect(formatMetricValue(1234, "COUNT")).toBe("1,234");
  });
});

describe("config form", () => {
  it("round-trips the server config with nothing to send", () => {
    const draft = aiConfigDraft(config);
    expect(draft.alertThresholds).toBe("50, 80, 100");
    expect(aiConfigPatch(config, draft)).toEqual({ input: {}, errors: {} });
  });

  it("sends only what changed, with thresholds as fractions and changed price rows only", () => {
    const draft = aiConfigDraft(config);
    draft.monthlyBudgetUsd = "1500";
    draft.alertThresholds = "90, 50";
    draft.pricing["claude-sonnet"].outputPerMTok = "16";
    const result = aiConfigPatch(config, draft);
    expect(result.errors).toEqual({});
    expect(result.input).toEqual({
      monthlyBudgetUsd: 1500,
      alertThresholds: [0.5, 0.9],
      pricing: [{ ...config.pricing[1], outputPerMTok: 16 }],
    });
  });

  it("checks the server's limits before sending anything", () => {
    const draft = aiConfigDraft(config);
    draft.rateLimitPerMinute = "1.5";
    draft.nightCoolingStart = "25:00";
    draft.alertThresholds = "120";
    draft.allowedModels = ["claude-haiku"];
    const result = aiConfigPatch(config, draft);
    expect(result.input).toEqual({});
    expect(Object.keys(result.errors).sort()).toEqual(
      ["alertThresholds", "nightCoolingStart", "rateLimitPerMinute", "reasoningModel"].sort(),
    );
  });

  it("refuses an empty night window and an empty model list", () => {
    const draft = aiConfigDraft(config);
    draft.nightCoolingEnd = "01:00";
    expect(aiConfigPatch(config, draft).errors.nightCoolingEnd).toBeTruthy();
    const none = { ...aiConfigDraft(config), allowedModels: [] };
    expect(aiConfigPatch(config, none).errors.allowedModels).toBeTruthy();
  });

  it("lists priced models first, then allowed ones without a price", () => {
    expect(aiKnownModels({ ...config, allowedModels: ["claude-haiku", "claude-opus"] })).toEqual([
      "claude-haiku",
      "claude-sonnet",
      "claude-opus",
    ]);
  });
});

describe("per-store overrides", () => {
  it("reads the setting into the form, fair use as a tick", () => {
    expect(aiOverrideDraft(null)).toEqual({
      questionsPerWeek: "",
      connectorCallsPerWeek: "",
      monthlyTokenBudget: "",
      connectorFairUse: false,
    });
    const draft = aiOverrideDraft({
      tenantId: "t1",
      paused: false,
      pausedReason: null,
      questionsPerWeek: 500,
      connectorCallsPerWeek: -1,
      monthlyTokenBudget: null,
    });
    expect(draft).toMatchObject({ questionsPerWeek: "500", connectorFairUse: true, connectorCallsPerWeek: "" });
  });

  it("always sends all three fields, empty as the plan's value", () => {
    expect(
      aiOverrideInput({ questionsPerWeek: "500", connectorCallsPerWeek: "", monthlyTokenBudget: "", connectorFairUse: false }),
    ).toEqual({
      input: { questionsPerWeek: 500, connectorCallsPerWeek: null, monthlyTokenBudget: null },
      errors: {},
    });
    expect(
      aiOverrideInput({ questionsPerWeek: "", connectorCallsPerWeek: "40", monthlyTokenBudget: "", connectorFairUse: true }).input,
    ).toEqual({ questionsPerWeek: null, connectorCallsPerWeek: -1, monthlyTokenBudget: null });
  });

  it("rejects fractions, negatives and values over the server limits", () => {
    const result = aiOverrideInput({
      questionsPerWeek: "2.5",
      connectorCallsPerWeek: "-1",
      monthlyTokenBudget: "20000000000",
      connectorFairUse: false,
    });
    expect(result.input).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual(AI_OVERRIDE_FORM_FIELDS.slice().sort());
  });

  it("labels plan values, fair use and overrides", () => {
    expect(aiOverrideLabel(null, "questions")).toBe("Plan value");
    expect(aiOverrideLabel(-1, "calls")).toBe("Fair use");
    expect(aiOverrideLabel(1500, "questions")).toBe("1,500 questions");
  });
});

describe("top-ups", () => {
  it("accepts 1 to 10,000 whole questions and trims the note", () => {
    expect(aiTopUpVariables("t1", "50", "  Diwali  ")).toEqual({
      variables: { tenantId: "t1", questions: 50, note: "Diwali" },
    });
    expect(aiTopUpVariables("t1", "50", "")).toEqual({
      variables: { tenantId: "t1", questions: 50, note: null },
    });
    for (const bad of ["0", "10001", "2.5", "", "abc"]) {
      expect("error" in aiTopUpVariables("t1", bad, "")).toBe(true);
    }
  });
});

describe("server errors", () => {
  it("puts a nested config error on its top-level field", () => {
    const error = gqlError({ code: "BAD_USER_INPUT", reason: "INVALID_AI_CONFIG", field: "pricing.0.inputPerMTok" });
    expect(aiFieldErrorsFromServer(error, ["INVALID_AI_CONFIG"], AI_CONFIG_FORM_FIELDS)).toEqual({
      pricing: "Bad value",
    });
  });

  it("falls back to the form for an unknown field, and ignores other errors", () => {
    const unknown = gqlError({ code: "BAD_USER_INPUT", reason: "INVALID_AI_CONFIG", field: "mystery" });
    expect(aiFieldErrorsFromServer(unknown, ["INVALID_AI_CONFIG"], AI_CONFIG_FORM_FIELDS)).toEqual({
      form: "Bad value",
    });
    const forbidden = gqlError({ code: "FORBIDDEN" });
    expect(aiFieldErrorsFromServer(forbidden, ["INVALID_AI_CONFIG"], AI_CONFIG_FORM_FIELDS)).toBeNull();
    const otherReason = gqlError({ code: "BAD_USER_INPUT", reason: "INVALID_OVERRIDE", field: "questionsPerWeek" });
    expect(aiFieldErrorsFromServer(otherReason, ["INVALID_AI_CONFIG"], AI_CONFIG_FORM_FIELDS)).toBeNull();
  });
});

describe("usage CSV", () => {
  it("keeps exactly one BOM and names the file by day", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    expect(aiUsageCsvFile("﻿store,cost\na,1", now)).toEqual({
      filename: "ai-usage-2026-10-26.csv",
      content: "﻿store,cost\na,1",
    });
    expect(aiUsageCsvFile("store,cost", now).content).toBe("﻿store,cost");
  });
});

describe("data health", () => {
  const row: PlatformAiDataHealthRow = {
    tenantId: "t1",
    storeName: "Kurta Co",
    slug: "kurta",
    computedAt: "2026-10-26T00:00:00Z",
    costCoveragePct: 40,
    settingsFilled: false,
    spendMonths: 0,
    computeStatus: "FAILED",
    computeMs: 1200,
    canSeeProfitability: false,
  };

  it("lists the reasons a store needs attention, failures first", () => {
    expect(aiDataHealthIssues(row)).toEqual([
      "Last insights run failed",
      "Cost prices on 40% of products (needs 80%)",
      "Business settings not filled in",
    ]);
    expect(
      aiDataHealthIssues({ ...row, costCoveragePct: 95, settingsFilled: true, computeStatus: "OK" }),
    ).toEqual([]);
  });
});
