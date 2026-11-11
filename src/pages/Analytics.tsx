import { endOfDay, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { type AnalyticsTabRow } from "../components/analytics/analytics-shared";
import { STORES_MAX_WINDOW_DAYS, isStoresSubTab, type StoresSubTab } from "../components/analytics/analytics-tab.util";
import { IntegrationHealthTab } from "../components/analytics/IntegrationHealthTab";
import { StoresTab } from "../components/analytics/StoresTab";
import { SyncMonitorTab } from "../components/analytics/SyncMonitorTab";
import { RevenueReportsTab } from "../components/billing/RevenueReportsTab";
import { SnapshotHeader } from "../components/insights/SnapshotHeader";
import { SnapshotTab } from "../components/insights/tabs/SnapshotTab";
import { SNAPSHOT_TABS, isSnapshotTab, isTabAvailable } from "../components/insights/tabs/snapshot-tabs.util";
import { DateRangeComparison, type DateRangeValue } from "../components/common/DateRangeComparison";
import { DateRangePicker, useUrlDateRange, type DateRangePreset } from "../components/ui/DateRangePicker";
import { PageHeader } from "../components/common/PageHeader";
import { Card, EmptyState, Select, SelectItem, type RowMenuItem } from "../components/ui";
import { IconChartBar, IconExport, IconLock, IconStore, IconStoreHealth } from "../components/ui/icons";
import { DEFAULT_METRICS_PERIOD, PERIOD_LABELS, PERIOD_ORDER } from "../lib/platform-insights.util";
import { usePlatformMetrics } from "../hooks/use-platform-insights";
import type { PlatformMetricsPeriod } from "../types/platform-insights";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";

/**
 * Analytics (04 S-05; design v2 §7, boards 67 Revenue, 68 Stores, 70 System). Every view keeps its own route
 * (/analytics/:section). The menu links two of them directly (Revenue → revenue, Stores → store-sales; AI usage is
 * the ZCOM AI page at /ai), each with its own title ("Analytics · Revenue"), its period control in the title row and
 * Export in ⋯. The other views of each page open from its ⋯ ("Open Money", …) and keep their URLs:
 * - Revenue: Platform revenue, Money, AI cost (snapshot).
 * - Stores: Stores (Overview · Top stores · Needs a look, `?tab=`), Merchant sales, Retention, Usage (snapshot).
 * - System health views: Integration health, Sync monitor, Platform health (snapshot); the menu's System health
 *   page links them from its ⋯.
 *
 * Analytics Level 1 §3.7/§3.8 (2026-11-11): the "System" analytics item is gone (it was store performance, not
 * system health); its Performance view is merged into Stores, and /analytics/performance redirects to Stores ›
 * Overview. Stores uses the shared date picker (no more 7 · 30 · 90 day pills).
 *
 * PRD-026 FR-7.3: the snapshot views read the nightly platform snapshot (`platformMetrics`) for one period
 * (default this month), each with "Last updated · Refresh now". A snapshot tab shows only when its section came
 * back for this viewer (money needs billing:read, AI cost ai:read; guide §2).
 */
type AnalyticsSection =
  | "revenue"
  | "store-sales"
  | "integrations"
  | "sync"
  | (typeof SNAPSHOT_TABS)[number]["key"];

type AnalyticsGroup = "revenue" | "stores" | "system";

const SECTION_LABELS: Record<AnalyticsSection, string> = {
  revenue: "Platform revenue",
  "store-sales": "Stores",
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
    description: "Store sales and visits from the nightly store snapshot · a store shows after its first snapshot",
    icon: <IconStore aria-hidden />,
    sections: ["store-sales", "merchant-sales", "retention", "usage"],
  },
  // Not an Analytics menu item any more (§3.7): these views open from System health's ⋯ and light that item.
  system: {
    title: "System health",
    description: "App connections, data syncs and the platform snapshot.",
    icon: <IconStoreHealth aria-hidden />,
    sections: ["integrations", "sync", "health"],
  },
};

const groupOf = (section: AnalyticsSection): AnalyticsGroup =>
  (Object.keys(GROUPS) as AnalyticsGroup[]).find((group) => GROUPS[group].sections.includes(section)) ?? "revenue";

const EXPORT_LABELS: Partial<Record<AnalyticsSection, string>> = {
  revenue: "Export revenue by plan (CSV)",
  "store-sales": "Export store sales (CSV)",
};

const isSection = (value: string | undefined): value is AnalyticsSection => !!value && value in SECTION_LABELS;

