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
  AiAvatar,
  ButtonLink,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiStrip,
  SegmentedSwitch,
  StatCard,
  cx,
  formatCount,
  toneTextClasses,
} from "../components/ui";
import { IconDownload, IconLock, IconSettings, IconWarning } from "../components/ui/icons";
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

/** The page tile: the AI gradient with a white sparkle (01 §7.23), filling the 40px header tile. */
const aiTile = <AiAvatar className="size-10 rounded-xl" />;

export function Ai() {
  const { can } = useAuth();
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
        <PageHeader type="page" icon={aiTile} title="ZCOM AI" />
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
      ariaLabel="ZCOM AI tables"
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

  return (
    <div>
      <PageHeader
        type="page"
        icon={aiTile}
        title="ZCOM AI"
        description="Spend, questions and data health across every store."
        actions={
          <>
            <ButtonLink to="/settings/ai" variant="secondary" startIcon={<IconSettings aria-hidden />}>
              AI settings
            </ButtonLink>
            <Button variant="secondary" startIcon={<IconDownload aria-hidden />} isLoading={exporting} onPress={() => void runExport()}>
              Export
            </Button>
          </>
        }
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

        <KpiStrip>
          <StatCard
            bare
            isLoading={totalsApi.loading}
            label="Spend today"
            value={usdInr(totals?.spendTodayUsd)}
            deltaLabel={`Cap ${formatUsd(totals?.dailyCapUsd)}`}
            valueTone={totals?.dailyCapReached ? "danger" : "default"}
          />
          <StatCard
            bare
            isLoading={totalsApi.loading}
            label="Spend this month"
            value={formatUsdInr(totals?.spendMonthUsd, totals?.spendMonthInr)}
            deltaLabel={`${formatCount(totals?.budgetUsedPercent)}% of ${formatUsd(totals?.monthlyBudgetUsd)} budget`}
          />
          <StatCard
            bare
            isLoading={totalsApi.loading}
            label="Questions this month"
            value={formatCount(totals?.answeredQuestions)}
            deltaLabel={`${formatCount(totals?.cachedAnswers)} from cache · ${formatUsd(totals?.avgCostPerQuestionUsd)} per question`}
          />
          <StatCard
            bare
            isLoading={totalsApi.loading}
            label="Cache hit rate"
            value={formatRate(totals?.cacheHitRate)}
            deltaLabel={`${formatCount(totals?.refusals)} refused · ${formatCount(totals?.failures)} failed`}
          />
        </KpiStrip>

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
