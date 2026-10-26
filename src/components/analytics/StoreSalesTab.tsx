import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreSales } from "../../hooks/use-platform-analytics";
import {
  DEFAULT_PERFORMANCE_RANGE_DAYS,
  PERFORMANCE_RANGE_DAYS,
  lastDaysRange,
  type PerformanceRangeDays,
} from "../../lib/analytics-health";
import {
  NO_PREVIOUS_SALES_COPY,
  SALES_DROP_ALERT_PERCENT,
  storesNeedingALook,
} from "../../lib/store-sales";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { IconAnalytics } from "../ui/icons";
import {
  Card,
  EmptyState,
  ErrorState,
  KpiStrip,
  SegmentedControl,
  Skeleton,
  StatCard,
  Tooltip,
  cx,
  formatCount,
  formatDate,
  formatDelta,
  formatMoney,
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import { emptyStates, toasts } from "../../copy";

const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

const right = "block text-right num";

const rangeOptions = PERFORMANCE_RANGE_DAYS.map((days) => ({ value: String(days), label: `${days} days` }));

/** PRD-024 FR-2.1: a null change is "—" with the reason, never −100 % or +100 %. */
function Change({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <Tooltip content={NO_PREVIOUS_SALES_COPY}>
        <span className={cx(right, "text-fg-subtle")}>—</span>
      </Tooltip>
    );
  }
  const tone = value === 0 ? undefined : value > 0 ? toneTextClasses.success : toneTextClasses.danger;
  return <span className={cx(right, tone)}>{formatDelta(value)}</span>;
}

/**
 * Analytics › Store sales: what stores sell to their own customers (their orders), as opposed to
 * Platform revenue, which is what stores pay Zcom. PRD-024 FR-3.4: every figure is the server's
 * rollup `platformStoreSales` for the chosen window (net of cancellations and refunds), compared
 * with the window before it; totals are per currency and never added across currencies.
 */
