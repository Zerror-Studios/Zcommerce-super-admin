import { Card, CardBody, Chip, Pagination, Select, SelectItem, Skeleton, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tab, Tabs } from "@heroui/react";
import { endOfDay, startOfMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlanName, SubscriptionHealthBucket } from "../../types";
import { clients, subscriptions, transactions } from "../../lib/mockData";
import { loadPlatformSettings } from "../../lib/platformSettings";
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
import { formatCurrency, formatDate, formatPercent } from "../../lib/utils";
import {
  DateRangeComparison,
  type DateRangeValue,
} from "../common/DateRangeComparison";
import { dataTableClassNames, tablePanelClassName } from "../common/dataTableStyles";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import { TableToolbar } from "../common/TableToolbar";
import { IconDownload, IconTrendDown, IconTrendUp } from "../ui/icons";
import { Button as UiButton } from "../ui";

const PAGE_SIZE = 8;
const AS_OF = new Date("2026-10-06T12:00:00Z");

const defaultRange: DateRangeValue = {
  startDate: startOfMonth(new Date(2026, 9, 1)),
  endDate: endOfDay(AS_OF),
};

type TableView = "shops" | "payments";

const shopColumns = [
  { key: "storeName", label: "Shop" },
  { key: "plan", label: "Plan" },
  { key: "health", label: "Health" },
  { key: "lastPaymentDate", label: "Last payment" },
  { key: "nextDueDate", label: "Next due" },
  { key: "amountDue", label: "Amount due" },
  { key: "daysOverdue", label: "Days overdue" },
];

const paymentColumns = [
  { key: "shopName", label: "Shop" },
  { key: "plan", label: "Plan" },
  { key: "amount", label: "Amount" },
  { key: "dueDate", label: "Due date" },
  { key: "paidDate", label: "Paid date" },
  { key: "status", label: "Status" },
];

function healthColor(bucket: SubscriptionHealthBucket) {
  if (bucket === "healthy") return "success";
  if (bucket === "at_risk") return "warning";
  return "danger";
}

function paymentColor(status: PaymentReportRow["status"]) {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  if (status === "overdue" || status === "failed") return "danger";
  return "default";
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  active?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
}

