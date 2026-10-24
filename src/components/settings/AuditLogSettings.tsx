import { useQuery } from "@apollo/client";
import { PLATFORM_AUDIT_LOG } from "../../graphql/team";
import { useUrlSearch } from "../../hooks/use-url-search";
import { toasts } from "../../copy";
import { TableToolbar } from "../common/TableToolbar";
import {
  CopyableId,
  DataTable,
  EmptyState,
  ErrorState,
  TablePagination,
  formatDateTime,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";

interface AuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: string | null;
  after: string | null;
  ip: string | null;
  at: string;
}

const columns: DataTableColumn[] = [
  { key: "at", label: "When" },
  { key: "actorEmail", label: "Who" },
  { key: "action", label: "Action" },
  { key: "target", label: "Target" },
  { key: "after", label: "Details" },
];

/**
 * Settings › Audit log (PRD-005 FR-8.1): every platform mutation, newest first. Server-paged (50 per page);
 * the action filter and the page live in the URL.
 */
export function AuditLogSettings() {
  const table = useTableUrlState();
  // useUrlSearch writes ?q= once typing stops: one query per pause, not per keystroke (review C-M6).
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const action = table.search.trim();
  const query = useQuery<{ platformAuditLog: { items: AuditEntry[]; totalCount: number } }>(PLATFORM_AUDIT_LOG, {
    variables: { filter: action ? { action } : {}, limit: table.pageSize, offset: table.offset },
    fetchPolicy: "cache-and-network",
  });
  const data = query.data ?? query.previousData;
  const rows = data?.platformAuditLog.items ?? [];
  const total = data?.platformAuditLog.totalCount ?? 0;

  if (query.error) {
    return <ErrorState title="Couldn't load the audit log" description={toasts.genericError} onRetry={() => void query.refetch()} />;
  }

  return (
    <DataTable
      aria-label="Audit log"
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      isLoading={query.loading && !data}
      isReloading={query.loading && !!data}
      stickyFirstColumn
      toolbar={
        <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Filter by action, e.g. tenant.suspend" />
      }
      renderCell={(row, key) => {
        switch (key) {
          case "at":
            return <span className="whitespace-nowrap num">{formatDateTime(row.at)}</span>;
          case "actorEmail":
            return row.actorEmail;
          case "action":
            return <span className="font-mono text-label">{row.action}</span>;
          case "target":
            return (
              <>
                <span className="text-fg-muted">{row.targetType}</span>
                {row.targetId ? <span className="ml-2"><CopyableId value={row.targetId} /></span> : null}
              </>
            );
          case "after":
            return <span className="block max-w-md truncate text-caption text-fg-muted" title={row.after ?? undefined}>{row.after ?? "—"}</span>;
          default:
            return null;
        }
      }}
      footer={
        <TablePagination
          page={table.page}
          pageSize={table.pageSize}
          total={total}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          isDisabled={query.loading}
        />
      }
      emptyContent={<EmptyState title="Nothing logged yet" description="Platform changes appear here as they happen." />}
    />
  );
}