/** Stores' picker: the windows its two queries take (1 to 366 days, complete days; today has no figures yet). */
const STORES_PRESETS: DateRangePreset[] = ["yesterday", "last7", "last30", "thisMonth", "lastMonth", "thisQuarter", "thisYear", "custom"];

/** Old System analytics routes (§3.8): Performance is Stores › Overview now. */
const LEGACY_SECTIONS: Record<string, string> = { performance: "store-sales" };

/** The live default for Platform revenue: the last six months, to today. */
const defaultRevenueRange = (): DateRangeValue => ({
  startDate: startOfMonth(subMonths(new Date(), 5)),
  endDate: endOfDay(new Date()),
});

export function Analytics() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Periods live here so they survive a tab switch, and sit in the title row (v2 §4.1).
  const [revenueRange, setRevenueRange] = useState<DateRangeValue>(defaultRevenueRange);
  // Stores: the shared date picker, in the URL (?from=&to=) and remembered; the queries take any 1–366 day window.
  const [storesRange, setStoresRange] = useUrlDateRange({ defaultPreset: "last30", storageKey: "console-analytics-stores" });
  const storesDayRange = useMemo(() => ({ startDate: storesRange.from, endDate: storesRange.to }), [storesRange.from, storesRange.to]);
  const storesMinDate = useMemo(() => startOfDay(subDays(new Date(), STORES_MAX_WINDOW_DAYS - 1)), []);
  const tabParam = searchParams.get("tab");
  const storesTab: StoresSubTab = isStoresSubTab(tabParam) ? tabParam : "overview";
  const selectStoresTab = useCallback(
    (next: StoresSubTab) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === "overview") params.delete("tab");
          else params.set("tab", next);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
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

  // The group's other views this viewer may open (a snapshot view only when its section came back).
  const otherViews = useMemo(
    () => group.sections.filter((key) => key !== active && (!isSnapshotTab(key) || isTabAvailable(snapshot.data, key))),
    [active, group, snapshot.data],
  );

  // Round 2 §6.4: no sub-tab row; only the tab's own right-hand controls (Last updated · Refresh now…).
  const tabRow = useMemo<AnalyticsTabRow>(
    () => (right?: ReactNode) =>
      right ? <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{right}</div> : null,
    [],
  );

  const legacy = section ? LEGACY_SECTIONS[section] : undefined;
  if (legacy) {
    // §3.8: keep the query (a range) and the hash; Performance had no sub-tabs, so it opens on Overview.
    const params = new URLSearchParams(location.search);
    params.delete("tab");
    const search = params.toString();
    return <Navigate to={`/analytics/${legacy}${search ? `?${search}` : ""}${location.hash}`} replace />;
  }

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
      // Always compared with the window before it (the server's `previous`), so no compare switch.
      period = (
        <DateRangePicker
          value={storesRange}
          onChange={(next) => setStoresRange({ ...next, compare: "none" })}
          presets={STORES_PRESETS}
          compareModes={[]}
          minDate={storesMinDate}
        />
      );
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

  const exportLabel = active === "store-sales" && storesTab === "overview" ? "Export daily trend (CSV)" : EXPORT_LABELS[active];
  const moreItems: RowMenuItem[] = [
    ...(exportLabel && canRead
      ? [{ key: "export", label: exportLabel, icon: IconExport, disabled: !canExport, onSelect: () => exportRef.current?.() }]
      : []),
    ...(canRead
      ? otherViews.map((key) => ({ key: `view-${key}`, label: `Open ${SECTION_LABELS[key]}`, icon: IconChartBar, onSelect: () => navigate(`/analytics/${key}`) }))
      : []),
  ];
  const more = moreItems.length ? moreItems : undefined;
  // The group's first view is the menu's page; the others name themselves ("Analytics · Revenue · Money").
  // System health's views sit under that menu item: "System health · Sync monitor".
  const title =
    group === GROUPS.system
      ? `${group.title} · ${SECTION_LABELS[active]}`
      : active === group.sections[0]
        ? `Analytics · ${group.title}`
        : `Analytics · ${group.title} · ${SECTION_LABELS[active]}`;

  const header = (
    <PageHeader
      type="page"
      icon={group.icon}
      title={title}
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
    content = (
      <StoresTab
        tabRow={tabRow}
        registerExport={registerExport}
        range={storesDayRange}
        subTab={storesTab}
        onSubTabChange={selectStoresTab}
      />
    );
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
