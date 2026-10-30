/**
 * Stores › Deleted (04 S-02, PRD-018 FR-2.3, FR-2.5). Two server-paged lists behind a small switch with counts:
 * stores deleted and still inside their grace period (they open the store page, where they can be restored) and
 * the records of purged stores. Live columns, labels and empty text are kept ("Purged on" stays: 05 #14).
 */

import { useQuery } from "@apollo/client";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PLATFORM_DELETED_TENANTS, PLATFORM_PURGED_TENANTS } from "../../../graphql/tenants";
import { nextOffset } from "../../../lib/offset-paging.util";
import { purgeCountdown } from "../../../lib/tenant-lifecycle.util";
import { formatDate } from "../../../lib/utils";
import type { PlatformList, PlatformTenant, TenantPurgeRecord } from "../../../types/platform-api";
import { LoadMoreFooter } from "../../common/LoadMoreFooter";
import { DataTable, EmptyState, ErrorState, SegmentedSwitch, type DataTableColumn } from "../../ui";
import { IconDelete, IconUndo } from "../../ui/icons";
import { StoresToolbar } from "./StoresToolbar";

const PAGE_LIMIT = 50;

type View = "deleted" | "purged";
type DeletedRow = Pick<PlatformTenant, "id" | "slug" | "name" | "domain" | "purgeAfter">;

const deletedColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "domain", label: "Domain", width: 180 },
  { key: "purgeAfter", label: "Purged on", width: 150 },
];

const purgedColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "domain", label: "Domain", width: 180 },
  { key: "deletedAt", label: "Deleted", width: 130 },
  { key: "purgedAt", label: "Purged", width: 130 },
  { key: "reason", label: "Reason" },
];

const dash = <span className="text-fg-subtle">—</span>;

function usePaged<T>(document: typeof PLATFORM_DELETED_TENANTS, field: "platformTenants" | "platformPurgedTenants") {
  const query = useQuery<Record<string, PlatformList<T>>>(document, {
    variables: { limit: PAGE_LIMIT, offset: 0 },
    fetchPolicy: "cache-and-network",
  });
  const page = query.data?.[field];
  const rows = useMemo(() => page?.items ?? [], [page]);
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offset = nextOffset(page, PAGE_LIMIT, lastPageSize);
  const { fetchMore } = query;
  const loadMore = useCallback(async () => {
    if (offset === null) return;
    setLoadingMore(true);
    try {
      const result = await fetchMore({ variables: { offset } });
      setLastPageSize(result.data[field]?.items.length ?? 0);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMore, field, offset]);
  return { query, rows, total: page?.totalCount, hasMore: offset !== null, loadMore, loadingMore };
}

function StoreCell({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-body font-medium text-fg">{name}</p>
      <p className="truncate text-label text-fg-muted">{slug}</p>
    </div>
  );
}

export interface DeletedStoresTableProps {
  /** The page's status switch, so Deleted sits in the same row as the other tabs. */
  tabs: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  /** The applied search (from the URL). */
  query: string;
}

export function DeletedStoresTable({ tabs, search, onSearchChange, query }: DeletedStoresTableProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("deleted");
  const deleted = usePaged<DeletedRow>(PLATFORM_DELETED_TENANTS, "platformTenants");
  const purged = usePaged<TenantPurgeRecord>(PLATFORM_PURGED_TENANTS, "platformPurgedTenants");
  const term = query.trim().toLowerCase();
  const matches = (row: { name: string; slug: string; domain?: string | null }) =>
    !term || [row.name, row.slug, row.domain ?? ""].some((text) => text.toLowerCase().includes(term));

  const toolbar = (
    <StoresToolbar tabs={tabs} search={search} onSearchChange={onSearchChange}>
      <SegmentedSwitch<View>
        size="sm"
        ariaLabel="Which stores"
        value={view}
        onChange={setView}
        items={[
          { value: "deleted", label: "In grace period", count: deleted.total ?? null },
          { value: "purged", label: "Purged", count: purged.total ?? null },
        ]}
      />
    </StoresToolbar>
  );

  const active = view === "deleted" ? deleted : purged;
  const emptyContent = term ? (
    <EmptyState kind="no-results" icon={IconDelete} onClearFilters={() => onSearchChange("")} />
  ) : view === "deleted" ? (
    <EmptyState
      icon={IconDelete}
      title="No deleted stores"
      description="A deleted store stays here, restorable, until its grace period ends."
    />
  ) : (
    <EmptyState icon={IconDelete} title="No purged stores" description="Stores appear here once their data has been purged." />
  );

  if (active.query.error && !active.query.data) {
    return (
      <div className="overflow-clip rounded-[var(--zc-radius-card)] border border-line bg-surface">
        {toolbar}
        <ErrorState title="Couldn't load these stores." onRetry={() => void active.query.refetch()} />
      </div>
    );
  }

  const footer = (
    <LoadMoreFooter
      shown={active.rows.length}
      total={active.total ?? active.rows.length}
      hasMore={active.hasMore}
      loading={active.loadingMore}
      onLoadMore={active.loadMore}
      noun={view === "deleted" ? "deleted stores" : "purged stores"}
    />
  );

  return view === "deleted" ? (
    <DataTable
      aria-label="Deleted stores in their grace period"
      columns={deletedColumns}
      rows={deleted.rows.filter(matches)}
      getRowKey={(row) => row.id}
      isLoading={!deleted.query.data && deleted.query.loading}
      rowHeight="tall"
      stickyFirstColumn
      toolbar={toolbar}
      footer={deleted.rows.length > 0 ? footer : null}
      onRowAction={(row) => navigate(`/stores/${row.id}/overview`)}
      // The live app restores a deleted store from its page (Lifecycle).
      rowActions={(row) => [
        { key: "restore", label: "Restore store", icon: IconUndo, onSelect: () => navigate(`/stores/${row.id}/lifecycle`) },
      ]}
      rowActionsLabel={(row) => `Actions for ${row.name}`}
      emptyContent={emptyContent}
      renderCell={(row, key) => {
        switch (key) {
          case "store":
            return <StoreCell name={row.name} slug={row.slug} />;
          case "domain":
            return row.domain ? <span className="block truncate">{row.domain}</span> : dash;
          default: {
            if (!row.purgeAfter) return dash;
            const countdown = purgeCountdown(row.purgeAfter);
            return (
              <div className="flex flex-col">
                <span className="num">{formatDate(row.purgeAfter)}</span>
                <span className="text-label text-fg-muted num">
                  {countdown && !countdown.expired ? `${countdown.daysLeft} days left` : "Purging"}
                </span>
              </div>
            );
          }
        }
      }}
    />
  ) : (
    <DataTable
      aria-label="Purged stores"
      columns={purgedColumns}
      rows={purged.rows.filter(matches)}
      getRowKey={(row) => row.tenantId}
      isLoading={!purged.query.data && purged.query.loading}
      rowHeight="tall"
      stickyFirstColumn
      toolbar={toolbar}
      footer={purged.rows.length > 0 ? footer : null}
      emptyContent={emptyContent}
      renderCell={(row, key) => {
        switch (key) {
          case "store":
            return <StoreCell name={row.name} slug={row.slug} />;
          case "domain":
            return row.domain ? <span className="block truncate">{row.domain}</span> : dash;
          case "deletedAt":
            return <span className="num">{formatDate(row.deletedAt)}</span>;
          case "purgedAt":
            return <span className="num">{formatDate(row.purgedAt)}</span>;
          default:
            return row.reason ? <span className="block truncate">{row.reason}</span> : dash;
        }
      }}
    />
  );
}
