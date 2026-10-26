/**
 * Store page › Usage history (PRD-014 PLT-13): `platformUsage`, one row per
 * month (the month's last daily snapshot), as the server recorded it.
 */

import { useQuery } from "@apollo/client";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo } from "react";

import { PLATFORM_USAGE } from "../../graphql/tenants";
import { monthlyUsage, USAGE_HISTORY_MONTHS, type UsageSnapshot } from "../../lib/usage-history.util";
import { formatNumber } from "../../lib/utils";
import { dataTableClassNames } from "../common/dataTableStyles";
import { Card, EmptyState, ErrorState, Skeleton, formatMoney } from "../ui";
import { IconAnalytics } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

const columns = [
  { key: "month", label: "Month" },
  { key: "products", label: "Products" },
  { key: "orders30d", label: "Orders (30 days)" },
  { key: "revenue30d", label: "Net sales (30 days)" },
  { key: "storageMb", label: "Storage" },
  { key: "staffCount", label: "Staff" },
];

const MONTH_FORMAT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

// ─── Component ────────────────────────────────────────────────────────────

export function ClientUsageHistory({ tenantId }: { tenantId: string }) {
  const query = useQuery<{ platformUsage: UsageSnapshot[] }>(PLATFORM_USAGE, {
    variables: { tenantId, months: USAGE_HISTORY_MONTHS },
    fetchPolicy: "cache-and-network",
  });
  const rows = useMemo(() => monthlyUsage(query.data?.platformUsage ?? []), [query.data]);

  return (
    <Card title="Usage history" description="The last daily snapshot of each month." padding="none" className="overflow-hidden">
      {query.error ? (
        <ErrorState inline title="Couldn't load the usage history." onRetry={() => void query.refetch()} />
      ) : query.loading && !query.data ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Table
          aria-label="Usage history"
          removeWrapper
          classNames={{
            ...dataTableClassNames,
            base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
            th: dataTableClassNames.th.replace("first:w-12 ", ""),
            td: dataTableClassNames.td.replace("first:w-12 ", ""),
            tr: dataTableClassNames.tr.replace("cursor-pointer ", ""),
          }}
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.key} align={column.key === "month" ? "start" : "end"}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={rows}
            emptyContent={
              <EmptyState icon={IconAnalytics} title="No usage recorded yet" description="The nightly snapshot fills this in." />
            }
          >
            {(row) => (
              <TableRow key={row.month}>
                <TableCell>{MONTH_FORMAT.format(new Date(`${row.month}-01T00:00:00Z`))}</TableCell>
                <TableCell className="text-end num">{formatNumber(row.products)}</TableCell>
                <TableCell className="text-end num">{formatNumber(row.orders30d)}</TableCell>
                <TableCell className="text-end num">{formatMoney(row.revenue30d, { whole: true })}</TableCell>
                <TableCell className="text-end num">{formatNumber(row.storageMb)} MB</TableCell>
                <TableCell className="text-end num">{formatNumber(row.staffCount)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export default ClientUsageHistory;
