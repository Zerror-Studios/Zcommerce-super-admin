import { endOfDay, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { DaysSwitch, type AnalyticsTabRow } from "../components/analytics/analytics-shared";
import { IntegrationHealthTab } from "../components/analytics/IntegrationHealthTab";
import { PerformanceTab } from "../components/analytics/PerformanceTab";
import { StoreSalesTab } from "../components/analytics/StoreSalesTab";
import { SyncMonitorTab } from "../components/analytics/SyncMonitorTab";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";
import { SnapshotHeader } from "../components/insights/SnapshotHeader";
import { SnapshotTab } from "../components/insights/tabs/SnapshotTab";
import { SNAPSHOT_TABS, isSnapshotTab, isTabAvailable } from "../components/insights/tabs/snapshot-tabs.util";
import { DateRangeComparison, type DateRangeValue } from "../components/common/DateRangeComparison";
import { PageHeader } from "../components/common/PageHeader";
import { Card, EmptyState, SegmentedSwitch, Select, SelectItem, type RowMenuItem, type SegmentedItem } from "../components/ui";
import { IconChartBar, IconExport, IconLock, IconStore, IconStoreHealth } from "../components/ui/icons";
import { DEFAULT_PERFORMANCE_RANGE_DAYS, type PerformanceRangeDays } from "../lib/analytics-health";
import { DEFAULT_METRICS_PERIOD, PERIOD_LABELS, PERIOD_ORDER } from "../lib/platform-insights.util";
import { usePlatformMetrics } from "../hooks/use-platform-insights";
import type { PlatformMetricsPeriod } from "../types/platform-insights";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * Analytics (04 S-05; design v2 §7, boards 67 Revenue, 68 Stores, 70 System). Every view keeps its own route
 * (/analytics/:section). The menu links three of them directly (Revenue → revenue, Stores → store-sales,
 * System → performance; AI usage is the ZCOM AI page at /ai), so the page is three sub-pages, each with its own
 * title ("Analytics · Revenue"), its period control in the title row, Export in ⋯, and a tab row for the other
 * views that belong to it, so nothing is dropped:
 * - Revenue: Platform revenue, Money, AI cost (snapshot).
 * - Stores: Store sales, Merchant sales, Retention, Usage (snapshot).
 * - System: Performance, Integration health, Sync monitor, Platform health (snapshot).
 *
 * PRD-026 FR-7.3: the snapshot views read the nightly platform snapshot (`platformMetrics`) for one period
 * (default this month), each with "Last updated · Refresh now". A snapshot tab shows only when its section came
 * back for this viewer (money needs billing:read, AI cost ai:read; guide §2).
 */
type AnalyticsSection =
  | "revenue"
  | "store-sales"
  | "performance"
  | "integrations"
  | "sync"
  | (typeof SNAPSHOT_TABS)[number]["key"];

type AnalyticsGroup = "revenue" | "stores" | "system";

const SECTION_LABELS: Record<AnalyticsSection, string> = {
  revenue: "Platform revenue",
  "store-sales": "Store sales",
  performance: "Performance",
  integrations: "Integration health",
  sync: "Sync monitor",
  ...(Object.fromEntries(SNAPSHOT_TABS.map((tab) => [tab.key, tab.label])) as Record<(typeof SNAPSHOT_TABS)[number]["key"], string>),
};

const GROUPS: Record<AnalyticsGroup, { title: string; description: string; icon: ReactNode; sections: AnalyticsSection[] }> = {
  revenue: {
    title: "Revenue",
    description: "What stores pay Zcom: bookings, collections, MRR and what AI costs.",
    icon: <IconChartBar aria-hidden />,
    sections: ["revenue", "money", "ai-cost"],
  },
  stores: {
    title: "Stores",
    description: "What stores sell, and how they join, stay and use Zcom.",
    icon: <IconStore aria-hidden />,
    sections: ["store-sales", "merchant-sales", "retention", "usage"],
  },
  system: {
    title: "System",
    description: "Store traffic, app connections, data syncs and platform health.",
    icon: <IconStoreHealth aria-hidden />,
    sections: ["performance", "integrations", "sync", "health"],
  },
};

const groupOf = (section: AnalyticsSection): AnalyticsGroup =>
  (Object.keys(GROUPS) as AnalyticsGroup[]).find((group) => GROUPS[group].sections.includes(section)) ?? "revenue";

const EXPORT_LABELS: Partial<Record<AnalyticsSection, string>> = {
  revenue: "Export revenue by plan (CSV)",
  "store-sales": "Export store sales (CSV)",
  performance: "Export performance (CSV)",
};

const isSection = (value: string | undefined): value is AnalyticsSection => !!value && value in SECTION_LABELS;

/** The live default for Platform revenue: the last six months, to today. */
const defaultRevenueRange = (): DateRangeValue => ({
  startDate: startOfMonth(subMonths(new Date(), 5)),
  endDate: endOfDay(new Date()),
});

export function Analytics() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();

  // Periods live here so they survive a tab switch, and sit in the title row (v2 §4.1).
  const [revenueRange, setRevenueRange] = useState<DateRangeValue>(defaultRevenueRange);
  const [salesDays, setSalesDays] = useState<PerformanceRangeDays>(DEFAULT_PERFORMANCE_RANGE_DAYS);
  const [performanceDays, setPerformanceDays] = useState<PerformanceRangeDays>(DEFAULT_PERFORMANCE_RANGE_DAYS);
  const [metricsPeriod, setMetricsPeriod] = useState<PlatformMetricsPeriod>(DEFAULT_METRICS_PERIOD);

  // PRD-026: one snapshot read for the chosen period; it also decides which snapshot tabs this viewer sees.
  const snapshot = usePlatformMetrics(metricsPeriod);

  // The current tab registers its export; the ⋯ item calls it.
  const exportRef = useRef<(() => void) | null>(null);
  const [canExport, setCanExport] = useState(false);
  const registerExport = useCallback((exporter: (() => void) | null) => {
    exportRef.current = exporter;
    setCanExport(exporter != null);
  }, []);

  const active = isSection(section) ? section : null;
  const group = GROUPS[groupOf(active ?? "revenue")];

  const visibleTabs = useMemo<SegmentedItem<AnalyticsSection>[]>(
    () =>
      group.sections
        .filter((key) => !isSnapshotTab(key) || isTabAvailable(snapshot.data, key))
        .map((key) => ({ value: key, label: SECTION_LABELS[key] })),
    [group, snapshot.data],
  );

  const tabRow = useMemo<AnalyticsTabRow>(
    () =>
      (right?: ReactNode) => {
        const showTabs = visibleTabs.length > 1;
        if (!showTabs && !right) return null;
        return (
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {showTabs ? (
              <SegmentedSwitch
                ariaLabel={`Analytics · ${group.title}`}
                items={visibleTabs}
                value={active ?? "revenue"}
                onChange={(next) => navigate(`/analytics/${next}`)}
                className="min-w-0 max-w-full"
              />
            ) : (
              <span />
            )}
            {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
          </div>
        );
      },
    [active, group.title, navigate, visibleTabs],
  );

  if (!active) {
    return <Navigate to="/analytics/revenue" replace />;
  }

  const canRead = can(PLATFORM_PERMISSIONS.REPORTS_READ);

  // The period control of the current view: the one secondary control in the title row.
  let period: ReactNode = null;
  if (canRead) {
    if (active === "revenue") {
      period = <DateRangeComparison value={revenueRange} onChange={setRevenueRange} />;
    } else if (active === "store-sales") {
      period = <DaysSwitch value={salesDays} onChange={setSalesDays} />;
    } else if (active === "performance") {
      period = <DaysSwitch value={performanceDays} onChange={setPerformanceDays} />;
    } else if (isSnapshotTab(active)) {
      period = (
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
          {PERIOD_ORDER.map((key) => (
            <SelectItem key={key}>{PERIOD_LABELS[key]}</SelectItem>
          ))}
        </Select>
      );
    }
  }

  const exportLabel = EXPORT_LABELS[active];
  const more: RowMenuItem[] | undefined =
    exportLabel && canRead
      ? [{ key: "export", label: exportLabel, icon: IconExport, disabled: !canExport, onSelect: () => exportRef.current?.() }]
      : undefined;

  const header = (
    <PageHeader
      type="page"
      icon={group.icon}
      title={`Analytics · ${group.title}`}
      description={group.description}
      actions={period ?? undefined}
      more={more}
      moreLabel={`More ${group.title.toLowerCase()} actions`}
    />
  );

  // Client-side mirror of the backend guard (`platform:reports:read`); the server still decides.
  if (!canRead) {
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
        {tabRow(<SnapshotHeader computedAt={snapshot.data?.computedAt} stale={snapshot.data?.stale ?? false} />)}
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
    content = <StoreSalesTab tabRow={tabRow} registerExport={registerExport} days={salesDays} />;
  } else if (active === "performance") {
    content = <PerformanceTab tabRow={tabRow} registerExport={registerExport} days={performanceDays} />;
  } else if (active === "integrations") {
    content = <IntegrationHealthTab tabRow={tabRow} />;
  } else if (active === "sync") {
    content = <SyncMonitorTab tabRow={tabRow} />;
  } else {
    content = <RevenueReportsTab tabRow={tabRow} registerExport={registerExport} range={revenueRange} />;
  }

  return (
    <div className="w-full">
      {header}
      {content}
    </div>
  );
}
