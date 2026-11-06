import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AiBenchmarksTab } from "../components/ai/AiBenchmarksTab";
import { AiDataHealthTab } from "../components/ai/AiDataHealthTab";
import { AiModelsTab } from "../components/ai/AiModelsTab";
import { AiTopUpsTab } from "../components/ai/AiTopUpsTab";
import { AiUsageTab } from "../components/ai/AiUsageTab";
import type { AiExportRef } from "../components/ai/ai-export";
import { PageHeader } from "../components/common/PageHeader";
import {
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  SegmentedSwitch,
  SummaryPanel,
  cx,
  formatCount,
  toneTextClasses,
  type RowMenuItem,
  type SummaryCell,
} from "../components/ui";
import { IconAi, IconChartBar, IconExport, IconLock, IconSettings, IconWarning } from "../components/ui/icons";
import { useSummaryKey } from "../hooks/use-summary-key";
import { useAiConfig, useAiDataHealth, useAiPlatformTotals, useAiTopUpRequests } from "../hooks/use-platform-ai";
import { aiInrRate, formatRate, formatUsd, formatUsdInr } from "../lib/platform-ai.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { toasts } from "../copy";

/**
 * ZCOM AI (04 S-06, PRD-021 FR-6): one page for Zerror staff. A fixed header, the 4 spend KPIs, then one table card
 * whose tabs are `?tab=`: Usage by store (default), Spend by model, Top-up requests, Data health and Benchmarks.
 * The `ai_config` settings live in Settings › ZCOM AI settings. Everything needs `platform:ai:read`; changes also
 * need `platform:ai:manage`. The old /ai/overview and /ai/usage?view=… URLs redirect here (App.tsx).
 *
 * Design v2 (board 69, menu Analytics ▸ AI usage): title "Analytics · AI usage" with the ink tile, AI settings as
 * the one secondary button and ⋯ (Export of the current tab; the AI cost snapshot under Analytics); the summary
 * panel replaces the KPI strip; the five tabs stay as the standard toolbar above each table, so Top-up requests
 * (with its open count), Data health, Benchmarks and Spend by model keep their place. Board 69's "Actions taken"
 * and "Marked helpful" have no data (no per-answer rating or action log on the platform AI API), so the panel
 * shows the four figures the API has.
 */
type AiTab = "usage" | "models" | "top-ups" | "data-health" | "benchmarks";

const TAB_ORDER: AiTab[] = ["usage", "models", "top-ups", "data-health", "benchmarks"];

const TAB_LABELS: Record<AiTab, string> = {
  usage: "Usage by store",
  models: "Spend by model",
  "top-ups": "Top-up requests",
  "data-health": "Data health",
  benchmarks: "Benchmarks",
};

const isAiTab = (value: string | null | undefined): value is AiTab => !!value && value in TAB_LABELS;

/** v2 §2.1: every page-title tile is ink with a white glyph (the AI gradient is for AI suggestions only). */
const aiTile = <IconAi aria-hidden />;

const PAGE_TITLE = "Analytics · AI usage";

