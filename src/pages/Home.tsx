import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClientsTable } from "../components/clients/ClientsTable";
import { EarningsChart } from "../components/dashboard/EarningsChart";
import { NeedsAttention } from "../components/dashboard/NeedsAttention";
import { Button, ErrorState, KpiStrip, StatCard, VideoBanner } from "../components/ui";
import { IconAdd } from "../components/ui/icons";
import { toasts } from "../copy";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { useRevenueOverview } from "../hooks/use-platform-reports";

const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Home (04 S-01): the video banner (no tiles: "OCTOBER 2026 · 3 STORES", the greeting at the bottom left, one glass
 * "+ Add store") → "This month" with Rohit's four figures → Needs your attention (full width) → Earnings → Stores.
 * Every number comes from the server rollup.
 */
export function Home() {
  const { clients, subscriptions, loading: clientsLoading, error: clientsError, refetch, totalCount } = useClients();
  const navigate = useNavigate();
  const { can } = useAuth();
  const now = useMemo(() => new Date(), []);

  // PRD-005 FR-5.3: money comes from the server rollup (root CLAUDE.md §4).
  const yearRange = useMemo(() => ({ startDate: new Date(now.getFullYear(), 0, 1), endDate: now }), [now]);
  const api = useRevenueOverview(yearRange);
  const loading = api.loading;
  const summary = api.data.summary;
  const open = {
    amount: summary.outstandingAmount,
    unpaidStores: summary.unpaidStores,
    overdueStores: summary.overdueStores,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1136px] flex-col gap-6">
      <VideoBanner
        eyebrow={`${monthYear.format(now)} · ${plural(totalCount, "store", "stores")}`}
        subline="Here's how the Zcom business is doing this month."
        action={
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <Button variant="glass" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
              Add store
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title-2 text-fg">This month</h2>
          <span className="text-body text-fg-muted">{monthYear.format(now)}</span>
        </div>
        {api.error ? (
          <ErrorState title="Couldn't load the platform numbers." description={toasts.genericError} onRetry={() => void api.refetch()} />
        ) : (
          <KpiStrip>
            <StatCard
              bare
              label="Earned this month"
              value={summary.earnedMonth}
              format="money"
              deltaLabel={`${summary.paidStoresMonth} of ${plural(summary.billableStores, "store", "stores")} paid`}
              href="/analytics/revenue"
              isLoading={loading}
            />
            <StatCard
              bare
              label="Earned this year"
              value={summary.earnedYear}
              format="money"
              deltaLabel="Since 1 Jan"
              href="/analytics/revenue"
              isLoading={loading}
            />
            <StatCard
              bare
              label={`Projected for ${now.getFullYear()}`}
              value={summary.projectedYear}
              format="money"
              deltaLabel="At current monthly billing"
              href="/analytics/revenue"
              isLoading={loading}
            />
            <StatCard
              bare
              label="Outstanding"
              value={open.amount}
              format="money"
              valueTone={open.amount > 0 && open.overdueStores > 0 ? "danger" : open.amount > 0 ? "warning" : "default"}
              deltaLabel={
                open.unpaidStores > 0
                  ? `${plural(open.unpaidStores, "store", "stores")} unpaid · ${open.overdueStores} overdue`
                  : "Nothing unpaid"
              }
              href="/subscriptions"
              isLoading={loading}
            />
          </KpiStrip>
        )}
      </div>

      <NeedsAttention clients={clients} subscriptions={subscriptions} now={now} isLoading={clientsLoading} />

      <EarningsChart monthly={api.data.monthly} monthlyBilling={api.data.billing} now={now} isLoading={loading} />

      {clientsError ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <ClientsTable clients={clients} isLoading={clientsLoading} previewLimit={10} />
      )}
    </div>
  );
}
