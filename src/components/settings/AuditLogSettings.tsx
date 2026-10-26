import { useQuery } from "@apollo/client";
import { PLATFORM_AUDIT_LOG } from "../../graphql/team";
import { useUrlSearch } from "../../hooks/use-url-search";
import { auditFilterOf, auditSearchErrorCopy } from "../../lib/audit-filter.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { toasts } from "../../copy";
import { TableToolbar } from "../common/TableToolbar";
import { IconLock } from "../ui/icons";
import {
  Card,
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
  const { can } = useAuth();
  // PRD-014 UX-27: `platformAuditLog` needs audit:read (not billing or support roles).
  const canReadAudit = can(PLATFORM_PERMISSIONS.AUDIT_READ);
  const table = useTableUrlState();
  // useUrlSearch writes ?q= once typing stops: one query per pause, not per keystroke (review C-M6).
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  // Prefix match on the action name (PRD-014 close-out): "coupon." finds every coupon change.
  const prefix = table.search.trim();
  const query = useQuery<{ platformAuditLog: { items: AuditEntry[]; totalCount: number } }>(PLATFORM_AUDIT_LOG, {
    variables: { filter: auditFilterOf(prefix), limit: table.pageSize, offset: table.offset },
    fetchPolicy: "cache-and-network",
    skip: !canReadAudit,
  });
  const data = query.data ?? query.previousData;
  const rows = data?.platformAuditLog.items ?? [];
  const total = data?.platformAuditLog.totalCount ?? 0;

  if (!canReadAudit) {
    return (
      <Card>
        <EmptyState
          icon={IconLock}
          title="Your role can't see the audit log"
          description="The owner, admins and read-only members can. Ask the owner if you need it."
        />
      </Card>
    );
  }

  const searchError = query.error ? auditSearchErrorCopy(query.error) : null;
  if (query.error && !searchError) {
    return <ErrorState title="Couldn't load the audit log." description={toasts.genericError} onRetry={() => void query.refetch()} />;
  }

  return (
    <DataTable
      aria-label="Audit log"
      columns={columns}
      rows={searchError ? [] : rows}
      getRowKey={(row) => row.id}
      isLoading={query.loading && !data}
      isReloading={query.loading && !!data}
      stickyFirstColumn
      toolbar={
        <>
          <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Action starts with, e.g. tenant. or coupon.create" />
          {searchError ? (
            <p role="alert" className="px-4 py-2 text-caption text-danger">{searchError}</p>
          ) : null}
        </>
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
      emptyContent={
        prefix ? (
          <EmptyState icon={IconLock} title="No matching actions" description="No action name starts with that text. The search is case-sensitive." />
        ) : (
          <EmptyState icon={IconLock} title="Nothing logged yet" description="Platform changes appear here as they happen." />
        )
      }
    />
  );
}
