import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { differenceInCalendarDays, endOfDay, startOfDay, startOfMonth, subDays } from "date-fns";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { PlanName, SubscriptionHealthBucket } from "../../types";
import { clients, subscriptions, transactions } from "../../lib/mockData";
import { collectionRate, earnedIn } from "../../lib/metrics";
import { loadPlatformSettings } from "../../lib/platformSettings";
import { graceDaysFor, paymentState } from "../../lib/storeStatus";
import {
  applyDrillToPayments,
  applyDrillToShops,
  buildPaymentReportRows,
  buildShopReportRows,
  buildSubscriptionReportOverview,
  downloadCsv,
  rowsToCsv,
  type PaymentReportRow,
  type ReportDrillFilter,
  type ShopReportRow,
} from "../../lib/subscriptionReports";
import { formatDate } from "../../lib/utils";
import {
  DateRangeComparison,
  type DateRangeValue,
} from "../common/DateRangeComparison";
import { dataTableClassNames, tablePanelClassName } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { TableToolbar } from "../common/TableToolbar";
import { IconBilling, IconClose, IconDownload } from "../ui/icons";
import {
  Button as UiButton,
  Chip,
  EmptyState,
  ErrorState,
  KpiStrip,
  Select,
  SelectItem,
  Skeleton,
  StatCard,
  StatusChip,
  Tab,
  Tabs,
  cx,
  formatCount,
  formatMoney,
  formatPercent,
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import type { Tone } from "../ui";
import { emptyStates, toasts } from "../../copy";

const PAGE_SIZE = 8;
const AS_OF = new Date("2026-10-06T12:00:00Z");

const defaultRange: DateRangeValue = {
  startDate: startOfMonth(new Date(2026, 9, 1)),
  endDate: endOfDay(AS_OF),
};

/** URL keys stay "shops"/"payments" internally; the tabs read Stores · Invoices. */
type TableView = "shops" | "payments";

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

const paymentColumns = [
  { key: "shopName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "amount", label: "Amount" },
  { key: "dueDate", label: "Due date" },
  { key: "paidDate", label: "Paid on" },
  { key: "status", label: "Status" },
];

const rightAligned = new Set(["amountDue", "daysOverdue", "amount"]);

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
  renewals_7: "Renews within 7 days",
  renewals_30: "Renews within 30 days",
  churned_month: "Cancelled",
  new_month: "New",
  expected: "Expected",
};

const drillOptions: Record<TableView, ReportDrillFilter[]> = {
  shops: ["all", "pending", "overdue", "renewals_7", "renewals_30", "churned_month"],
  payments: ["all", "paid_month", "pending", "overdue"],
};

const planOptions = ["all", "Free", "Starter", "Pro", "Enterprise"] as const;

function isDrill(value: string | null): value is ReportDrillFilter {
  return value != null && value in drillLabels;
}

function previousPeriodOf(start: Date, end: Date) {
  const length = differenceInCalendarDays(end, start) + 1;
  const prevEnd = endOfDay(subDays(start, 1));
  return { start: startOfDay(subDays(prevEnd, length - 1)), end: prevEnd };
}

/** Exclusive-end period for lib/metrics from an inclusive date range. */
function toPeriod(start: Date, end: Date) {
  return { start, end: new Date(end.getTime() + 1) };
}

function AppliedFilter({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface pl-2.5 pr-1 text-label text-fg">
      {children}
      <button
        type="button"
        aria-label="Remove filter"
        onClick={onRemove}
        className="inline-flex size-5 items-center justify-center rounded-sm text-fg-muted transition-colors duration-instant hover:bg-surface-sunken hover:text-fg"
      >
        <IconClose aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

const muted = <span className="text-fg-subtle">—</span>;

export function SubscriptionReportsTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanName | "all">("all");
  const [health, setHealth] = useState<SubscriptionHealthBucket | "all">("all");
  const [page, setPage] = useState(1);
  const [visibleShopColumns, setVisibleShopColumns] = useState<string[]>(defaultShopColumns);

  // Drill-down and tab live in the URL so the KPI cells can be plain links (?tab=invoices&show=overdue).
  const tableView: TableView = searchParams.get("tab") === "invoices" ? "payments" : "shops";
  const showParam = searchParams.get("show");
  const drill: ReportDrillFilter = isDrill(showParam) ? showParam : "all";

  const updateParams = (next: { tab?: TableView; show?: ReportDrillFilter }) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next.tab) {
          if (next.tab === "payments") params.set("tab", "invoices");
          else params.delete("tab");
        }
        if (next.show) {
          if (next.show === "all") params.delete("show");
          else params.set("show", next.show);
        }
        return params;
      },
      { replace: true },
    );
  };
  const setDrill = (show: ReportDrillFilter) => updateParams({ show });
  const setTableView = (tab: TableView) => updateParams({ tab });

  const reload = () => {
    setLoading(true);
    setError(null);
    window.setTimeout(() => setLoading(false), 400);
  };

  useEffect(() => {
    reload();
  }, []);

  const settings = useMemo(() => loadPlatformSettings(), []);

  const queryInput = useMemo(
    () => ({
      clients,
      subscriptions,
      transactions,
      asOf: AS_OF,
      rangeStart: range.startDate,
      rangeEnd: range.endDate,
      settings,
      search,
      plan,
      health,
    }),
    [range.endDate, range.startDate, search, plan, health, settings],
  );

  const overview = useMemo(
    () => (error ? null : buildSubscriptionReportOverview(queryInput)),
    [queryInput, error],
  );

  const shopRows = useMemo(() => {
    const base = buildShopReportRows(queryInput);
    return applyDrillToShops(base, drill, AS_OF);
  }, [queryInput, drill]);

  const paymentRows = useMemo(() => {
    const base = buildPaymentReportRows(queryInput);
    return applyDrillToPayments(
      base,
      drill,
      range.startDate,
      range.endDate,
      AS_OF,
    );
  }, [queryInput, drill, range.endDate, range.startDate]);

  // KPI strip (docs/design/04-super-admin.md §3.5): Billed = Collected + Pending + Overdue, so the cells add up
  // and the collection rate is lib/metrics collectionRate(). Pending/Overdue match the table drill-downs.
  const kpis = useMemo(() => {
    if (!overview) return null;
    const collected = earnedIn(transactions, toPeriod(range.startDate, range.endDate));
    const previous = previousPeriodOf(range.startDate, range.endDate);
    const previousCollected = earnedIn(transactions, toPeriod(previous.start, previous.end));
    const open = overview.pendingPayments.amount + overview.overduePayments.amount;
    return {
      billed: collected + open,
      collected,
      collectedDelta:
        previousCollected > 0 ? ((collected - previousCollected) / previousCollected) * 100 : null,
      rate: collectionRate(collected, open),
      pending: overview.pendingPayments,
      overdue: overview.overduePayments,
    };
  }, [overview, range.endDate, range.startDate]);

  const subscriptionByClient = useMemo(() => new Map(subscriptions.map((s) => [s.clientId, s])), []);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), []);

  useEffect(() => {
    setPage(1);
  }, [drill, search, plan, health, tableView, range.endDate, range.startDate]);

  const activeRows = tableView === "shops" ? shopRows : paymentRows;
  const pageCount = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = activeRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const firstRow = activeRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(safePage * PAGE_SIZE, activeRows.length);

  const isThisMonth =
    startOfDay(range.startDate).getTime() === startOfMonth(AS_OF).getTime();
  const hasFilters = plan !== "all" || health !== "all" || drill !== "all" || search.trim() !== "";
  const clearFilters = () => {
    setPlan("all");
    setHealth("all");
    setSearch("");
    setDrill("all");
  };

  const exportCsv = () => {
    if (tableView === "shops") {
      const csv = rowsToCsv(
        shopRows.map((r) => ({
          ...r,
          health: healthDisplay[r.health].label,
          lastPaymentDate: r.lastPaymentDate ? formatDate(r.lastPaymentDate) : "",
          nextDueDate: r.nextDueDate ? formatDate(r.nextDueDate) : "",
        })),
        shopCsvColumns,
      );
      downloadCsv("collections-stores.csv", csv);
    } else {
      const csv = rowsToCsv(
        paymentRows.map((r) => ({
          ...r,
          dueDate: r.dueDate ? formatDate(r.dueDate) : "",
          paidDate: r.paidDate ? formatDate(r.paidDate) : "",
        })),
        paymentColumns,
      );
      downloadCsv("collections-invoices.csv", csv);
    }
  };

  const header = (
    <PageHeader
      title="Collections"
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
          onRetry={() => {
            setError(null);
            reload();
          }}
        />
      </div>
    );
  }

  const kpiCellClass = (active: boolean) => (active ? "bg-surface-muted" : undefined);

  const renderShopCell = (row: ShopReportRow, key: string) => {
    switch (key) {
      case "storeName":
        return (
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap font-medium text-fg">{row.storeName}</p>
            <p className="truncate text-caption text-fg-subtle">{row.ownerEmail}</p>
          </div>
        );
      case "plan":
        return (
          <div className="whitespace-nowrap">
            <p className="text-fg">{row.plan}</p>
            <p className="text-caption text-fg-subtle num">
              {row.mrr > 0 ? `${formatMoney(row.mrr, { whole: true })} / month` : "No fee"}
            </p>
          </div>
        );
      case "payment": {
        const client = clientById.get(row.clientId);
        const state = paymentState(
          subscriptionByClient.get(row.clientId),
          transactions,
          client ? graceDaysFor(client, settings.gracePeriodDays) : settings.gracePeriodDays,
          AS_OF,
        );
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
            {display.label}
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

  const renderPaymentCell = (row: PaymentReportRow, key: string) => {
    switch (key) {
      case "shopName":
        return (
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap font-medium text-fg">{row.shopName}</p>
            <p className="truncate text-caption text-fg-subtle">{row.ownerEmail}</p>
          </div>
        );
      case "amount":
        return <span className="block text-right num">{formatMoney(row.amount, { currency: row.currency, paise: true })}</span>;
      case "dueDate":
      case "paidDate":
        return row[key] ? <span className="whitespace-nowrap num">{formatDate(row[key] as string)}</span> : muted;
      case "status":
        return <StatusChip domain="payment" status={row.status} />;
      default:
        return String(row[key as keyof PaymentReportRow] ?? "—");
    }
  };

  const emptyContent = hasFilters ? (
    <EmptyState
      icon={IconBilling}
      title={search.trim() ? emptyStates.noResults(search.trim()).title : "Nothing matches these filters"}
      description={emptyStates.noResults("").description}
      action={
        <UiButton variant="secondary" size="sm" onPress={clearFilters}>
          {emptyStates.noResults("").action}
        </UiButton>
      }
    />
  ) : tableView === "shops" ? (
    <EmptyState icon={IconBilling} title="No stores yet" description="Stores appear here once they are on a plan." />
  ) : (
    <EmptyState icon={IconBilling} title="No invoices yet" description="Invoices and payments for this period will appear here." />
  );

  const tabs = (
    <Tabs
      aria-label="Collections view"
      selectedKey={tableView}
      onSelectionChange={(key) => setTableView(key as TableView)}
      classNames={{ base: "h-full", tabList: "h-full border-b-0", tab: "h-full" }}
    >
      <Tab
        key="shops"
        title={
          <span>
            Stores <span className="ml-1 font-normal text-fg-muted num">{shopRows.length}</span>
          </span>
        }
      />
      <Tab
        key="payments"
        title={
          <span>
            Invoices <span className="ml-1 font-normal text-fg-muted num">{paymentRows.length}</span>
          </span>
        }
      />
    </Tabs>
  );

  const shopHeaderColumns = shopColumns.filter((c) => visibleShopColumns.includes(c.key));
  const currentDrillOptions = drillOptions[tableView].includes(drill)
    ? drillOptions[tableView]
    : [...drillOptions[tableView], drill];

  return (
    <div>
      {header}

      <div className="space-y-4">
        <KpiStrip className="overflow-hidden">
          <StatCard
            bare
            label={isThisMonth ? "Billed this month" : "Billed"}
            value={kpis?.billed ?? 0}
            format="money"
            deltaLabel="Collected + pending + overdue"
            isLoading={loading}
            href="?"
            className={kpiCellClass(drill === "all" && tableView === "shops")}
          />
          <StatCard
            bare
            label={kpis?.rate != null ? `Collected · ${formatPercent(kpis.rate, 0)}` : "Collected"}
            value={kpis?.collected ?? 0}
            format="money"
            delta={kpis?.collectedDelta}
            deltaLabel="vs previous period"
            isLoading={loading}
            href="?tab=invoices&show=paid_month"
            className={kpiCellClass(drill === "paid_month")}
          />
          <StatCard
            bare
            label="Pending"
            value={kpis?.pending.amount ?? 0}
            format="money"
            deltaLabel={kpis ? `${formatCount(kpis.pending.count)} ${kpis.pending.count === 1 ? "invoice" : "invoices"} due` : undefined}
            isLoading={loading}
            href="?tab=invoices&show=pending"
            className={kpiCellClass(drill === "pending")}
          />
          <StatCard
            bare
            label="Overdue"
            value={kpis?.overdue.amount ?? 0}
            format="money"
            valueTone={kpis && kpis.overdue.amount > 0 ? "danger" : "default"}
            deltaLabel={kpis ? `${formatCount(kpis.overdue.count)} ${kpis.overdue.count === 1 ? "invoice" : "invoices"} past due` : undefined}
            isLoading={loading}
            href="?tab=invoices&show=overdue"
            className={kpiCellClass(drill === "overdue")}
          />
        </KpiStrip>

        <div className={tablePanelClassName}>
          <TableToolbar
            tabs={tabs}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={tableView === "shops" ? "Search billed stores" : "Search invoices"}
            columns={tableView === "shops" ? shopColumns : undefined}
            visibleColumns={tableView === "shops" ? visibleShopColumns : undefined}
            onVisibleColumnsChange={tableView === "shops" ? setVisibleShopColumns : undefined}
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
                    <SelectItem key={option}>{option === "all" ? (tableView === "shops" ? "All stores" : "All invoices") : drillLabels[option]}</SelectItem>
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
                    <SelectItem key={p}>{p === "all" ? "All plans" : p}</SelectItem>
                  ))}
                </Select>
                {tableView === "shops" ? (
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
                ) : null}
              </>
            }
          />

          {plan !== "all" || health !== "all" || drill !== "all" ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
              {drill !== "all" ? (
                <AppliedFilter onRemove={() => setDrill("all")}>Show: {drillLabels[drill]}</AppliedFilter>
              ) : null}
              {plan !== "all" ? (
                <AppliedFilter onRemove={() => setPlan("all")}>Plan: {plan}</AppliedFilter>
              ) : null}
              {health !== "all" ? (
                <AppliedFilter onRemove={() => setHealth("all")}>Health: {healthDisplay[health].label}</AppliedFilter>
              ) : null}
              <UiButton variant="link" size="sm" onPress={clearFilters}>
                Clear all
              </UiButton>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : tableView === "shops" ? (
            <Table aria-label="Stores" classNames={dataTableClassNames}>
              <TableHeader columns={shopHeaderColumns}>
                {(column) => (
                  <TableColumn key={column.key} align={rightAligned.has(column.key) ? "end" : "start"}>
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody items={pageItems as ShopReportRow[]} emptyContent={emptyContent}>
                {(row) => (
                  <TableRow
                    key={row.clientId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/stores/${row.clientId}`)}
                  >
                    {(columnKey) => <TableCell>{renderShopCell(row, String(columnKey))}</TableCell>}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table aria-label="Invoices" classNames={{ ...dataTableClassNames, tr: tableRowClasses }}>
              <TableHeader columns={paymentColumns}>
                {(column) => (
                  <TableColumn key={column.key} align={rightAligned.has(column.key) ? "end" : "start"}>
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody items={pageItems as PaymentReportRow[]} emptyContent={emptyContent}>
                {(row) => (
                  <TableRow key={row.id}>
                    {(columnKey) => <TableCell>{renderPaymentCell(row, String(columnKey))}</TableCell>}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-label text-fg-muted num">
              {activeRows.length === 0 ? (tableView === "shops" ? "0 stores" : "0 invoices") : `${firstRow}–${lastRow} of ${formatCount(activeRows.length)}`}
            </p>
            <div className="flex items-center gap-2">
              <UiButton
                variant="secondary"
                size="sm"
                isDisabled={safePage <= 1}
                onPress={() => setPage(safePage - 1)}
              >
                Previous
              </UiButton>
              <UiButton
                variant="secondary"
                size="sm"
                isDisabled={safePage >= pageCount}
                onPress={() => setPage(safePage + 1)}
              >
                Next
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
