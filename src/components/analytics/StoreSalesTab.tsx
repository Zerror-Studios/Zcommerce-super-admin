import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreSales } from "../../hooks/use-platform-analytics";
import { lastDaysRange, type PerformanceRangeDays } from "../../lib/analytics-health";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import {
  NO_PREVIOUS_SALES_COPY,
  SALES_DROP_ALERT_PERCENT,
  storesNeedingALook,
  type StoreSalesRow,
  type StoreSalesTotal,
} from "../../lib/store-sales";
import { toasts } from "../../copy";
import {
  EmptyState,
  ErrorState,
  KpiStrip,
  StatCard,
  formatCount,
  formatDate,
  formatMoney,
  type DataTableColumn,
  type TableSort,
} from "../ui";
import {
  ChangeCell,
  DaysSwitch,
  TableCard,
  TwoLine,
  NoDataEmpty,
  type AnalyticsTabProps,
} from "./analytics-shared";
import { storeHref, useRegisterExport } from "./analytics-tab.util";

const totalsColumns: DataTableColumn[] = [
  { key: "currency", label: "Currency" },
  { key: "sales", label: "Net sales", width: 130 },
  { key: "change", label: "Change", width: 90 },
  { key: "orders", label: "Orders", width: 90 },
  { key: "stores", label: "Stores", width: 80 },
];

const needsLookColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "sales", label: "Net sales", width: 120 },
  { key: "change", label: "Change", width: 90 },
];

type SalesSortKey = "sales" | "previous" | "change" | "orders" | "average";

const SORT_VALUE: Record<SalesSortKey, (row: StoreSalesRow) => number> = {
  sales: (row) => row.sales,
  previous: (row) => row.previousSales,
  change: (row) => row.changePercent ?? Number.NEGATIVE_INFINITY,
  orders: (row) => row.orders,
  average: (row) => row.averageOrder ?? Number.NEGATIVE_INFINITY,
};

const isSortKey = (value: string): value is SalesSortKey => value in SORT_VALUE;

const salesMoney = (value: number, currency: string) => formatMoney(value, { currency, whole: true });

export interface StoreSalesTabProps extends AnalyticsTabProps {
  days: PerformanceRangeDays;
  onDaysChange: (days: PerformanceRangeDays) => void;
}

/**
 * Analytics › Store sales (04 S-05b): what stores sell to their own customers (their orders), as opposed to
 * Platform revenue, which is what stores pay Zcom. PRD-024 FR-3.4: every figure is the server's rollup
 * `platformStoreSales` for the chosen window (net of cancellations and refunds), compared with the window
 * before it; totals are per currency and never added across currencies.
 */
