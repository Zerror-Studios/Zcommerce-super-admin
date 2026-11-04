import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClientsTable } from "../components/clients/ClientsTable";
import { EarningsChart } from "../components/dashboard/EarningsChart";
import { AttentionSummaryCard } from "../components/insights/home/AttentionSummaryCard";
import { MoneyDueCard } from "../components/insights/home/MoneyDueCard";
import { AtRiskCard, DevelopmentCard } from "../components/insights/home/StoreListCard";
import { MetricCard } from "../components/insights/MetricCard";
import { SnapshotHeader } from "../components/insights/SnapshotHeader";
import { Button, ErrorState, KpiStrip, VideoBanner } from "../components/ui";
import { IconAdd } from "../components/ui/icons";
import { toasts } from "../copy";
import { knownStoreNames, thisMonthCells } from "../lib/home-attention.util";
import { FIRST_SNAPSHOT_COPY } from "../lib/platform-insights.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformAttention } from "../hooks/use-platform-insights";
import { useRevenueOverview } from "../hooks/use-platform-reports";

const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Home (backend PRD-026 FR-7.1, console guide §3): the video banner, then
 * "Last updated · Refresh now" and the blocks in this order: money due this
 * week (read live; hidden without billing:read), stores at risk, this month
 * in one row (each a snapshot metric, so small samples show names and
 * missing ones their reason), new and in development, and What needs
 * attention (the daily summary). Ask ZCOM is the floating ask bar. Below
 * them the earnings chart and the stores preview stay as before. Every
 * number is the server's; the page computes none.
 */
export function Home() {
  const { clients, loading: clientsLoading, error: clientsError, refetch, totalCount } = useClients();
  const navigate = useNavigate();
  const { can } = useAuth();
  const now = useMemo(() => new Date(), []);
  const attention = usePlatformAttention();
  const data = attention.data;
  const loading = attention.loading;
  const firstRun = !loading && !attention.error && data != null && !data.computedAt;
  const cells = thisMonthCells(data?.thisMonth);
  const storeNames = useMemo(() => knownStoreNames(data), [data]);

  // PRD-005 FR-5.3: the earnings chart reads the server rollup.
  const yearRange = useMemo(() => ({ startDate: new Date(now.getFullYear(), 0, 1), endDate: now }), [now]);
  const revenue = useRevenueOverview(yearRange);

  return (
    <div className="flex w-full flex-col gap-6">
      <VideoBanner
        eyebrow={`${monthYear.format(now)} · ${plural(totalCount, "store", "stores")}`}
        subline="Here's what needs your attention today."
        action={
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <Button variant="glass" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
              Add store
            </Button>
          ) : undefined
        }
      />

      {attention.error ? (
        <ErrorState
          title="Couldn't load the platform numbers."
          description={toasts.genericError}
          onRetry={() => void attention.refetch()}
        />
      ) : (
        <>
          <SnapshotHeader computedAt={data?.computedAt ?? null} stale={data?.stale ?? false} />
          {firstRun ? <p className="text-body text-fg-muted">{FIRST_SNAPSHOT_COPY}. Money due below is live.</p> : null}

          {loading || data?.moneyDue ? (
            <MoneyDueCard moneyDue={data?.moneyDue ?? null} isLoading={loading} />
          ) : null}

          <AtRiskCard list={data?.atRisk ?? null} isLoading={loading} />

          {loading || cells.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-title-2 text-fg">This month</h2>
              <KpiStrip>
                {loading
                  ? ["mrr", "collected", "outstanding", "new", "lost", "ai"].map((key) => (
                      <MetricCard key={key} metric={null} label=" " bare isLoading />
                    ))
                  : cells.map((cell) => (
                      <MetricCard
                        key={cell.key}
                        metric={cell.metric}
                        label={cell.label}
                        smallSampleThreshold={data?.smallSampleThreshold}
                        bare
                      />
                    ))}
              </KpiStrip>
            </div>
          ) : null}

          <DevelopmentCard list={data?.development ?? null} isLoading={loading} />

          <AttentionSummaryCard
            summary={data?.whatNeedsAttention ?? null}
            storeNames={storeNames}
            isLoading={loading}
          />
        </>
      )}

      <EarningsChart
        monthly={revenue.data.monthly}
        monthlyBilling={revenue.data.billing}
        now={now}
        isLoading={revenue.loading}
      />

      {clientsError ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <ClientsTable clients={clients} isLoading={clientsLoading} previewLimit={10} />
      )}
    </div>
  );
}
