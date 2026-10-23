import { useQuery } from "@apollo/client";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useState } from "react";
import { PLATFORM_AUDIT_LOG } from "../../graphql/team";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { TableToolbar } from "../common/TableToolbar";
import {
  Button as UiButton,
  Card,
  CopyableId,
  EmptyState,
  ErrorState,
  Skeleton,
  formatDateTime,
  tableRowClasses,
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

const PAGE_SIZE = 25;

const columns = [
  { key: "at", label: "When" },
  { key: "actorEmail", label: "Who" },
  { key: "action", label: "Action" },
  { key: "target", label: "Target" },
  { key: "after", label: "Details" },
];

/** Settings › Audit log (PRD-005 FR-8.1): every platform mutation, newest first. */
export function AuditLogSettings() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  // One query per pause in typing, not per keystroke (review C-M6).
  const action = useDebouncedValue(search.trim());
  const query = useQuery<{ platformAuditLog: { items: AuditEntry[]; totalCount: number } }>(PLATFORM_AUDIT_LOG, {
    variables: { filter: action ? { action } : {}, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    fetchPolicy: "cache-and-network",
  });
  const rows = query.data?.platformAuditLog.items ?? [];
  const total = query.data?.platformAuditLog.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (query.error) {
    return <ErrorState title="Couldn't load the audit log" description={toasts.genericError} onRetry={() => void query.refetch()} />;
  }

  return (
    <Card padding="none">
      <TableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        searchPlaceholder="Filter by action, e.g. tenant.suspend"
      />
      {query.loading && !query.data ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        // removeWrapper: the base slot is the scroll box, so wide rows scroll inside the card on phones.
        <Table aria-label="Audit log" removeWrapper classNames={{ ...dataTableClassNames, base: "overflow-x-auto bg-surface", tr: tableRowClasses }}>
          <TableHeader columns={columns}>{(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}</TableHeader>
          <TableBody items={rows} emptyContent={<EmptyState title="Nothing logged yet" description="Platform changes appear here as they happen." />}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.at)}</span></TableCell>
                <TableCell>{row.actorEmail}</TableCell>
                <TableCell><span className="font-mono text-label">{row.action}</span></TableCell>
                <TableCell>
                  <span className="text-fg-muted">{row.targetType}</span>
                  {row.targetId ? <span className="ml-2"><CopyableId value={row.targetId} /></span> : null}
                </TableCell>
                <TableCell><span className="block max-w-md truncate text-caption text-fg-muted" title={row.after ?? undefined}>{row.after ?? "—"}</span></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-caption text-fg-muted">
          <span>Page {page + 1} of {pages} · {total} entries</span>
          <div className="flex gap-2">
            <UiButton variant="ghost" size="sm" isDisabled={page === 0} onPress={() => setPage((value) => value - 1)}>Previous</UiButton>
            <UiButton variant="ghost" size="sm" isDisabled={page + 1 >= pages} onPress={() => setPage((value) => value + 1)}>Next</UiButton>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