export function StoreSalesTab({ tabRow, registerExport, days, onDaysChange }: StoreSalesTabProps) {
  const navigate = useNavigate();
  const range = useMemo(() => lastDaysRange(days), [days]);
  const api = useStoreSales(range);
  const view = api.data;
  const rows = useMemo(() => view?.rows ?? [], [view]);
  const needsLook = useMemo(() => storesNeedingALook(rows), [rows]);
  // Sorted on this page: the server returns the top stores by net sales.
  const [sort, setSort] = useState<TableSort>({ column: "sales", direction: "desc" });
  const sortedRows = useMemo(() => {
    if (!isSortKey(sort.column)) return rows;
    const value = SORT_VALUE[sort.column];
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => sign * (value(a) - value(b)));
  }, [rows, sort]);

  // One currency: the KPI strip shows it; several: the per-currency table carries the totals.
  const primary = view?.totals.length === 1 ? view.totals[0] : null;
  const previousLabel = view ? `vs ${formatDate(view.previousStart)} – ${formatDate(view.previousEnd)}` : `vs previous ${days} days`;
  const loading = api.loading || !view;
  const openStore = (row: StoreSalesRow) => navigate(storeHref(row.clientId));

  const exportCsv = useCallback(() => {
    const columns = [
      { key: "storeName", label: "Store" },
      { key: "slug", label: "Slug" },
      { key: "currency", label: "Currency" },
      { key: "sales", label: `Net sales (${days} days)` },
      { key: "previousSales", label: `Previous ${days} days` },
      { key: "changePercent", label: "Change %" },
      { key: "orders", label: "Orders" },
      { key: "averageOrder", label: "Average order" },
    ];
    downloadCsv(
      `store-sales-${days}-days.csv`,
      rowsToCsv(
        rows.map((row) => ({ ...row, changePercent: row.changePercent ?? "", averageOrder: row.averageOrder ?? "" })),
        columns,
      ),
    );
  }, [days, rows]);
  useRegisterExport(registerExport, rows.length > 0 && !api.error ? exportCsv : null);

  const salesColumns: DataTableColumn[] = [
    { key: "store", label: "Store" },
    { key: "sales", label: `Net sales · ${days}d`, width: 130, sortable: true },
    { key: "previous", label: `Previous ${days} days`, width: 130, sortable: true },
    { key: "change", label: "Change", width: 90, sortable: true },
    { key: "orders", label: `Orders · ${days}d`, width: 100, sortable: true },
    { key: "average", label: "Average order", width: 120, sortable: true },
  ];

  const row = tabRow(<DaysSwitch value={days} onChange={onDaysChange} />);

  if (api.error) {
    return (
      <div>
        {row}
        <ErrorState title="Couldn't load store sales." description={toasts.genericError} onRetry={() => void api.refetch()} />
      </div>
    );
  }

  return (
    <div>
      {row}
      <div className="space-y-4">
        {loading || primary ? (
          <KpiStrip>
            <StatCard
              bare
              isLoading={loading}
              label={`Net store sales · ${days}d`}
              value={primary ? salesMoney(primary.sales, primary.currency) : "—"}
              delta={primary?.changePercent}
              deltaLabel={primary?.changePercent == null ? NO_PREVIOUS_SALES_COPY : previousLabel}
            />
            <StatCard
              bare
              isLoading={loading}
              label={`Orders · ${days}d`}
              value={formatCount(primary?.orders ?? 0)}
              deltaLabel={`${formatCount(primary?.previousOrders ?? 0)} in the ${days} days before`}
            />
            <StatCard
              bare
              isLoading={loading}
              label="Average order value"
              value={primary?.averageOrder == null ? "—" : salesMoney(primary.averageOrder, primary.currency)}
              deltaLabel="Net sales ÷ orders"
            />
            <StatCard bare isLoading={loading} label="Stores" value={formatCount(primary?.stores ?? 0)} deltaLabel="Every store not deleted" />
          </KpiStrip>
        ) : null}

        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
            <TableCard<StoreSalesTotal>
              title="Totals by currency"
              description="Stores selling in different currencies are never added together"
              aria-label="Store sales by currency"
              columns={totalsColumns}
              rows={view?.totals ?? []}
              getRowKey={(total) => total.currency}
              isLoading={loading}
              emptyContent={<NoDataEmpty />}
              renderCell={(total, key) => {
                switch (key) {
                  case "currency":
                    return <span className="font-medium text-fg">{total.currency}</span>;
                  case "sales":
                    return <span className="num">{salesMoney(total.sales, total.currency)}</span>;
                  case "change":
                    return <ChangeCell value={total.changePercent} />;
                  case "orders":
                    return <span className="num">{formatCount(total.orders)}</span>;
                  case "stores":
                    return <span className="num">{formatCount(total.stores)}</span>;
                  default:
                    return null;
                }
              }}
            />

            <TableCard<StoreSalesRow>
              title="Needs a look"
              description={`No orders, or sales down ${SALES_DROP_ALERT_PERCENT}% or more`}
              aria-label="Stores that need a look"
              columns={needsLookColumns}
              rows={needsLook}
              getRowKey={(store) => store.clientId}
              isLoading={loading}
              rowHeight="tall"
              onRowAction={openStore}
              emptyContent={<EmptyState compact description="Every store is selling and none dropped sharply." />}
              renderCell={(store, key) => {
                switch (key) {
                  case "store":
                    return (
                      <TwoLine main={store.storeName} sub={store.orders === 0 ? "No orders" : `${formatCount(store.orders)} orders`} />
                    );
                  case "sales":
                    return <span className="num">{salesMoney(store.sales, store.currency)}</span>;
                  case "change":
                    return <ChangeCell value={store.changePercent} />;
                  default:
                    return null;
                }
              }}
            />
          </div>
        </div>

        <TableCard<StoreSalesRow>
          title="Stores by sales"
          description={
            view && view.totalCount > rows.length
              ? `The top ${formatCount(rows.length)} of ${formatCount(view.totalCount)} stores by net sales`
              : view
                ? `${formatDate(view.rangeStart)} – ${formatDate(view.rangeEnd)}`
                : undefined
          }
          aria-label="Stores by sales"
          columns={salesColumns}
          rows={sortedRows}
          getRowKey={(store) => store.clientId}
          isLoading={loading}
          rowHeight="tall"
          sort={sort}
          onSortChange={setSort}
          onRowAction={openStore}
          emptyContent={<NoDataEmpty />}
          renderCell={(store, key) => {
            switch (key) {
              case "store":
                return <TwoLine main={store.storeName} sub={store.slug} />;
              case "sales":
                return <span className="font-medium num">{salesMoney(store.sales, store.currency)}</span>;
              case "previous":
                return <span className="num">{salesMoney(store.previousSales, store.currency)}</span>;
              case "change":
                return <ChangeCell value={store.changePercent} />;
              case "orders":
                return <span className="num">{formatCount(store.orders)}</span>;
              case "average":
                return <span className="num">{store.averageOrder == null ? "—" : salesMoney(store.averageOrder, store.currency)}</span>;
              default:
                return null;
            }
          }}
        />
      </div>
    </div>
  );
}
