import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClientsTable } from "../components/clients/ClientsTable";
import { PageHeader } from "../components/common/PageHeader";
import { EarningsChart } from "../components/dashboard/EarningsChart";
import { NeedsAttention } from "../components/dashboard/NeedsAttention";
import { Button, ErrorState, KpiStrip, StatCard, TodaysBrief, useAiEnabled } from "../components/ui";
import { platformBrief } from "../lib/aiSamples";
import { IconAdd, IconHome } from "../components/ui/icons";
import { toasts } from "../copy";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { useRevenueOverview } from "../hooks/use-platform-reports";

const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Home — "Platform overview" (docs/design/04-super-admin.md §3.1). Every number comes from the server rollup. */
export function Home() {
  const { clients, subscriptions, loading: clientsLoading, error: clientsError, refetch, totalCount } = useClients();
  const navigate = useNavigate();
  const { can } = useAuth();
  const now = useMemo(() => new Date(), []);

  // Today's brief (AI flag), written from the same server data as the table below.
  const aiEnabled = useAiEnabled();
  const [briefDismissed, setBriefDismissed] = useState(false);
  const brief = useMemo(
    () => (aiEnabled && !briefDismissed ? platformBrief({ clients, subscriptions }) : null),
    [aiEnabled, briefDismissed, clients, subscriptions],
  );

  // PRD-005 FR-5.3: money comes from the server rollup (root CLAUDE.md §4).
  const yearRange = useMemo(() => ({ startDate: new Date(now.getFullYear(), 0, 1), endDate: now }), [now]);
  const api = useRevenueOverview(yearRange);
  const loading = api.loading;
  const summary = api.data.summary;
  const kpis = {
    earnedMonth: summary.earnedMonth,
    paidStores: summary.paidStoresMonth,
    billableStores: summary.billableStores,
    earnedYear: summary.earnedYear,
    yearDelta:
      summary.earnedLastYearToDate > 0
        ? ((summary.earnedYear - summary.earnedLastYearToDate) / summary.earnedLastYearToDate) * 100
        : null,
    lastYear: now.getFullYear() - 1,
    projected: summary.projectedYear,
    open: {
      amount: summary.outstandingAmount,
      unpaidStores: summary.unpaidStores,
      overdueStores: summary.overdueStores,
    },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        type="page"
        icon={<IconHome aria-hidden />}
        section="blue"
        title="Platform overview"
        description={`${monthYear.format(now)} · ${plural(totalCount, "store", "stores")}`}
        actions={
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
              Add store
            </Button>
          ) : undefined
        }
      />

      {brief ? (
        <TodaysBrief
          lines={brief.lines}
          actions={brief.actions.map((item) => ({ label: item.label, onPress: () => navigate(item.href) }))}
          onDismiss={() => setBriefDismissed(true)}
        />
      ) : null}

      {api.error ? (
        <ErrorState title="Couldn't load the platform numbers." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : (
        <KpiStrip>
          <StatCard
            bare
            label="Earned this month"
            value={kpis.earnedMonth}
            format="money"
            deltaLabel={`${kpis.paidStores} of ${plural(kpis.billableStores, "store", "stores")} paid`}
            isLoading={loading}
          />
          <StatCard
            bare
            label="Earned this year"
            value={kpis.earnedYear}
            format="money"
            delta={kpis.yearDelta}
            deltaLabel={kpis.yearDelta != null ? `vs same period ${kpis.lastYear}` : "Since 1 Jan"}
            isLoading={loading}
          />
          <StatCard
            bare
            label={`Projected for ${now.getFullYear()}`}
            value={kpis.projected}
            format="money"
            deltaLabel="At current monthly billing"
            isLoading={loading}
          />
          <StatCard
            bare
            label="Outstanding"
            value={kpis.open.amount}
            format="money"
            valueTone={kpis.open.amount > 0 ? "danger" : "default"}
            deltaLabel={
              kpis.open.unpaidStores > 0
                ? `${plural(kpis.open.unpaidStores, "store", "stores")} unpaid · ${kpis.open.overdueStores} overdue`
                : "Nothing unpaid"
            }
            isLoading={loading}
          />
        </KpiStrip>
      )}

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 xl:flex-2">
          <EarningsChart monthly={api.data.monthly} monthlyBilling={api.data.billing} now={now} isLoading={loading} />
        </div>
        <div className="min-w-0 xl:flex-1">
          <NeedsAttention clients={clients} subscriptions={subscriptions} now={now} isLoading={clientsLoading} />
        </div>
      </div>

      {clientsError ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <ClientsTable clients={clients} isLoading={clientsLoading} previewLimit={10} />
      )}
    </div>
  );
}
