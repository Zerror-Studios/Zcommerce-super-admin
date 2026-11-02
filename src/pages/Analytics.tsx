import { endOfDay, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { AnalyticsTabRow } from "../components/analytics/analytics-shared";
import { IntegrationHealthTab } from "../components/analytics/IntegrationHealthTab";
import { PerformanceTab } from "../components/analytics/PerformanceTab";
import { StoreSalesTab } from "../components/analytics/StoreSalesTab";
import { SyncMonitorTab } from "../components/analytics/SyncMonitorTab";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";
import { SnapshotHeader } from "../components/insights/SnapshotHeader";
import { SnapshotTab } from "../components/insights/tabs/SnapshotTab";
import { SNAPSHOT_TABS, isSnapshotTab, isTabAvailable } from "../components/insights/tabs/snapshot-tabs.util";
import type { DateRangeValue } from "../components/common/DateRangeComparison";
import { PageHeader } from "../components/common/PageHeader";
import { Button, Card, EmptyState, SegmentedSwitch, Select, SelectItem, type SegmentedItem } from "../components/ui";
import { IconChartBar, IconDownload, IconLock } from "../components/ui/icons";
import { DEFAULT_PERFORMANCE_RANGE_DAYS, type PerformanceRangeDays } from "../lib/analytics-health";
import { DEFAULT_METRICS_PERIOD, PERIOD_LABELS, PERIOD_ORDER } from "../lib/platform-insights.util";
import { usePlatformMetrics } from "../hooks/use-platform-insights";
import type { PlatformMetricsPeriod } from "../types/platform-insights";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * Analytics (04 S-05): one page, one header, one tab row. Each tab keeps its own route (/analytics/revenue,
 * store-sales, performance, integrations, sync), so switching tabs changes the URL while the header stays.
 * The period control sits on the right of the tab row; Export (Platform revenue, Store sales, Performance)
 * exports the current tab and period.
 *
 * PRD-026 FR-7.3: six more tabs read the nightly platform snapshot (`platformMetrics`) for one period
 * (default this month): Money, Retention, Platform health, Usage, Merchant sales and AI cost, each with
 * "Last updated · Refresh now". A tab shows only when its section came back for this viewer (money needs
 * billing:read, AI cost ai:read; guide §2); its URL otherwise explains why.
 */
const BASE_TABS: SegmentedItem<AnalyticsSection>[] = [
  { value: "revenue", label: "Platform revenue" },
  { value: "store-sales", label: "Store sales" },
  { value: "performance", label: "Performance" },
  { value: "integrations", label: "Integration health" },
  { value: "sync", label: "Sync monitor" },
];

const SNAPSHOT_TAB_ITEMS: SegmentedItem<AnalyticsSection>[] = SNAPSHOT_TABS.map((tab) => ({
  value: tab.key,
  label: tab.label,
}));

const TABS: SegmentedItem<AnalyticsSection>[] = [...BASE_TABS, ...SNAPSHOT_TAB_ITEMS];

type AnalyticsSection =
  | "revenue"
  | "store-sales"
  | "performance"
  | "integrations"
  | "sync"
  | (typeof SNAPSHOT_TABS)[number]["key"];

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
  const [metricsPeriod, setMetricsPeriod] = useState<PlatformMetricsPeriod>(DEFAULT_METRICS_PERIOD);

  // PRD-026: one snapshot read for the chosen period; it also decides which snapshot tabs this viewer sees.
  const snapshot = usePlatformMetrics(metricsPeriod);
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => !isSnapshotTab(tab.value) || isTabAvailable(snapshot.data, tab.value)),
    [snapshot.data],
  );

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
            items={visibleTabs}
            value={active ?? "revenue"}
            onChange={(next) => navigate(`/analytics/${next}`)}
            className="min-w-0 max-w-full"
          />
          {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
        </div>
      ),
    [active, navigate, visibleTabs],
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
      description="Revenue, store sales, performance, data syncs and the nightly platform snapshot across every store."
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
  if (isSnapshotTab(active)) {
    content = (
      <>
        {tabRow(
          <>
            <SnapshotHeader computedAt={snapshot.data?.computedAt} stale={snapshot.data?.stale ?? false} />
            <Select
              aria-label="Period"
              size="sm"
              className="w-44"
              selectedKeys={new Set([metricsPeriod])}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (typeof value === "string") setMetricsPeriod(value as PlatformMetricsPeriod);
              }}
            >
              {PERIOD_ORDER.map((period) => (
                <SelectItem key={period}>{PERIOD_LABELS[period]}</SelectItem>
              ))}
            </Select>
          </>,
        )}
        <SnapshotTab
          tab={active}
          snapshot={snapshot.data}
          loading={snapshot.loading}
          error={snapshot.error}
          onRetry={() => void snapshot.refetch()}
        />
      </>
    );
  } else if (active === "store-sales") {
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
