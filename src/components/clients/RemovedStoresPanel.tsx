/**
 * Stores › Deleted and purged stores (PRD-018 FR-2.3, FR-2.5, §6 console)
 *
 * Two server-paged lists under the stores table: stores DELETED and still
 * inside their grace period (`platformTenants` with status DELETED; each
 * opens the store page, where it can be restored) and the tombstones of
 * purged stores (`platformPurgedTenants`). Neither list holds shopper
 * data.
 */

import { useQuery } from "@apollo/client";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLATFORM_DELETED_TENANTS, PLATFORM_PURGED_TENANTS } from "../../graphql/tenants";
import { nextOffset } from "../../lib/offset-paging.util";
import { purgeCountdown } from "../../lib/tenant-lifecycle.util";
import { formatDate } from "../../lib/utils";
import type { PlatformList, PlatformTenant, TenantPurgeRecord } from "../../types/platform-api";
import { compactTableClassNames } from "../common/dataTableStyles";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { Card, EmptyState, ErrorState, SegmentedControl, Skeleton } from "../ui";
import { IconDelete } from "../ui/icons";

/** One page of each list. */
const REMOVED_PAGE_LIMIT = 50;

type View = "deleted" | "purged";

type DeletedRow = Pick<PlatformTenant, "id" | "slug" | "name" | "domain" | "purgeAfter">;

export function RemovedStoresPanel() {
  const [view, setView] = useState<View>("deleted");
  return (
    <Card
      title="Deleted and purged stores"
      actions={
        <SegmentedControl
          aria-label="Which stores"
          value={view}
          onChange={setView}
          options={[
            { value: "deleted", label: "Deleted (in grace)" },
            { value: "purged", label: "Purged" },
          ]}
        />
      }
      padding="none"
    >
      {view === "deleted" ? <DeletedStores /> : <PurgedStores />}
    </Card>
  );
}

function usePaged<T>(
  document: typeof PLATFORM_DELETED_TENANTS,
  field: "platformTenants" | "platformPurgedTenants",
) {
  const query = useQuery<Record<string, PlatformList<T>>>(document, {
    variables: { limit: REMOVED_PAGE_LIMIT, offset: 0 },
    fetchPolicy: "cache-and-network",
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

function ListState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4" role="status" aria-label="Loading">
        <Skeleton className="h-5 w-full rounded" />
        <Skeleton className="h-5 w-4/5 rounded" />
      </div>
    );
  }
  if (error) {
    return <ErrorState title="Couldn't load these stores." onRetry={onRetry} />;
  }
  return null;
}

function DeletedStores() {
  const navigate = useNavigate();
  const { query, rows, total, hasMore, loadMore, loadingMore } = usePaged<DeletedRow>(
    PLATFORM_DELETED_TENANTS,
    "platformTenants",
  );
  if (!query.data) {
    return (
      <ListState loading={query.loading} error={!!query.error} onRetry={() => void query.refetch()} />
    );
  }
  return (
    <>
      <Table
        aria-label="Deleted stores in their grace period"
        removeWrapper
        classNames={compactTableClassNames}
        onRowAction={(key) => navigate(`/stores/${String(key)}`)}
      >
        <TableHeader>
          <TableColumn>Store</TableColumn>
          <TableColumn>Domain</TableColumn>
          <TableColumn>Purged on</TableColumn>
        </TableHeader>
        <TableBody
          items={rows}
          emptyContent={
            <EmptyState
              icon={IconDelete}
              title="No deleted stores"
              description="A deleted store stays here, restorable, until its grace period ends."
            />
          }
        >
          {(row) => {
            const countdown = purgeCountdown(row.purgeAfter);
            return (
              <TableRow key={row.id} className="cursor-pointer">
                <TableCell>
                  <p className="font-medium text-fg">{row.name}</p>
                  <p className="text-caption text-fg-subtle">{row.slug}</p>
                </TableCell>
                <TableCell>{row.domain ?? <span className="text-fg-subtle">—</span>}</TableCell>
                <TableCell>
                  {row.purgeAfter ? (
                    <span className="num">
                      {formatDate(row.purgeAfter)}
                      {countdown && !countdown.expired ? ` · ${countdown.daysLeft} days left` : " · purging"}
                    </span>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          }}
        </TableBody>
      </Table>
      <LoadMoreFooter
        shown={rows.length}
        total={total}
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        noun="deleted stores"
      />
    </>
  );
}

function PurgedStores() {
  const { query, rows, total, hasMore, loadMore, loadingMore } = usePaged<TenantPurgeRecord>(
    PLATFORM_PURGED_TENANTS,
    "platformPurgedTenants",
  );
  if (!query.data) {
    return (
      <ListState loading={query.loading} error={!!query.error} onRetry={() => void query.refetch()} />
    );
  }
  return (
    <>
      <Table aria-label="Purged stores" removeWrapper classNames={compactTableClassNames}>
        <TableHeader>
          <TableColumn>Store</TableColumn>
          <TableColumn>Domain</TableColumn>
          <TableColumn>Deleted</TableColumn>
          <TableColumn>Purged</TableColumn>
          <TableColumn>Reason</TableColumn>
        </TableHeader>
        <TableBody
          items={rows}
          emptyContent={
            <EmptyState
              icon={IconDelete}
              title="No purged stores"
              description="Stores appear here once their data has been purged."
            />
          }
        >
          {(row) => (
            <TableRow key={row.tenantId}>
              <TableCell>
                <p className="font-medium text-fg">{row.name}</p>
                <p className="text-caption text-fg-subtle">{row.slug}</p>
              </TableCell>
              <TableCell>{row.domain ?? <span className="text-fg-subtle">—</span>}</TableCell>
              <TableCell>
                <span className="num">{formatDate(row.deletedAt)}</span>
              </TableCell>
              <TableCell>
                <span className="num">{formatDate(row.purgedAt)}</span>
              </TableCell>
              <TableCell>{row.reason ?? <span className="text-fg-subtle">—</span>}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <LoadMoreFooter
        shown={rows.length}
        total={total}
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        noun="purged stores"
      />
    </>
  );
}
