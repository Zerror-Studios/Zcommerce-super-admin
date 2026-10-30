import { endOfDay, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { AnalyticsTabRow } from "../components/analytics/analytics-shared";
import { IntegrationHealthTab } from "../components/analytics/IntegrationHealthTab";
import { PerformanceTab } from "../components/analytics/PerformanceTab";
import { StoreSalesTab } from "../components/analytics/StoreSalesTab";
import { SyncMonitorTab } from "../components/analytics/SyncMonitorTab";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";
import type { DateRangeValue } from "../components/common/DateRangeComparison";
import { PageHeader } from "../components/common/PageHeader";
import { Button, Card, EmptyState, SegmentedSwitch, type SegmentedItem } from "../components/ui";
import { IconChartBar, IconDownload, IconLock } from "../components/ui/icons";
import { DEFAULT_PERFORMANCE_RANGE_DAYS, type PerformanceRangeDays } from "../lib/analytics-health";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * Analytics (04 S-05): one page, one header, five tabs. Each tab keeps its own route (/analytics/revenue,
 * store-sales, performance, integrations, sync), so switching tabs changes the URL while the header stays.
 * The period control sits on the right of the tab row; Export (Platform revenue, Store sales, Performance)
 * exports the current tab and period.
 */
const TABS: SegmentedItem<AnalyticsSection>[] = [
  { value: "revenue", label: "Platform revenue" },
  { value: "store-sales", label: "Store sales" },
  { value: "performance", label: "Performance" },
  { value: "integrations", label: "Integration health" },
  { value: "sync", label: "Sync monitor" },
];

type AnalyticsSection = "revenue" | "store-sales" | "performance" | "integrations" | "sync";

const EXPORTABLE = new Set<AnalyticsSection>(["revenue", "store-sales", "performance"]);

const isSection = (value: string | undefined): value is AnalyticsSection => TABS.some((tab) => tab.value === value);

/** The live default for Platform revenue: the last six months, to today. */
const defaultRevenueRange = (): DateRangeValue => ({
  startDate: startOfMonth(subMonths(new Date(), 5)),
  endDate: endOfDay(new Date()),
});

export function Analytics() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();

  // Periods live here so they survive a tab switch.
  const [revenueRange, setRevenueRange] = useState<DateRangeValue>(defaultRevenueRange);
  const [salesDays, setSalesDays] = useState<PerformanceRangeDays>(DEFAULT_PERFORMANCE_RANGE_DAYS);
  const [performanceDays, setPerformanceDays] = useState<PerformanceRangeDays>(DEFAULT_PERFORMANCE_RANGE_DAYS);

  // The current tab registers its export; the header button calls it.
  const exportRef = useRef<(() => void) | null>(null);
  const [canExport, setCanExport] = useState(false);
  const registerExport = useCallback((exporter: (() => void) | null) => {
    exportRef.current = exporter;
    setCanExport(exporter != null);
  }, []);

  const active = isSection(section) ? section : null;

  const tabRow = useMemo<AnalyticsTabRow>(
    () =>
      (right?: ReactNode) => (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SegmentedSwitch
            ariaLabel="Analytics"
            items={TABS}
            value={active ?? "revenue"}
            onChange={(next) => navigate(`/analytics/${next}`)}
            className="max-w-full"
          />
          {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
        </div>
      ),
    [active, navigate],
  );

  if (!active) {
    return <Navigate to="/analytics/revenue" replace />;
  }

  const header = (
    <PageHeader
      type="page"
      icon={<IconChartBar aria-hidden />}
      section="amber"
      title="Analytics"
      description="Revenue, store sales, performance and data syncs across every store."
      actions={
        EXPORTABLE.has(active) && can(PLATFORM_PERMISSIONS.REPORTS_READ) ? (
          <Button
            variant="secondary"
            startIcon={<IconDownload aria-hidden />}
            isDisabled={!canExport}
            onPress={() => exportRef.current?.()}
          >
            Export
          </Button>
        ) : undefined
      }
    />
  );

  // Client-side mirror of the backend guard (`platform:reports:read`); the server still decides.
  if (!can(PLATFORM_PERMISSIONS.REPORTS_READ)) {
    return (
      <div>
        {header}
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

  let content: ReactNode;
  if (active === "store-sales") {
    content = <StoreSalesTab tabRow={tabRow} registerExport={registerExport} days={salesDays} onDaysChange={setSalesDays} />;
  } else if (active === "performance") {
    content = (
      <PerformanceTab tabRow={tabRow} registerExport={registerExport} days={performanceDays} onDaysChange={setPerformanceDays} />
    );
  } else if (active === "integrations") {
    content = <IntegrationHealthTab tabRow={tabRow} />;
  } else if (active === "sync") {
    content = <SyncMonitorTab tabRow={tabRow} />;
  } else {
    content = <RevenueReportsTab tabRow={tabRow} registerExport={registerExport} range={revenueRange} onRangeChange={setRevenueRange} />;
  }

  return (
    <div className="mx-auto w-full max-w-content">
      {header}
      {content}
    </div>
  );
}