function SummaryCard({ title, value, subtitle, active, onPress, isLoading }: SummaryCardProps) {
  if (isLoading) {
    return (
      <Card shadow="none" className="border border-line bg-surface">
        <CardBody className="gap-2 p-4">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-7 w-28 rounded" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card
      shadow="none"
      isPressable={!!onPress}
      onPress={onPress}
      className={`border border-line bg-surface ${active ? "ring-2 ring-primary" : ""}`}
    >
      <CardBody className="gap-1 p-4">
        <p className="text-caption font-medium text-default-500">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {subtitle ? <p className="text-caption text-default-400">{subtitle}</p> : null}
      </CardBody>
    </Card>
  );
}

export function SubscriptionReportsTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [drill, setDrill] = useState<ReportDrillFilter>("all");
  const [tableView, setTableView] = useState<TableView>("shops");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanName | "all">("all");
  const [health, setHealth] = useState<SubscriptionHealthBucket | "all">("all");
  const [page, setPage] = useState(1);

  const reload = () => {
    setLoading(true);
    setError(null);
    window.setTimeout(() => setLoading(false), 400);
  };

  useEffect(() => {
    reload();
  }, []);

  const queryInput = useMemo(
    () => ({
      clients,
      subscriptions,
      transactions,
      asOf: AS_OF,
      rangeStart: range.startDate,
      rangeEnd: range.endDate,
      settings: loadPlatformSettings(),
      search,
      plan,
      health,
    }),
    [range.endDate, range.startDate, search, plan, health, loading],
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

  useEffect(() => {
    setPage(1);
  }, [drill, search, plan, health, tableView, range.endDate, range.startDate]);

  const activeRows = tableView === "shops" ? shopRows : paymentRows;
  const pageCount = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = activeRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const setDrillAndView = (next: ReportDrillFilter, view: TableView) => {
    setDrill(next);
    setTableView(view);
  };

  const exportCsv = () => {
    if (tableView === "shops") {
      const csv = rowsToCsv(
        shopRows.map((r) => ({
          ...r,
          lastPaymentDate: r.lastPaymentDate ? formatDate(r.lastPaymentDate) : "",
          nextDueDate: r.nextDueDate ? formatDate(r.nextDueDate) : "",
        })),
        shopColumns,
      );
      downloadCsv("subscription-shops.csv", csv);
    } else {
      const csv = rowsToCsv(
        paymentRows.map((r) => ({
          ...r,
          dueDate: r.dueDate ? formatDate(r.dueDate) : "",
          paidDate: r.paidDate ? formatDate(r.paidDate) : "",
        })),
        paymentColumns,
      );
      downloadCsv("subscription-payments.csv", csv);
    }
  };

  const delta = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  };

  if (error) {
    return (
      <NoDataPlaceholder
        title="Couldn’t load reports"
        error={error}
        description="Something went wrong while aggregating subscription data."
        buttonLabel="Retry"
        onButtonClick={() => {
          setError(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeComparison value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          title="Total shops"
          value={overview ? String(overview.totalShops) : "—"}
          active={drill === "all" && tableView === "shops"}
          onPress={() => setDrillAndView("all", "shops")}
          isLoading={loading}
        />
        <SummaryCard
          title="Healthy"
          value={overview ? String(overview.healthyCount) : "—"}
          subtitle={overview ? `${overview.atRiskCount} at risk` : undefined}
          active={drill === "healthy"}
          onPress={() => setDrillAndView("healthy", "shops")}
          isLoading={loading}
        />
        <SummaryCard
          title="Unhealthy / at risk"
          value={
            overview
              ? String(overview.unhealthyCount + overview.atRiskCount)
              : "—"
          }
          subtitle={
            overview
              ? `${overview.unhealthyCount} unhealthy · ${overview.atRiskCount} at risk`
              : undefined
          }
          active={drill === "unhealthy" || drill === "at_risk"}
          onPress={() => setDrillAndView("unhealthy", "shops")}
          isLoading={loading}
        />
        <SummaryCard
          title="Collected vs expected"
          value={overview ? `${overview.collectedPercent}%` : "—"}
          subtitle={
            overview
              ? `${formatCurrency(overview.collectedRevenue)} / ${formatCurrency(overview.expectedRevenue)}`
              : undefined
          }
          active={drill === "paid_month"}
          onPress={() => setDrillAndView("paid_month", "payments")}
          isLoading={loading}
        />
        <SummaryCard
          title="Paid this month"
          value={overview ? String(overview.paidThisMonth.count) : "—"}
          subtitle={overview ? formatCurrency(overview.paidThisMonth.amount) : undefined}
          active={drill === "paid_month"}
          onPress={() => setDrillAndView("paid_month", "payments")}
          isLoading={loading}
        />
        <SummaryCard
          title="Pending payments"
          value={overview ? String(overview.pendingPayments.count) : "—"}
          subtitle={overview ? formatCurrency(overview.pendingPayments.amount) : undefined}
          active={drill === "pending"}
          onPress={() => setDrillAndView("pending", "payments")}
          isLoading={loading}
        />
        <SummaryCard
          title="Overdue payments"
          value={overview ? String(overview.overduePayments.count) : "—"}
          subtitle={overview ? formatCurrency(overview.overduePayments.amount) : undefined}
          active={drill === "overdue"}
          onPress={() => setDrillAndView("overdue", "payments")}
          isLoading={loading}
        />
        <SummaryCard
          title="Renewals (7 / 30d)"
          value={overview ? `${overview.renewals7} / ${overview.renewals30}` : "—"}
          active={drill === "renewals_7" || drill === "renewals_30"}
          onPress={() => setDrillAndView("renewals_7", "shops")}
          isLoading={loading}
        />
        <SummaryCard
          title="Churned this month"
          value={overview ? String(overview.churnedThisMonth) : "—"}
          active={drill === "churned_month"}
          onPress={() => setDrillAndView("churned_month", "shops")}
          isLoading={loading}
        />
      </div>

      {overview ? (
        <Card shadow="none" className={tablePanelClassName}>
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-bold">Period vs previous</p>
              <p className="text-caption text-default-500">
                New {overview.currentMonth.newSubscriptions} · Renewals{" "}
                {overview.currentMonth.renewals} · Cancellations{" "}
                {overview.currentMonth.cancellations}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-body">
              {(
                [
                  ["Collected", overview.currentMonth.collectedAmount, overview.previousMonth.collectedAmount],
                  ["Pending ₹", overview.currentMonth.pendingAmount, overview.previousMonth.pendingAmount],
                ] as const
              ).map(([label, cur, prev]) => {
                const d = delta(cur, prev);
                const up = d >= 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-default-500">{label}</span>
                    <span className="font-bold">{formatCurrency(cur)}</span>
                    <span className={`inline-flex items-center gap-0.5 text-caption ${up ? "text-success" : "text-danger"}`}>
                      {up ? <IconTrendUp size={12} /> : <IconTrendDown size={12} />}
                      {formatPercent(d)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card shadow="none" className={tablePanelClassName}>
        <CardBody className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default-100 px-4 py-3">
            <Tabs
              selectedKey={tableView}
              onSelectionChange={(key) => setTableView(key as TableView)}
              size="sm"
              variant="underlined"
            >
              <Tab key="shops" title={`Shops (${shopRows.length})`} />
              <Tab key="payments" title={`Payments (${paymentRows.length})`} />
            </Tabs>
            <div className="flex items-center gap-2">
              {drill !== "all" ? (
                <UiButton variant="outline" size="sm" onPress={() => setDrill("all")}>
                  Clear drill
                </UiButton>
              ) : null}
              <UiButton
                variant="outline"
                size="sm"
                startIcon={<IconDownload size={14} strokeWidth={2.5} />}
                onPress={exportCsv}
              >
                Export CSV
              </UiButton>
            </div>
          </div>

          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by shop or owner..."
            filterContent={
              <>
                <Select
                  label="Plan"
                  size="sm"
                  selectedKeys={new Set([plan])}
                  onSelectionChange={(keys) => {
                    const v = Array.from(keys)[0];
                    if (typeof v === "string") setPlan(v as PlanName | "all");
                  }}
                >
                  {["all", "Free", "Starter", "Pro", "Enterprise"].map((p) => (
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
                  >
                    <SelectItem key="all">All health</SelectItem>
                    <SelectItem key="healthy">Healthy</SelectItem>
                    <SelectItem key="at_risk">At risk</SelectItem>
                    <SelectItem key="unhealthy">Unhealthy</SelectItem>
                  </Select>
                ) : null}
              </>
            }
          />

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : tableView === "shops" ? (
            <Table aria-label="Shops report table" classNames={dataTableClassNames}>
              <TableHeader columns={shopColumns}>
                {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
              </TableHeader>
              <TableBody
                items={pageItems as ShopReportRow[]}
                emptyContent={
                  <NoDataPlaceholder
                    title="No rows for this filter"
                    description="Try another card drill, plan, or search."
                  />
                }
              >
                {(row) => (
                  <TableRow
                    key={row.clientId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/clients/${row.clientId}`)}
                  >
                    {(columnKey) => {
                      const key = String(columnKey);
                      if (key === "storeName")
                        return (
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate font-medium whitespace-nowrap">
                                {row.storeName}
                              </p>
                              <p className="truncate text-caption text-default-400">
                                {row.ownerEmail}
                              </p>
                            </div>
                          </TableCell>
                        );
                      if (key === "health")
                        return (
                          <TableCell>
                            <Chip size="sm" color={healthColor(row.health)} variant="flat">
                              {row.health.replace("_", " ")}
                            </Chip>
                          </TableCell>
                        );
                      if (key === "lastPaymentDate" || key === "nextDueDate")
                        return (
                          <TableCell>
                            {row[key] ? formatDate(row[key] as string) : "—"}
                          </TableCell>
                        );
                      if (key === "amountDue")
                        return <TableCell>{formatCurrency(row.amountDue)}</TableCell>;
                      return (
                        <TableCell>{String(row[key as keyof ShopReportRow] ?? "—")}</TableCell>
                      );
                    }}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table aria-label="Payments report table" classNames={dataTableClassNames}>
              <TableHeader columns={paymentColumns}>
                {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
              </TableHeader>
              <TableBody
                items={pageItems as PaymentReportRow[]}
                emptyContent={
                  <NoDataPlaceholder
                    title="No rows for this filter"
                    description="Try another card drill, plan, or search."
                  />
                }
              >
                {(row) => (
                  <TableRow key={row.id}>
                    {(columnKey) => {
                      const key = String(columnKey);
                      if (key === "shopName")
                        return (
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate font-medium whitespace-nowrap">
                                {row.shopName}
                              </p>
                              <p className="truncate text-caption text-default-400">
                                {row.ownerEmail}
                              </p>
                            </div>
                          </TableCell>
                        );
                      if (key === "amount")
                        return <TableCell>{formatCurrency(row.amount)}</TableCell>;
                      if (key === "dueDate" || key === "paidDate")
                        return (
                          <TableCell>
                            {row[key] ? formatDate(row[key] as string) : "—"}
                          </TableCell>
                        );
                      if (key === "status")
                        return (
                          <TableCell>
                            <Chip size="sm" color={paymentColor(row.status)} variant="flat">
                              {row.status}
                            </Chip>
                          </TableCell>
                        );
                      return (
                        <TableCell>
                          {String(row[key as keyof PaymentReportRow] ?? "—")}
                        </TableCell>
                      );
                    }}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-default-100 px-4 py-3">
            <p className="text-caption text-default-400">
              {activeRows.length} row{activeRows.length === 1 ? "" : "s"}
              {drill !== "all" ? ` · drill: ${drill}` : ""}
            </p>
            <Pagination
              page={safePage}
              total={pageCount}
              onChange={setPage}
              size="sm"
              showControls
              classNames={{ cursor: "bg-primary" }}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