export function Ai() {
  const { can } = useAuth();
  const summaryKey = useSummaryKey("analytics-ai");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: AiTab = isAiTab(tabParam) ? tabParam : "usage";
  const exportRef: AiExportRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const totalsApi = useAiPlatformTotals();
  const totals = totalsApi.data;
  const config = useAiConfig();
  const inrRate = aiInrRate(config.data?.usdInrRate, totals?.spendMonthUsd, totals?.spendMonthInr);
  // Tab counts: one row is enough to read each total.
  const openTopUps = useAiTopUpRequests({ status: "OPEN", limit: 1, offset: 0 });
  const heldBack = useAiDataHealth({ needsAttention: true, limit: 1, offset: 0 });

  // Client-side mirror of the backend guard (`platform:ai:read`); the server still decides.
  if (!can(PLATFORM_PERMISSIONS.AI_READ)) {
    return (
      <div>
        <PageHeader type="page" icon={aiTile} title={PAGE_TITLE} />
        <Card>
          <EmptyState icon={IconLock} title="AI usage isn't available to your role" description="Ask a platform owner for AI access." />
        </Card>
      </div>
    );
  }

  // A new tab starts clean: its own search, filters and page.
  const selectTab = (next: AiTab) => setSearchParams(next === "usage" ? {} : { tab: next });

  const runExport = async () => {
    const run = exportRef.current;
    if (!run) return;
    setExporting(true);
    try {
      await run();
    } finally {
      setExporting(false);
    }
  };

  const tabs = (
    <SegmentedSwitch
      ariaLabel="Zcom AI tables"
      value={tab}
      onChange={selectTab}
      items={TAB_ORDER.map((key) => ({
        value: key,
        label: TAB_LABELS[key],
        count: key === "top-ups" ? (openTopUps.data?.totalCount ?? null) : key === "data-health" ? (heldBack.data?.totalCount ?? null) : undefined,
      }))}
    />
  );
  const crossed = totals?.alertsCrossed ?? [];
  const usdInr = (usd: number | null | undefined) => formatUsdInr(usd, inrRate != null && usd != null ? usd * inrRate : null);

  // ⋯ (v2 §4.1): Export of the visible tab, then the AI cost view of the platform snapshot.
  const more: RowMenuItem[] = [
    {
      key: "export",
      label: `Export ${TAB_LABELS[tab].toLowerCase()} (CSV)`,
      icon: IconExport,
      disabled: exporting,
      description: exporting ? "Exporting…" : undefined,
      onSelect: () => void runExport(),
    },
    ...(can(PLATFORM_PERMISSIONS.REPORTS_READ)
      ? [{ key: "ai-cost", label: "AI cost in the platform snapshot", icon: IconChartBar, href: "/analytics/ai-cost" }]
      : []),
  ];

  // v2 §4.2: four numbers. Today's spend is red once the daily cap is reached; the month's spend amber once it
  // passes a budget alert.
  const budgetPercent = totals?.budgetUsedPercent;
  const summaryCells: SummaryCell[] = [
    {
      key: "questions",
      label: "Questions this month",
      value: formatCount(totals?.answeredQuestions),
      note: `${formatCount(totals?.cachedAnswers)} from cache · ${formatUsd(totals?.avgCostPerQuestionUsd)} per question`,
    },
    {
      key: "month",
      label: "Spend this month",
      value: formatUsdInr(totals?.spendMonthUsd, totals?.spendMonthInr),
      note: `${formatCount(budgetPercent)}% of ${formatUsd(totals?.monthlyBudgetUsd)} budget`,
      tone: crossed.length > 0 ? "warning" : "default",
      chart: budgetPercent != null && Number.isFinite(budgetPercent) ? { kind: "ring", percent: budgetPercent } : undefined,
    },
    {
      key: "today",
      label: "Spend today",
      value: usdInr(totals?.spendTodayUsd),
      note: `Cap ${formatUsd(totals?.dailyCapUsd)}`,
      tone: totals?.dailyCapReached ? "danger" : "default",
    },
    {
      key: "cache",
      label: "Cache hit rate",
      value: formatRate(totals?.cacheHitRate),
      note: `${formatCount(totals?.refusals)} refused · ${formatCount(totals?.failures)} failed`,
    },
  ];

  return (
    <div>
      <PageHeader
        type="page"
        icon={aiTile}
        title={PAGE_TITLE}
        description="What Zcom AI is asked, what it costs, and the data it answers from."
        actions={
          <ButtonLink to="/settings/ai" variant="secondary" startIcon={<IconSettings aria-hidden />}>
            AI settings
          </ButtonLink>
        }
        more={more}
        moreLabel="More AI usage actions"
      />

      <div className="space-y-4">
        {totalsApi.error ? (
          <ErrorState title="Couldn't load the AI totals." description={toasts.genericError} onRetry={() => void totalsApi.refetch()} />
        ) : null}
        {totals?.dailyCapReached ? (
          <Card>
            <p className={cx("flex items-start gap-2 text-body", toneTextClasses.danger)}>
              <IconWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
              Today's spend cap is reached. Merchants see "The AI assistant is resting, back tomorrow" until the day resets.
            </p>
          </Card>
        ) : null}
        {crossed.length > 0 ? (
          <Card>
            <p className={cx("flex items-start gap-2 text-body", toneTextClasses.warning)}>
              <IconWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
              This month's AI spend has passed {crossed.map((threshold) => `${threshold}%`).join(", ")} of the budget.
            </p>
          </Card>
        ) : null}

        <SummaryPanel cells={summaryCells} isLoading={totalsApi.loading} storageKey={summaryKey} aria-label="AI usage summary" />

        {tab === "models" ? (
          <AiModelsTab
            tabs={tabs}
            exportRef={exportRef}
            models={totals?.modelMix ?? []}
            loading={totalsApi.loading}
            defaultModel={config.data?.defaultModel}
            reasoningModel={config.data?.reasoningModel}
            inrRate={inrRate}
          />
        ) : tab === "top-ups" ? (
          <AiTopUpsTab tabs={tabs} exportRef={exportRef} />
        ) : tab === "data-health" ? (
          <AiDataHealthTab tabs={tabs} exportRef={exportRef} />
        ) : tab === "benchmarks" ? (
          <AiBenchmarksTab tabs={tabs} exportRef={exportRef} />
        ) : (
          <AiUsageTab tabs={tabs} exportRef={exportRef} />
        )}
      </div>
    </div>
  );
}
