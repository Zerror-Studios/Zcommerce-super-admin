/**
 * Stores › Deleted tab (PRD-018 FR-2.3, FR-2.5, §6 console)
 *
 * Since 2026-10-28 (owner) the deleted and purged stores are a tab of the
 * main stores table instead of a second table under it. Two server-paged
 * lists, picked with a segmented control: stores DELETED and still inside
 * their grace period (`platformTenants` with status DELETED; each opens the
 * store page, where it can be restored) and the tombstones of purged stores
 * (`platformPurgedTenants`). Neither list holds shopper data.
 */

import { useQuery } from "@apollo/client";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PLATFORM_DELETED_TENANTS, PLATFORM_PURGED_TENANTS } from "../../graphql/tenants";
import { nextOffset } from "../../lib/offset-paging.util";
import { purgeCountdown } from "../../lib/tenant-lifecycle.util";
import { formatDate } from "../../lib/utils";
import type { PlatformList, PlatformTenant, TenantPurgeRecord } from "../../types/platform-api";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { TableToolbar } from "../common/TableToolbar";
import { DataTable, EmptyState, ErrorState, SegmentedControl, type DataTableColumn } from "../ui";
import { IconDelete } from "../ui/icons";

/** One page of each list. */
export const REMOVED_PAGE_LIMIT = 50;

type View = "deleted" | "purged";

type DeletedRow = Pick<PlatformTenant, "id" | "slug" | "name" | "domain" | "purgeAfter">;

const deletedColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "domain", label: "Domain" },
  { key: "purgeAfter", label: "Purged on" },
];

const purgedColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "domain", label: "Domain" },
  { key: "deletedAt", label: "Deleted" },
  { key: "purgedAt", label: "Purged" },
  { key: "reason", label: "Reason" },
];

const dash = <span className="text-fg-subtle">—</span>;

/** The deleted stores' total, for the Deleted tab's count (same query and variables, so one cache entry). */
export function useDeletedStoreCount(skip: boolean): number | undefined {
  const query = useQuery<{ platformTenants: PlatformList<DeletedRow> }>(PLATFORM_DELETED_TENANTS, {
    variables: { limit: REMOVED_PAGE_LIMIT, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip,
  });
  return query.data?.platformTenants.totalCount;
}

export interface RemovedStoresTableProps {
  /** The stores table's tabs, so the Deleted tab sits in the same row as the others. */
  tabs: ReactNode;
}

export function RemovedStoresTable({ tabs }: RemovedStoresTableProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("deleted");
  const [search, setSearch] = useState("");
  const deleted = usePaged<DeletedRow>(PLATFORM_DELETED_TENANTS, "platformTenants", view !== "deleted");
  const purged = usePaged<TenantPurgeRecord>(PLATFORM_PURGED_TENANTS, "platformPurgedTenants", view !== "purged");
  const term = search.trim().toLowerCase();
  const matches = (row: { name: string; slug: string; domain?: string | null }) =>
    !term || [row.name, row.slug, row.domain ?? ""].some((text) => text.toLowerCase().includes(term));

  const toolbar = (
    <TableToolbar
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search loaded stores"
      tabs={tabs}
      endContent={
        <SegmentedControl
          aria-label="Which stores"
          value={view}
          onChange={setView}
          options={[
            { value: "deleted", label: "In grace period" },
            { value: "purged", label: "Purged" },
          ]}
        />
      }
    />
  );

  const active = view === "deleted" ? deleted : purged;
  const filtered = !!term;
  const emptyContent = filtered ? (
    <EmptyState icon={IconDelete} title="No stores match" description={`Nothing loaded matches "${search.trim()}".`} />
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
      <>
        {toolbar}
        <ErrorState title="Couldn't load these stores." onRetry={() => void active.query.refetch()} />
      </>
    );
  }

  const footer = (
    <LoadMoreFooter
      shown={active.rows.length}
      total={active.total}
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
      toolbar={toolbar}
      footer={deleted.rows.length > 0 ? footer : null}
      onRowAction={(row) => navigate(`/stores/${row.id}`)}
      emptyContent={emptyContent}
      renderCell={(row, key) => {
        switch (key) {
          case "store":
            return <StoreCell name={row.name} slug={row.slug} />;
          case "domain":
            return row.domain ?? dash;
          default: {
            if (!row.purgeAfter) return dash;
            const countdown = purgeCountdown(row.purgeAfter);
            return (
              <span className="num">
                {formatDate(row.purgeAfter)}
                {countdown && !countdown.expired ? ` · ${countdown.daysLeft} days left` : " · purging"}
              </span>
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
      toolbar={toolbar}
      footer={purged.rows.length > 0 ? footer : null}
      emptyContent={emptyContent}
      renderCell={(row, key) => {
        switch (key) {
          case "store":
            return <StoreCell name={row.name} slug={row.slug} />;
          case "domain":
            return row.domain ?? dash;
          case "deletedAt":
            return <span className="num">{formatDate(row.deletedAt)}</span>;
          case "purgedAt":
            return <span className="num">{formatDate(row.purgedAt)}</span>;
          default:
            return row.reason ?? dash;
        }
      }}
    />
  );
}

function StoreCell({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="min-w-0 max-w-64">
      <p className="truncate font-medium text-fg">{name}</p>
      <p className="truncate text-caption text-fg-subtle">{slug}</p>
    </div>
  );
}

function usePaged<T>(
  document: typeof PLATFORM_DELETED_TENANTS,
  field: "platformTenants" | "platformPurgedTenants",
  skip: boolean,
) {
  const query = useQuery<Record<string, PlatformList<T>>>(document, {
    variables: { limit: REMOVED_PAGE_LIMIT, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip,
  });
  const page = query.data?.[field];
  const rows = useMemo(() => page?.items ?? [], [page]);
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offset = nextOffset(page, REMOVED_PAGE_LIMIT, lastPageSize);
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
  return { query, rows, total: page?.totalCount ?? rows.length, hasMore: offset !== null, loadMore, loadingMore };
}
