/**
 * Stores › At risk (PRD-025 FR-5.2, FR-6.5)
 *
 * The stores `platformStoresAtRisk` flags from the nightly snapshot and
 * the master invoices (overdue past grace, no orders in 14 days, checkout
 * failures, dead letters, orders paused), each with its reasons as chips
 * and the figures behind them. Server-paged with `totalCount`; the page
 * lives in the Stores URL like every other table state. A tab of the main
 * stores table since the 2026-10-30 restyle, like Deleted
 * (`RemovedStoresTable`): it takes the table's tabs and renders its own
 * toolbar. Empty until the first nightly run after the PRD-025 deploy.
 */

import { useQuery } from "@apollo/client";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { PLATFORM_STORES_AT_RISK } from "../../graphql/store-profile";
import {
  AT_RISK_EMPTY_COPY,
  AT_RISK_PAGE_SIZE,
  atRiskOffset,
  atRiskPage,
  riskFigures,
  riskReasonChips,
} from "../../lib/store-risk.util";
import type { PlatformStoreAtRisk, PlatformStoreAtRiskList, PlatformTenantStatus } from "../../types/platform-api";
import type { Tone } from "../ui/tones";
import { TableToolbar } from "../common/TableToolbar";
import {
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  TablePagination,
  formatCount,
  formatDate,
  type DataTableColumn,
} from "../ui";
import { IconStoreHealth } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

const columns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "status", label: "Status" },
  { key: "reasons", label: "Why at risk" },
  { key: "figures", label: "Figures" },
  { key: "lastActive", label: "Last active" },
  { key: "snapshot", label: "Snapshot" },
];

const STATUS_VIEW: Readonly<Record<PlatformTenantStatus, { label: string; tone: Tone }>> = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "warning" },
  DELETED: { label: "Deleted", tone: "danger" },
};

// ─── Component ────────────────────────────────────────────────────────────

export interface AtRiskStoresTableProps {
  /** The stores table's tabs, so the At risk tab sits in the same row as the others. */
  tabs: ReactNode;
  /** 1-based page from the URL. */
  page: number;
  onPageChange: (page: number) => void;
}

export function AtRiskStoresTable({ tabs, page, onPageChange }: AtRiskStoresTableProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const query = useQuery<{ platformStoresAtRisk: PlatformStoreAtRiskList }>(PLATFORM_STORES_AT_RISK, {
    variables: { limit: AT_RISK_PAGE_SIZE, offset: atRiskOffset(page) },
    fetchPolicy: "cache-and-network",
  });
  const data = query.data ?? query.previousData;
  const total = data?.platformStoresAtRisk.totalCount ?? 0;
  const rows = data?.platformStoresAtRisk.items ?? [];
  const safePage = atRiskPage(page, total);
  // Search narrows the loaded page only (the server list has no search argument), as the Deleted tab does.
  const term = search.trim().toLowerCase();
  const shown = term ? rows.filter((row) => [row.name, row.slug].some((text) => text.toLowerCase().includes(term))) : rows;

  const toolbar = (
    <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search loaded stores" tabs={tabs} />
  );

  // A stale URL page past the end (a store recovered) falls back to the last page.
  useEffect(() => {
    if (data && safePage !== page) onPageChange(safePage);
  }, [data, onPageChange, page, safePage]);

  const renderCell = (row: PlatformStoreAtRisk, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0 max-w-64">
            <p className="truncate font-medium text-fg">{row.name}</p>
            <p className="truncate text-caption text-fg-subtle">{row.slug}</p>
          </div>
        );
      case "status": {
        const view = STATUS_VIEW[row.status] ?? { label: row.status, tone: "neutral" as Tone };
        return <Chip tone={view.tone}>{view.label}</Chip>;
      }
      case "reasons":
        return (
          <div className="flex flex-wrap gap-1.5">
            {riskReasonChips(row.reasons).map((chip) => (
              <Chip key={chip.key} tone={chip.tone}>
                {chip.label}
              </Chip>
            ))}
          </div>
        );
      case "figures": {
        const figures = riskFigures(row);
        return figures.length > 0 ? (
          <span className="text-label text-fg-muted num">
            {figures.map((figure) => `${formatCount(figure.value)} ${figure.label}`).join(" · ")}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        );
      }
      case "lastActive":
        return <span className="whitespace-nowrap num">{formatDate(row.lastActiveAt)}</span>;
      case "snapshot":
        return <span className="whitespace-nowrap num">{formatDate(row.snapshotDate)}</span>;
      default:
        return null;
    }
  };

  if (query.error && !data) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <ErrorState title="Couldn't load the stores at risk." onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <DataTable
      aria-label="Stores at risk"
      columns={columns}
      rows={shown}
      getRowKey={(row) => row.tenantId}
      renderCell={renderCell}
      isLoading={query.loading && !data}
      toolbar={toolbar}
      footer={
        <TablePagination
          page={safePage}
          pageSize={AT_RISK_PAGE_SIZE}
          total={total}
          onPageChange={onPageChange}
          isDisabled={query.loading}
        />
      }
      onRowAction={(row) => navigate(`/stores/${row.tenantId}`)}
      stickyFirstColumn
      emptyContent={
        term ? (
          <EmptyState icon={IconStoreHealth} title="No stores match" description={`Nothing loaded matches "${search.trim()}".`} />
        ) : (
          <EmptyState icon={IconStoreHealth} title={AT_RISK_EMPTY_COPY.title} description={AT_RISK_EMPTY_COPY.description} />
        )
      }
    />
  );
}

export default AtRiskStoresTable;
