import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useAiPlatformTotals } from "../../hooks/use-platform-ai";
import { formatInr, formatRate, formatUsd } from "../../lib/platform-ai.util";
import { emptyStates, toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { IconAi, IconWarning } from "../ui/icons";
import {
  Card,
  EmptyState,
  ErrorState,
  KpiStrip,
  StatCard,
  cx,
  formatCount,
  tableRowClasses,
  toneTextClasses,
} from "../ui";

const right = "block text-right num";

const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

/**
 * AI › Overview (PRD-021 FR-6.3): today's and this month's AI spend against
 * the daily cap and monthly budget, the budget thresholds already crossed,
 * chat quality counters and the spend per model. Money is shown to Zerror
 * staff only; merchants only ever see questions.
 */
export function AiOverviewTab() {
  const api = useAiPlatformTotals();
  const totals = api.data;
  const crossed = totals?.alertsCrossed ?? [];

  return (
    <div>
      <PageHeader
        type="page"
        icon={<IconAi aria-hidden />}
        section="pink"
        title="ZCOM AI overview"
        description="ZCOM AI spend and quality across every store."
      />

      {api.error ? (
        <ErrorState title="Couldn't load the AI totals." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <div className="space-y-4">
        {totals?.dailyCapReached ? (
          <Card>
            <p className={cx("flex items-start gap-2 text-body", toneTextClasses.danger)}>
              <IconWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
              Today's spend cap is reached. Merchants see "The AI assistant is resting, back tomorrow" until the
              day resets.
            </p>
          </Card>
        ) : null}
        {crossed.length > 0 ? (
          <Card>
            <p className={cx("flex items-start gap-2 text-body", toneTextClasses.warning)}>
              <IconWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
              This month's AI spend has passed {crossed.map((threshold) => `${threshold}%`).join(", ")} of the
              budget.
            </p>
          </Card>
        ) : null}

        <KpiStrip>
          <StatCard
            bare
            isLoading={api.loading}
            label="Spend today"
            value={formatUsd(totals?.spendTodayUsd)}
            deltaLabel={`Cap ${formatUsd(totals?.dailyCapUsd)}`}
            valueTone={totals?.dailyCapReached ? "danger" : "default"}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Spend this month"
            value={formatUsd(totals?.spendMonthUsd)}
            deltaLabel={`${formatInr(totals?.spendMonthInr)} · ${formatCount(totals?.budgetUsedPercent)}% of ${formatUsd(totals?.monthlyBudgetUsd)}`}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Questions this month"
            value={totals?.answeredQuestions ?? 0}
            deltaLabel={`Answered, ${formatCount(totals?.cachedAnswers)} from cache · ${formatUsd(totals?.avgCostPerQuestionUsd)} per question`}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Cache hit rate"
            value={formatRate(totals?.cacheHitRate)}
            deltaLabel={`${formatCount(totals?.refusals)} refused · ${formatCount(totals?.failures)} failed`}
          />
        </KpiStrip>

        <Card title="Spend by model" description="This month" padding="none" className="overflow-hidden">
          <Table aria-label="AI spend by model" removeWrapper classNames={cardTableClassNames}>
            <TableHeader>
              <TableColumn>Model</TableColumn>
              <TableColumn align="end">Calls</TableColumn>
              <TableColumn align="end">Cost</TableColumn>
            </TableHeader>
            <TableBody
              items={totals?.modelMix ?? []}
              isLoading={api.loading}
              emptyContent={<EmptyState compact description={emptyStates.noData} />}
            >
              {(row) => (
                <TableRow key={row.model}>
                  <TableCell className="whitespace-nowrap font-medium">{row.model}</TableCell>
                  <TableCell><span className={right}>{formatCount(row.calls)}</span></TableCell>
                  <TableCell><span className={right}>{formatUsd(row.costUsd)}</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
