import { useEffect, useState } from "react";
import { IconOrders, IconRevenue, IconStore, IconTrendUp } from "../components/ui/icons";
import { PlanChart } from "../components/dashboard/PlanChart";
import { RevenueChart } from "../components/dashboard/RevenueChart";
import { StatCard } from "../components/dashboard/StatCard";
import { TopClientsTable } from "../components/dashboard/TopClientsTable";
import { PageHeader } from "../components/common/PageHeader";
import {
  dashboardStats,
  planDistribution,
  revenueTrend,
} from "../lib/mockData";
import { formatCurrency, formatNumber } from "../lib/utils";
import { useClients } from "../providers/ClientsProvider";

export function Home() {
  const { clients } = useClients();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Platform-wide overview across all Zcommerce client stores."
        breadcrumbs={[{ label: "Home" }]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(dashboardStats.totalRevenue)}
          change={dashboardStats.totalRevenueChange}
          icon={IconRevenue}
          isLoading={loading}
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={formatCurrency(dashboardStats.mrr)}
          change={dashboardStats.mrrChange}
          icon={IconTrendUp}
          isLoading={loading}
        />
        <StatCard
          title="Total Stores"
          value={formatNumber(dashboardStats.activeClients)}
          change={dashboardStats.activeClientsChange}
          icon={IconStore}
          isLoading={loading}
        />
        <StatCard
          title="Total Orders"
          value={formatNumber(dashboardStats.totalOrders)}
          change={dashboardStats.totalOrdersChange}
          icon={IconOrders}
          isLoading={loading}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart data={revenueTrend} isLoading={loading} />
        </div>
        <PlanChart data={planDistribution} isLoading={loading} />
      </div>

      <div className="mt-4">
        <TopClientsTable clients={clients} isLoading={loading} />
      </div>
    </div>
  );
}
