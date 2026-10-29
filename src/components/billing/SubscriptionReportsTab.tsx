import { endOfDay, format, startOfDay, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlanName, SubscriptionHealthBucket } from "../../types";
import { getPlanLabel, PLAN_NAMES } from "../../lib/display-labels.util";
import { collectionsPlanIdForTier, latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { useClients } from "../../providers/ClientsProvider";
import { useCollections } from "../../hooks/use-platform-reports";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { paymentState } from "../../lib/storeStatus";
import type { ReportDrillFilter, ShopReportRow } from "../../types/reports";
import { formatDate } from "../../lib/utils";
import {
  DateRangeComparison,
  type DateRangeValue,
} from "../common/DateRangeComparison";
import { AppliedFilters } from "../common/AppliedFilters";
import { FilterEmpty } from "../common/FilterEmpty";
import { PageHeader } from "../common/PageHeader";
import { TableToolbar } from "../common/TableToolbar";
import { IconBilling, IconDownload } from "../ui/icons";
import { useUrlSearch } from "../../hooks/use-url-search";
import {
  Button as UiButton,
  Chip,
  DataTable,
  TablePagination,
  usePersistentColumns,
  useTableUrlState,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  KpiStrip,
  Select,
  SelectItem,
  StatCard,
  cx,
  formatCount,
  formatMoney,
  formatPercent,
  toneTextClasses,
} from "../ui";
import type { Tone } from "../ui";
import { toasts } from "../../copy";

// Today, when the page loaded; the server judges every row against its own clock.
const AS_OF = new Date();

const defaultRange: DateRangeValue = {
  startDate: startOfMonth(AS_OF),
  endDate: endOfDay(AS_OF),
};

const shopColumns = [
  { key: "storeName", label: "Store" },
  { key: "plan", label: "Plan / fee" },
  { key: "payment", label: "Payment" },
  { key: "health", label: "Health" },
  { key: "lastPaymentDate", label: "Last payment" },
  { key: "nextDueDate", label: "Next due" },
  { key: "amountDue", label: "Amount due" },
  { key: "daysOverdue", label: "Days overdue" },
];

/** Health is still available but hidden by default (docs/design/04-super-admin.md §3.5 column list). */
const defaultShopColumns = shopColumns.map((c) => c.key).filter((key) => key !== "health");

const shopCsvColumns = [
  { key: "storeName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "health", label: "Health" },
  { key: "lastPaymentDate", label: "Last payment" },
  { key: "nextDueDate", label: "Next due" },
  { key: "amountDue", label: "Amount due" },
  { key: "daysOverdue", label: "Days overdue" },
];

const rightAligned = new Set(["amountDue", "daysOverdue"]);

const shopTableColumns: DataTableColumn[] = shopColumns.map((c) => ({
  ...c,
  align: rightAligned.has(c.key) ? "end" : undefined,
}));

/** subscriptionHealth buckets → the one health wording used everywhere (Healthy / At risk / Critical). */
const healthDisplay: Record<SubscriptionHealthBucket, { label: string; tone: Tone }> = {
  healthy: { label: "Healthy", tone: "success" },
  at_risk: { label: "At risk", tone: "warning" },
  unhealthy: { label: "Critical", tone: "danger" },
};

/** The KPI drill-downs that used to be cards, now in Filter › Show (and on the KPI cells). */
const drillLabels: Record<ReportDrillFilter, string> = {
  all: "Everything",
  healthy: "Healthy",
  at_risk: "At risk",
  unhealthy: "Critical",
  paid_month: "Paid in this period",
  pending: "Payment due",
  overdue: "Overdue",
  overdue_grace: "Overdue, in grace period",
  renewals_7: "Renews within 7 days",
  renewals_30: "Renews within 30 days",
  churned_month: "Cancelled",
  new_month: "New",
  expected: "Expected",
};

const drillOptions: ReportDrillFilter[] = ["all", "pending", "overdue", "overdue_grace", "renewals_7", "renewals_30", "churned_month"];

const planOptions = ["all", ...PLAN_NAMES] as const;

function isDrill(value: string | null): value is ReportDrillFilter {
  return value != null && value in drillLabels;
}

const muted = <span className="text-fg-subtle">—</span>;

export function SubscriptionReportsTab() {
  const navigate = useNavigate();
  const { subscriptions, plans: planList } = useClients();
  const [range, setRangeState] = useState<DateRangeValue>(defaultRange);
  // Drill-down, plan, health, search and page live in the URL (docs/design/09-settings-and-scale.md §3.1).
  const table = useTableUrlState();
  // The rollup runs on the server: the URL (and the query) see the search once typing stops (review C-M6).
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const planParam = table.filters.plan;
  const plan: PlanName | "all" = planParam && (PLAN_NAMES as readonly string[]).includes(planParam) ? (planParam as PlanName) : "all";
  const healthParam = table.filters.health;
  const health: SubscriptionHealthBucket | "all" =
    healthParam && healthParam in healthDisplay ? (healthParam as SubscriptionHealthBucket) : "all";
  const setPlan = (value: PlanName | "all") => table.setFilter("plan", value === "all" ? undefined : value);
  const setHealth = (value: SubscriptionHealthBucket | "all") => table.setFilter("health", value === "all" ? undefined : value);
  const setRange = (next: DateRangeValue) => {
    setRangeState(next);
    table.setPage(1);
  };
  const [visibleShopColumns, setVisibleShopColumns] = usePersistentColumns("collections-stores", defaultShopColumns);

  const showParam = table.filters.show ?? null;
  const drill: ReportDrillFilter = isDrill(showParam) ? showParam : "all";

  const setDrill = (show: ReportDrillFilter) => table.setFilter("show", show === "all" ? undefined : show);

  // PRD-005 FR-5.3: the server applies the range, filters and drill.
  const api = useCollections({
    startDate: range.startDate,
    endDate: range.endDate,
    drill,
    search: table.search,
    // PRD-024 FR-1.2, FR-2.3: the server resolves any version id to its tier and compares tiers.
    planId: plan === "all" ? null : collectionsPlanIdForTier(plan, subscriptions, planList),
    health,
  });
  const loading = api.loading;
  const error = api.error;
  const overview = error ? null : (api.data?.overview ?? null);
  const shopRows = api.data?.shopRows ?? [];

  // KPI strip (PRD-024 FR-2.3): every cell is the server's figure for one range. Due = invoices due in the range;
  // Collected = what those invoices were paid (and its share); Received = payments received in the range,
  // whatever invoice they paid; Open and Overdue = the range's unpaid invoices. Nothing is added up here.
  const kpis = useMemo(() => {
    if (!overview) return null;
    const hasDue = overview.expectedRevenue > 0;
    const previousHasDue = overview.previousMonth.expectedAmount > 0;
    return {
      due: overview.expectedRevenue,
      collected: overview.collectedRevenue,
      rate: hasDue ? overview.collectedPercent : null,
      rateDelta:
        hasDue && previousHasDue ? overview.collectedPercent - overview.previousMonth.collectedPercent : null,
      received: overview.paidThisMonth,
      pending: overview.pendingPayments,
      overdue: overview.overduePayments,
    };
  }, [overview]);

  const subscriptionByClient = useMemo(() => latestSubscriptionByClient(subscriptions), [subscriptions]);

  const pageCount = Math.max(1, Math.ceil(shopRows.length / table.pageSize));
  const safePage = Math.min(table.page, pageCount);
  const pageItems = shopRows.slice((safePage - 1) * table.pageSize, safePage * table.pageSize);

  const isThisMonth =
    startOfDay(range.startDate).getTime() === startOfMonth(AS_OF).getTime();
  const hasFilters = plan !== "all" || health !== "all" || drill !== "all" || table.search.trim() !== "";
  const clearFilters = () => {
    setSearch("");
    // One URL write.
    table.setParams({ plan: undefined, health: undefined, show: undefined, q: undefined });
  };

  const exportCsv = () => {
    const csv = rowsToCsv(
      shopRows.map((r) => ({
        ...r,
        plan: getPlanLabel(r.plan),
        health: healthDisplay[r.health].label,
        lastPaymentDate: r.lastPaymentDate ? formatDate(r.lastPaymentDate) : "",
        nextDueDate: r.nextDueDate ? formatDate(r.nextDueDate) : "",
      })),
      shopCsvColumns,
    );
    downloadCsv("collections-stores.csv", csv);
  };

  const header = (
    <PageHeader
      type="list"
      icon={<IconBilling aria-hidden />}
      section="green"
      title="Collections"
      description={
        kpis
          ? `${formatMoney(kpis.due, { whole: true })} due · ${kpis.rate != null ? `${formatPercent(kpis.rate, 0)} of it collected` : "no invoices due"} · ${formatCount(kpis.overdue.count)} overdue`
          : "What stores owe and have paid for this period"
      }
      actions={
        <>
          <DateRangeComparison value={range} onChange={setRange} />
          <UiButton variant="ghost" startIcon={<IconDownload aria-hidden />} onPress={exportCsv}>
            Export CSV
          </UiButton>
        </>
      }
    />
  );

  if (error) {
    return (
      <div>
        {header}
        <ErrorState
          className="rounded-card border border-line bg-surface"
          title="Couldn't load collections."
          description={toasts.genericError}
          onRetry={() => void api.refetch()}
        />
      </div>
    );
  }

  const kpiCellClass = (active: boolean) => (active ? "bg-surface-muted" : undefined);

  const renderShopCell = (row: ShopReportRow, key: string) => {
    switch (key) {
      case "storeName":
        return (
          <div className="min-w-0 max-w-64">
            <p className="truncate whitespace-nowrap font-medium text-fg">{row.storeName}</p>
            <p className="truncate text-caption text-fg-subtle">{row.ownerEmail}</p>
          </div>
        );
      case "plan":
        return (
          <div className="whitespace-nowrap">
            <p className="text-fg">{getPlanLabel(row.plan)}</p>
            <p className="text-caption text-fg-subtle num">
              {row.mrr > 0 ? `${formatMoney(row.mrr, { whole: true })} / month` : "No fee"}
            </p>
          </div>
        );
      case "payment": {
        const state = paymentState(subscriptionByClient.get(row.clientId));
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Chip tone={state.tone}>{state.label}</Chip>
            {state.detail ? <span className="text-caption text-fg-subtle">{state.detail}</span> : null}
          </div>
        );
      }
      case "health": {
        const display = healthDisplay[row.health];
        return (
          <Chip tone={display.tone} title={row.healthReason}>
            {row.isOverdueInGrace ? `${display.label} · in grace` : display.label}
          </Chip>
        );
      }
      case "lastPaymentDate":
      case "nextDueDate":
        return row[key] ? <span className="whitespace-nowrap num">{formatDate(row[key] as string)}</span> : muted;
      case "amountDue":
        return row.amountDue > 0 ? <span className="block text-right num">{formatMoney(row.amountDue, { whole: true })}</span> : <span className="block text-right text-fg-subtle">—</span>;
      case "daysOverdue":
        return row.daysOverdue > 0 ? (
          <span className={cx("block text-right font-medium num", toneTextClasses.danger)}>{formatCount(row.daysOverdue)}</span>
        ) : (
          <span className="block text-right text-fg-subtle">—</span>
        );
      default:
        return String(row[key as keyof ShopReportRow] ?? "—");
    }
  };

  const emptyContent = hasFilters ? (
    <FilterEmpty things="stores" query={table.search} onClear={clearFilters} />
  ) : (
    <EmptyState icon={IconBilling} title="No stores yet" description="Stores appear here once they are on a plan." />
  );

  // Owner 2026-10-29: the invoices behind a figure are on the Invoices page (one invoice list, not two),
  // filtered to the same due-date range; payments received are on Transactions.
  const period = `from=${format(range.startDate, "yyyy-MM-dd")}&to=${format(range.endDate, "yyyy-MM-dd")}`;
  const invoicesHref = (status: string) => `/billing/invoices?status=${status}&${period}`;

  const currentDrillOptions = drillOptions.includes(drill) ? drillOptions : [...drillOptions, drill];

  return (
    <div>
      {header}

      <div className="space-y-4">
        <KpiStrip className="overflow-hidden">
          <StatCard
            bare
            label={isThisMonth ? "Due this month" : "Due in this period"}
            value={kpis?.due ?? 0}
            format="money"
            deltaLabel="Invoices due in this period (void excluded)"
            isLoading={loading}
            href="?"
            className={kpiCellClass(drill === "all")}
          />
          <StatCard
            bare
            label={kpis?.rate != null ? `Collected · ${formatPercent(kpis.rate, 0)}` : "Collected"}
            value={kpis?.collected ?? 0}
            format="money"
            delta={kpis?.rateDelta}
            deltaUnit="pts"
            deltaLabel={kpis?.rateDelta != null ? "of due invoices, vs previous period" : "Paid of the invoices due"}
            isLoading={loading}
            href={invoicesHref("PAID")}
          />
          <StatCard
            bare
            label="Received"
            value={kpis?.received.amount ?? 0}
            format="money"
            deltaLabel={
              kpis
                ? `${formatCount(kpis.received.count)} ${kpis.received.count === 1 ? "payment" : "payments"} in this period, any invoice`
                : undefined
            }
            isLoading={loading}
            href="/billing/transactions?status=success"
          />
          <StatCard
            bare
            label="Open"
            value={kpis?.pending.amount ?? 0}
            format="money"
            deltaLabel={kpis ? `${formatCount(kpis.pending.count)} ${kpis.pending.count === 1 ? "invoice" : "invoices"} due in this period, unpaid` : undefined}
            isLoading={loading}
            href={invoicesHref("ISSUED")}
          />
          <StatCard
            bare
            label="Overdue"
            value={kpis?.overdue.amount ?? 0}
            format="money"
            valueTone={kpis && kpis.overdue.amount > 0 ? "danger" : "default"}
            deltaLabel={kpis ? `${formatCount(kpis.overdue.count)} ${kpis.overdue.count === 1 ? "invoice" : "invoices"} due in this period, past grace` : undefined}
            isLoading={loading}
            href={invoicesHref("OVERDUE")}
          />
        </KpiStrip>

        {(() => {
          const toolbar = (
            <>
              <TableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search billed stores"
                columns={shopColumns.map((c) => ({ key: c.key, label: c.label }))}
                visibleColumns={Array.from(visibleShopColumns)}
                onVisibleColumnsChange={(keys) => setVisibleShopColumns(new Set(keys))}
                filterContent={
                  <>
                    <Select
                      label="Show"
                      size="sm"
                      selectedKeys={new Set([drill])}
                      onSelectionChange={(keys) => {
                        const v = String(Array.from(keys)[0] ?? "");
                        if (isDrill(v)) setDrill(v);
                      }}
                      disallowEmptySelection
                    >
                      {currentDrillOptions.map((option) => (
                        <SelectItem key={option}>{option === "all" ? "All stores" : drillLabels[option]}</SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Plan"
                      size="sm"
                      selectedKeys={new Set([plan])}
                      onSelectionChange={(keys) => {
                        const v = Array.from(keys)[0];
                        if (typeof v === "string") setPlan(v as PlanName | "all");
                      }}
                      disallowEmptySelection
                    >
                      {planOptions.map((p) => (
                        <SelectItem key={p}>{p === "all" ? "All plans" : getPlanLabel(p)}</SelectItem>
                      ))}
                    </Select>
                    <Select
                        label="Health"
                        size="sm"
                        selectedKeys={new Set([health])}
                        onSelectionChange={(keys) => {
                          const v = Array.from(keys)[0];
                          if (typeof v === "string")
                            setHealth(v as SubscriptionHealthBucket | "all");
                        }}
                        disallowEmptySelection
                      >
                        <SelectItem key="all">Any health</SelectItem>
                        <SelectItem key="healthy">Healthy</SelectItem>
                        <SelectItem key="at_risk">At risk</SelectItem>
                        <SelectItem key="unhealthy">Critical</SelectItem>
                      </Select>
                  </>
                }
              />
              <AppliedFilters
                items={[
                  ...(drill !== "all" ? [{ key: "show", label: `Show: ${drillLabels[drill]}`, onRemove: () => setDrill("all") }] : []),
                  ...(plan !== "all" ? [{ key: "plan", label: `Plan: ${getPlanLabel(plan)}`, onRemove: () => setPlan("all") }] : []),
                  ...(health !== "all"
                    ? [{ key: "health", label: `Health: ${healthDisplay[health].label}`, onRemove: () => setHealth("all") }]
                    : []),
                ]}
                onClearAll={clearFilters}
              />
            </>
          );
          const footer = (
            <TablePagination
              page={safePage}
              pageSize={table.pageSize}
              total={shopRows.length}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          );
          return (
            <DataTable
              aria-label="Stores"
              columns={shopTableColumns}
              visibleColumns={visibleShopColumns}
              rows={pageItems as ShopReportRow[]}
              getRowKey={(row) => row.clientId}
              renderCell={renderShopCell}
              isLoading={loading}
              isReloading={api.reloading}
              toolbar={toolbar}
              footer={footer}
              onRowAction={(row) => navigate(`/stores/${row.clientId}`)}
              stickyFirstColumn
              scrollClassName="max-h-[70vh]"
              emptyContent={emptyContent}
            />
          );
        })()}
      </div>
    </div>
  );
}
