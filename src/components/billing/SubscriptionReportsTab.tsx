import { endOfDay, startOfDay, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { PlanName, SubscriptionHealthBucket } from "../../types";
import { getPlanLabel, PLAN_NAMES } from "../../lib/display-labels.util";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { useClients } from "../../providers/ClientsProvider";
import { useCollections } from "../../hooks/use-platform-reports";
import { InvoiceRowActions } from "./InvoiceRowActions";
import { collectionRate } from "../../lib/periods";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { paymentState } from "../../lib/storeStatus";
import type { PaymentReportRow, ReportDrillFilter, ShopReportRow } from "../../types/reports";
import { formatDate } from "../../lib/utils";
import {
  DateRangeComparison,
  type DateRangeValue,
} from "../common/DateRangeComparison";
import { AppliedFilters } from "../common/AppliedFilters";
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
  StatusChip,
  Tab,
  Tabs,
  cx,
  formatCount,
  formatMoney,
  formatPercent,
  toneTextClasses,
} from "../ui";
import type { Tone } from "../ui";
import { emptyStates, toasts } from "../../copy";

// Today, when the page loaded; the server judges every row against its own clock.
const AS_OF = new Date();

const defaultRange: DateRangeValue = {
  startDate: startOfMonth(AS_OF),
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

const shopTableColumns: DataTableColumn[] = shopColumns.map((c) => ({
  ...c,
  align: rightAligned.has(c.key) ? "end" : undefined,
}));

const paymentTableColumns: DataTableColumn[] = [
  ...paymentColumns.map((c): DataTableColumn => ({ ...c, align: rightAligned.has(c.key) ? "end" : undefined })),
  { key: "actions", label: "Actions", hideLabel: true },
];

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

const drillOptions: Record<TableView, ReportDrillFilter[]> = {
  shops: ["all", "pending", "overdue", "overdue_grace", "renewals_7", "renewals_30", "churned_month"],
  payments: ["all", "paid_month", "pending", "overdue"],
};

const planOptions = ["all", ...PLAN_NAMES] as const;

function isDrill(value: string | null): value is ReportDrillFilter {
  return value != null && value in drillLabels;
}

const muted = <span className="text-fg-subtle">—</span>;

export function SubscriptionReportsTab() {
  const navigate = useNavigate();
  const { subscriptions, plans: planList } = useClients();
  const [range, setRangeState] = useState<DateRangeValue>(defaultRange);
  // Tab, drill-down, plan, health, search and page live in the URL (docs/design/09-settings-and-scale.md §3.1),
  // so the KPI cells can be plain links (?tab=invoices&show=overdue).
  const table = useTableUrlState();
  const [, setSearchParams] = useSearchParams();
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

  const tableView: TableView = table.filters.tab === "invoices" ? "payments" : "shops";
  const showParam = table.filters.show ?? null;
  const drill: ReportDrillFilter = isDrill(showParam) ? showParam : "all";

  const setDrill = (show: ReportDrillFilter) => table.setFilter("show", show === "all" ? undefined : show);
  const setTableView = (tab: TableView) => table.setFilter("tab", tab === "payments" ? "invoices" : undefined);

  // PRD-005 FR-5.3: the server applies the range, filters and drill.
  const api = useCollections({
    startDate: range.startDate,
    endDate: range.endDate,
    drill,
    search: table.search,
    planId: plan === "all" ? null : (planList.find((p) => p.name === plan)?.id ?? null),
    health,
  });
  const loading = api.loading;
  const error = api.error;
  const overview = error ? null : (api.data?.overview ?? null);
  const shopRows = api.data?.shopRows ?? [];
  const paymentRows = api.data?.paymentRows ?? [];

  // KPI strip (docs/design/04-super-admin.md §3.5): Billed = Collected + Pending + Overdue, so the cells add up
  // and the collection rate is lib/periods collectionRate(). Pending/Overdue match the table drill-downs.
  const kpis = useMemo(() => {
    if (!overview) return null;
    const collected = overview.currentMonth.collectedAmount;
    const previousCollected = overview.previousMonth.collectedAmount;
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
  }, [overview]);

  const subscriptionByClient = useMemo(() => latestSubscriptionByClient(subscriptions), [subscriptions]);

  const activeRows = tableView === "shops" ? shopRows : paymentRows;
  const pageCount = Math.max(1, Math.ceil(activeRows.length / table.pageSize));
  const safePage = Math.min(table.page, pageCount);
  const pageItems = activeRows.slice((safePage - 1) * table.pageSize, safePage * table.pageSize);

  const isThisMonth =
    startOfDay(range.startDate).getTime() === startOfMonth(AS_OF).getTime();
  const hasFilters = plan !== "all" || health !== "all" || drill !== "all" || table.search.trim() !== "";
  const clearFilters = () => {
    setSearch("");
    // One URL write (the tab stays): two writes in a row would each start from the same old URL.
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        ["plan", "health", "show", "q", "page"].forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  };

  const exportCsv = () => {
    if (tableView === "shops") {
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
    } else {
      const csv = rowsToCsv(
        paymentRows.map((r) => ({
          ...r,
          plan: getPlanLabel(r.plan),
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
      type="list"
      icon={<IconBilling aria-hidden />}
      section="green"
      title="Collections"
      description={
        kpis
          ? `${formatMoney(kpis.billed, { whole: true })} billed · ${kpis.rate != null ? `${formatPercent(kpis.rate, 0)} collected` : "nothing collected yet"} · ${formatCount(kpis.overdue.count)} overdue`
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

  const renderPaymentCell = (row: PaymentReportRow, key: string) => {
    switch (key) {
      case "shopName":
        return (
          <div className="min-w-0 max-w-64">
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
      case "actions":
        return <InvoiceRowActions row={row} onChanged={api.refetch} />;
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
      classNames={{ base: "h-full min-w-0 max-w-full", tabList: "h-full border-b-0", tab: "h-full" }}
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

        {(() => {
          const toolbar = (
            <>
              <TableToolbar
                tabs={tabs}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={tableView === "shops" ? "Search billed stores" : "Search invoices"}
                columns={tableView === "shops" ? shopColumns.map((c) => ({ key: c.key, label: c.label })) : undefined}
                visibleColumns={tableView === "shops" ? Array.from(visibleShopColumns) : undefined}
                onVisibleColumnsChange={tableView === "shops" ? (keys) => setVisibleShopColumns(new Set(keys)) : undefined}
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
                        <SelectItem key={p}>{p === "all" ? "All plans" : getPlanLabel(p)}</SelectItem>
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
              total={activeRows.length}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          );
          return tableView === "shops" ? (
            <DataTable
              aria-label="Stores"
              columns={shopTableColumns}
              visibleColumns={visibleShopColumns}
              rows={pageItems as ShopReportRow[]}
              getRowKey={(row) => row.clientId}
              renderCell={renderShopCell}
              isLoading={loading}
              toolbar={toolbar}
              footer={footer}
              onRowAction={(row) => navigate(`/stores/${row.clientId}`)}
              stickyFirstColumn
              scrollClassName="max-h-[70vh]"
              emptyContent={emptyContent}
            />
          ) : (
            <DataTable
              aria-label="Invoices"
              columns={paymentTableColumns}
              rows={pageItems as PaymentReportRow[]}
              getRowKey={(row) => row.id}
              renderCell={renderPaymentCell}
              isLoading={loading}
              toolbar={toolbar}
              footer={footer}
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
