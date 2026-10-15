import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClientsTable } from "../components/clients/ClientsTable";
import { PageHeader } from "../components/common/PageHeader";
import { EarningsChart } from "../components/dashboard/EarningsChart";
import { NeedsAttention } from "../components/dashboard/NeedsAttention";
import { Button, KpiStrip, StatCard } from "../components/ui";
import { IconAdd } from "../components/ui/icons";
import {
  earnedIn,
  isBillable,
  monthPeriod,
  outstanding,
  projectedForYear,
  storesPaidIn,
  yearPeriod,
} from "../lib/metrics";
import { subscriptions, transactions } from "../lib/mockData";
import { loadPlatformSettings } from "../lib/platformSettings";
import { useClients } from "../providers/ClientsProvider";

const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Home — "Platform overview" (docs/design/04-super-admin.md §3.1). Every number comes from lib/metrics. */
export function Home() {
  const { clients } = useClients();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const platformGraceDays = useMemo(() => loadPlatformSettings().gracePeriodDays, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  const kpis = useMemo(() => {
    const month = monthPeriod(now);
    const year = yearPeriod(now, "calendar");
    const yearToDate = { start: year.start, end: now };
    const lastYearToDate = {
      start: new Date(year.start.getFullYear() - 1, 0, 1),
      end: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()),
    };
    const earnedLastYear = earnedIn(transactions, lastYearToDate);
    const earnedYear = earnedIn(transactions, yearToDate);
    return {
      earnedMonth: earnedIn(transactions, month),
      paidStores: storesPaidIn(transactions, month),
      billableStores: clients.filter(isBillable).length,
      earnedYear,
      // Only shown when last year has payments to compare with.
      yearDelta: earnedLastYear > 0 ? ((earnedYear - earnedLastYear) / earnedLastYear) * 100 : null,
      lastYear: now.getFullYear() - 1,
      projected: projectedForYear(clients, transactions, now, "calendar"),
      open: outstanding({ clients, subscriptions, transactions }, now),
    };
  }, [clients, now]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform overview"
        description={`${monthYear.format(now)} · ${plural(clients.length, "store", "stores")}`}
        actions={
          <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
            Add store
          </Button>
        }
      />

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

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 xl:flex-2">
          <EarningsChart clients={clients} transactions={transactions} now={now} isLoading={loading} />
        </div>
        <div className="min-w-0 xl:flex-1">
          <NeedsAttention
            clients={clients}
            subscriptions={subscriptions}
            transactions={transactions}
            platformGraceDays={platformGraceDays}
            now={now}
            isLoading={loading}
          />
        </div>
      </div>

      <ClientsTable clients={clients} isLoading={loading} previewLimit={10} />
    </div>
  );
}
