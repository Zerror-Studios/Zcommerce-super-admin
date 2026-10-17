import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getPlanLabel } from "../../lib/display-labels.util";
import { clients } from "../../lib/mockData";
import { SALES_DROP_ALERT_PERCENT, storeSalesByPlan, storeSalesRows, storeSalesSummary } from "../../lib/metrics";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import {
  Card,
  EmptyState,
  KpiStrip,
  StatCard,
  cx,
  formatCount,
  formatDelta,
  formatMoney,
  formatPercent,
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import { emptyStates } from "../../copy";

const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

const right = "block text-right num";

function Change({ value }: { value: number | null }) {
  const tone = value == null || value === 0 ? undefined : value > 0 ? toneTextClasses.success : toneTextClasses.danger;
  return <span className={cx(right, tone)}>{formatDelta(value)}</span>;
}

/**
 * Analytics › Store sales: what stores sell to their own customers (their orders), as opposed to
 * Platform revenue, which is what stores pay Zcommerce. All figures cover the last 30 days.
 */
export function StoreSalesTab() {
  const navigate = useNavigate();
  const summary = useMemo(() => storeSalesSummary(clients), []);
  const rows = useMemo(() => storeSalesRows(clients), []);
  const byPlan = useMemo(() => storeSalesByPlan(clients), []);
  const needsLook = useMemo(
    () => rows.filter((row) => row.orders === 0 || (row.changePercent != null && row.changePercent <= -SALES_DROP_ALERT_PERCENT)),
    [rows],
  );

  const noData = <EmptyState compact description={emptyStates.noData} />;
  const openStore = (clientId: string) => navigate(`/stores/${clientId}`);

  return (
    <div>
      <PageHeader title="Store sales" description="What stores sold to their customers in the last 30 days, compared with the 30 days before." />

      <div className="space-y-4">
        <KpiStrip>
          <StatCard
            bare
            label="Store sales"
            value={summary.sales}
            format="money"
            delta={summary.changePercent}
            deltaLabel="vs previous 30 days"
          />
          <StatCard bare label="Orders" value={formatCount(summary.orders)} deltaLabel="Across all stores" />
          <StatCard
            bare
            label="Average order value"
            value={summary.averageOrder == null ? "—" : formatMoney(summary.averageOrder, { whole: true })}
            deltaLabel="Sales ÷ orders"
          />
          <StatCard
            bare
            label="Selling stores"
            value={formatCount(summary.sellingStores)}
            deltaLabel={`of ${formatCount(summary.totalStores)} stores had an order`}
          />
        </KpiStrip>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Sales by plan" padding="none" className="overflow-hidden">
            <Table aria-label="Sales by plan" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Plan</TableColumn>
                <TableColumn align="end">Sales</TableColumn>
                <TableColumn align="end">Share</TableColumn>
                <TableColumn align="end">Orders</TableColumn>
                <TableColumn align="end">Stores</TableColumn>
              </TableHeader>
              <TableBody items={byPlan} emptyContent={noData}>
                {(row) => (
                  <TableRow key={row.plan}>
                    <TableCell className="font-medium">{getPlanLabel(row.plan)}</TableCell>
                    <TableCell><span className={right}>{formatMoney(row.sales, { whole: true })}</span></TableCell>
                    <TableCell><span className={right}>{formatPercent(row.sharePercent)}</span></TableCell>
                    <TableCell><span className={right}>{formatCount(row.orders)}</span></TableCell>
                    <TableCell><span className={right}>{formatCount(row.stores)}</span></TableCell>
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
                <TableColumn align="end">Sales</TableColumn>
                <TableColumn align="end">vs previous 30 days</TableColumn>
              </TableHeader>
              <TableBody
                items={needsLook}
                emptyContent={<EmptyState compact description="Every store is selling and none dropped sharply." />}
              >
                {(row) => (
                  <TableRow key={row.clientId} className="cursor-pointer" onClick={() => openStore(row.clientId)}>
                    <TableCell>
                      <p className="truncate font-medium text-fg">{row.storeName}</p>
                      <p className="truncate text-caption text-fg-subtle">{row.orders === 0 ? "No orders" : `${formatCount(row.orders)} orders`}</p>
                    </TableCell>
                    <TableCell><span className={right}>{formatMoney(row.sales, { whole: true })}</span></TableCell>
                    <TableCell><Change value={row.changePercent} /></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card title="Stores by sales" padding="none" className="overflow-hidden">
          <Table aria-label="Stores by sales" removeWrapper classNames={cardTableClassNames}>
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn>Plan</TableColumn>
              <TableColumn align="end">Sales</TableColumn>
              <TableColumn align="end">vs previous 30 days</TableColumn>
              <TableColumn align="end">Orders</TableColumn>
              <TableColumn align="end">Average order</TableColumn>
            </TableHeader>
            <TableBody items={rows} emptyContent={noData}>
              {(row) => (
                <TableRow key={row.clientId} className="cursor-pointer" onClick={() => openStore(row.clientId)}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate whitespace-nowrap font-medium text-fg">{row.storeName}</p>
                      <p className="truncate text-caption text-fg-subtle">{row.ownerEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getPlanLabel(row.plan)}</TableCell>
                  <TableCell><span className={cx(right, "font-medium")}>{formatMoney(row.sales, { whole: true })}</span></TableCell>
                  <TableCell><Change value={row.changePercent} /></TableCell>
                  <TableCell><span className={right}>{formatCount(row.orders)}</span></TableCell>
                  <TableCell>
                    <span className={right}>{row.averageOrder == null ? "—" : formatMoney(row.averageOrder, { whole: true })}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
