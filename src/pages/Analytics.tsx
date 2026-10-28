import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { IntegrationHealthTab } from "../components/analytics/IntegrationHealthTab";
import { PerformanceTab } from "../components/analytics/PerformanceTab";
import { StoreSalesTab } from "../components/analytics/StoreSalesTab";
import { SyncMonitorTab } from "../components/analytics/SyncMonitorTab";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";
import { PageHeader } from "../components/common/PageHeader";
import { Card, EmptyState } from "../components/ui";
import { IconAnalytics, IconLock } from "../components/ui/icons";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * Analytics sections: Platform revenue (route "revenue", unchanged), Store sales,
 * and since PRD-012 Performance, Integration health and Sync monitor.
 * Keep this list and `config/navigation.ts` in step.
 */
const sections = ["revenue", "store-sales", "performance", "integrations", "sync"] as const;

type AnalyticsSection = (typeof sections)[number];

export function Analytics() {
  const { section } = useParams<{ section: string }>();
  const { can } = useAuth();

  const active = useMemo(() => {
    if (!section || !(sections as readonly string[]).includes(section)) return null;
    return section as AnalyticsSection;
  }, [section]);

  if (!active) {
    return <Navigate to="/analytics/revenue" replace />;
  }

  // Client-side mirror of the backend guard (`platform:reports:read`); the server still decides.
  if (!can(PLATFORM_PERMISSIONS.REPORTS_READ)) {
    return (
      <div>
        <PageHeader type="page" icon={<IconAnalytics aria-hidden />} section="violet" title="Analytics" />
        <Card>
          <EmptyState
            icon={IconLock}
            title="Reports aren't available to your role"
            description="Ask a platform owner for report access."
          />
        </Card>
      </div>
    );
  }

  if (active === "store-sales") return <StoreSalesTab />;
  if (active === "performance") return <PerformanceTab />;
  if (active === "integrations") return <IntegrationHealthTab />;
  if (active === "sync") return <SyncMonitorTab />;

  // Platform revenue renders its own header: the date control and export share state with the report.
  return <RevenueReportsTab />;
}
