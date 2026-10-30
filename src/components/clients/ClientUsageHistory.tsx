/**
 * Store page › Usage history (PRD-014 PLT-13, 04 S-03e): `platformUsage`, one row per month (the month's last
 * daily snapshot), as the server recorded it. The card has no title of its own: the section title says it.
 * Widths fit the 724px content column (fixed 490 → Month 234px); no row click; a footer only past 30 months.
 */

import { useQuery } from "@apollo/client";
import { useMemo, useState } from "react";

import { PLATFORM_USAGE } from "../../graphql/tenants";
import { monthlyUsage, USAGE_HISTORY_MONTHS, type UsageSnapshot } from "../../lib/usage-history.util";
import { formatNumber } from "../../lib/utils";
import {
  DEFAULT_PAGE_SIZE,
  DataTable,
  EmptyState,
  ErrorState,
  TablePagination,
  formatMoney,
  type DataTableColumn,
} from "../ui";
import { IconAnalytics } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

const columns: DataTableColumn[] = [
  { key: "month", label: "Month", mobile: "primary" },
  { key: "products", label: "Products", width: 90 },
  { key: "orders30d", label: "Orders · 30 days", width: 110 },
  { key: "revenue30d", label: "Net sales · 30 days", width: 130 },
  { key: "storageMb", label: "Storage", width: 90 },
  { key: "staffCount", label: "Staff", width: 70 },
];

const MONTH_FORMAT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

// ─── Component ────────────────────────────────────────────────────────────

export function ClientUsageHistory({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery<{ platformUsage: UsageSnapshot[] }>(PLATFORM_USAGE, {
    variables: { tenantId, months: USAGE_HISTORY_MONTHS },
    fetchPolicy: "cache-and-network",
  });
  const rows = useMemo(() => monthlyUsage(query.data?.platformUsage ?? []), [query.data]);
  const pageRows = rows.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE);

  if (query.error && !query.data) {
    return <ErrorState title="Couldn't load the usage history." onRetry={() => void query.refetch()} />;
  }

  return (
    <DataTable
      aria-label="Usage history"
      columns={columns}
      rows={pageRows}
      getRowKey={(row) => row.month}
      isLoading={query.loading && !query.data}
      renderCell={(row, key) => {
        switch (key) {
          case "month":
            return MONTH_FORMAT.format(new Date(`${row.month}-01T00:00:00Z`));
          case "products":
            return <span className="num">{formatNumber(row.products)}</span>;
          case "orders30d":
            return <span className="num">{formatNumber(row.orders30d)}</span>;
          case "revenue30d":
            return <span className="num">{formatMoney(row.revenue30d, { whole: true })}</span>;
          case "storageMb":
            return <span className="num">{formatNumber(row.storageMb)} MB</span>;
          case "staffCount":
            return <span className="num">{formatNumber(row.staffCount)}</span>;
          default:
            return null;
        }
      }}
      footer={
        rows.length > DEFAULT_PAGE_SIZE ? (
          <TablePagination page={page} pageSize={DEFAULT_PAGE_SIZE} total={rows.length} onPageChange={setPage} />
        ) : undefined
      }
      emptyContent={
        <EmptyState icon={IconAnalytics} title="No usage recorded yet" description="The nightly snapshot fills this in." />
      }
    />
  );
}

export default ClientUsageHistory;