export function StoreSalesTab() {
  const navigate = useNavigate();
  const [days, setDays] = useState<PerformanceRangeDays>(DEFAULT_PERFORMANCE_RANGE_DAYS);
  const range = useMemo(() => lastDaysRange(days), [days]);
  const api = useStoreSales(range);
  const view = api.data;
  const rows = useMemo(() => view?.rows ?? [], [view]);
  const needsLook = useMemo(() => storesNeedingALook(rows), [rows]);
  // One currency: the KPI strip shows it; several: the per-currency table carries the totals.
  const primary = view?.totals.length === 1 ? view.totals[0] : null;
  const previousLabel = view
    ? `vs ${formatDate(view.previousStart)} – ${formatDate(view.previousEnd)}`
    : `vs previous ${days} days`;

  const noData = <EmptyState compact description={emptyStates.noData} />;
  const openStore = (clientId: string) => navigate(`/stores/${clientId}`);

  return (
    <div>
      <PageHeader
        type="page"
        icon={<IconAnalytics aria-hidden />}
        section="violet"
        title="Store sales"
        description={`What stores sold to their customers in the last ${days} days, net of cancellations and refunds, compared with the ${days} days before.`}
        actions={
          <SegmentedControl
            aria-label="Period"
            options={rangeOptions}
            value={String(days)}
            onChange={(value) => setDays(Number(value) as PerformanceRangeDays)}
          />
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load store sales." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : api.loading || !view ? (
        <div className="space-y-4" role="status" aria-label="Loading store sales">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      ) : (
      <div className="space-y-4">
        {primary ? (
          <KpiStrip>
            <StatCard
              bare
              label={`Net store sales · ${days}d`}
              value={primary.sales}
              format="money"
              currency={primary.currency}
              delta={primary.changePercent}
              deltaLabel={primary.changePercent == null ? NO_PREVIOUS_SALES_COPY : previousLabel}
            />
            <StatCard
              bare
              label={`Orders · ${days}d`}
              value={formatCount(primary.orders)}
              deltaLabel={`${formatCount(primary.previousOrders)} in the ${days} days before`}
            />
            <StatCard
              bare
              label="Average order value"
              value={primary.averageOrder == null ? "—" : formatMoney(primary.averageOrder, { currency: primary.currency, whole: true })}
              deltaLabel="Net sales ÷ orders"
            />
            <StatCard
              bare
              label="Stores"
              value={formatCount(primary.stores)}
              deltaLabel="Every store not deleted"
            />
          </KpiStrip>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card
            title="Totals by currency"
            description="Stores selling in different currencies are never added together"
            padding="none"
            className="overflow-hidden"
          >
            <Table aria-label="Store sales by currency" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Currency</TableColumn>
                <TableColumn align="end">Net sales</TableColumn>
                <TableColumn align="end">Change</TableColumn>
                <TableColumn align="end">Orders</TableColumn>
                <TableColumn align="end">Stores</TableColumn>
              </TableHeader>
              <TableBody items={view.totals} emptyContent={noData}>
                {(total) => (
                  <TableRow key={total.currency}>
                    <TableCell className="font-medium">{total.currency}</TableCell>
                    <TableCell>
                      <span className={right}>{formatMoney(total.sales, { currency: total.currency, whole: true })}</span>
                    </TableCell>
                    <TableCell><Change value={total.changePercent} /></TableCell>
                    <TableCell><span className={right}>{formatCount(total.orders)}</span></TableCell>
                    <TableCell><span className={right}>{formatCount(total.stores)}</span></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card
            title="Needs a look"
            description={`No orders, or sales down ${SALES_DROP_ALERT_PERCENT}% or more`}
            padding="none"
            className="overflow-hidden"
          >
            <Table aria-label="Stores that need a look" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Store</TableColumn>
                <TableColumn align="end">Net sales</TableColumn>
                <TableColumn align="end">Change</TableColumn>
              </TableHeader>
              <TableBody
                items={needsLook}
                emptyContent={<EmptyState compact description="Every store is selling and none dropped sharply." />}
              >
                {(row) => (
                  <TableRow key={row.clientId} className="cursor-pointer" onClick={() => openStore(row.clientId)}>
                    <TableCell>
                      <p className="max-w-56 truncate font-medium text-fg">{row.storeName}</p>
                      <p className="truncate text-caption text-fg-subtle">{row.orders === 0 ? "No orders" : `${formatCount(row.orders)} orders`}</p>
                    </TableCell>
                    <TableCell>
                      <span className={right}>{formatMoney(row.sales, { currency: row.currency, whole: true })}</span>
                    </TableCell>
                    <TableCell><Change value={row.changePercent} /></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card
          title="Stores by sales"
          description={
            view.totalCount > rows.length
              ? `The top ${formatCount(rows.length)} of ${formatCount(view.totalCount)} stores by net sales`
              : `${formatDate(view.rangeStart)} – ${formatDate(view.rangeEnd)}`
          }
          padding="none"
          className="overflow-hidden"
        >
          <Table aria-label="Stores by sales" removeWrapper classNames={cardTableClassNames}>
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn align="end">{`Net sales · ${days}d`}</TableColumn>
              <TableColumn align="end">{`Previous ${days} days`}</TableColumn>
              <TableColumn align="end">Change</TableColumn>
              <TableColumn align="end">{`Orders · ${days}d`}</TableColumn>
              <TableColumn align="end">Average order</TableColumn>
            </TableHeader>
            <TableBody items={rows} emptyContent={noData}>
              {(row) => (
                <TableRow key={row.clientId} className="cursor-pointer" onClick={() => openStore(row.clientId)}>
                  <TableCell>
                    <div className="min-w-0 max-w-64">
                      <p className="truncate whitespace-nowrap font-medium text-fg">{row.storeName}</p>
                      <p className="truncate text-caption text-fg-subtle">{row.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cx(right, "font-medium")}>{formatMoney(row.sales, { currency: row.currency, whole: true })}</span>
                  </TableCell>
                  <TableCell>
                    <span className={right}>{formatMoney(row.previousSales, { currency: row.currency, whole: true })}</span>
                  </TableCell>
                  <TableCell><Change value={row.changePercent} /></TableCell>
                  <TableCell><span className={right}>{formatCount(row.orders)}</span></TableCell>
                  <TableCell>
                    <span className={right}>
                      {row.averageOrder == null ? "—" : formatMoney(row.averageOrder, { currency: row.currency, whole: true })}
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      )}
    </div>
  );
}
