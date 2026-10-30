/**
 * Settings › Audit log (04 S-07h, PRD-005 FR-8.1): every platform change, newest first, 30 a page. The table fits
 * its card; the details open in a drawer. Search is a prefix match on the action name; the filter drawer narrows
 * by person (`actorId`) and action area (an action prefix). Readable action names wait for Check first 05 #6.
 */
import { useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
import { addToast } from "@heroui/react";
import { PLATFORM_AUDIT_LOG, PLATFORM_USERS } from "../../graphql/team";
import { useUrlSearch } from "../../hooks/use-url-search";
import { auditFilterOf, auditSearchErrorCopy } from "../../lib/audit-filter.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type { PlatformList, PlatformUser } from "../../types/platform-api";
import { toasts } from "../../copy";
import {
  Button,
  Card,
  DataTable,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterDrawer,
  SearchInput,
  TablePagination,
  countActiveFilters,
  formatDateTime,
  toastError,
  useTableUrlState,
  type DataTableColumn,
  type FilterGroup,
  type FilterValues,
} from "../ui";
import { IconDuplicate, IconLock, IconView } from "../ui/icons";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

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

/** Fixed 466 → Action 218px in the 684px column. */
const columns: DataTableColumn[] = [
  { key: "at", label: "When", width: 140 },
  { key: "who", label: "Who", width: 140 },
  { key: "action", label: "Action" },
  { key: "target", label: "Target", width: 130 },
];

/** Action areas with one action prefix each (Billing spans several prefixes, so it isn't offered yet). */
const AREAS = [
  { value: "tenant.", label: "Stores" },
  { value: "plan.", label: "Plans" },
  { value: "coupon.", label: "Discounts" },
  { value: "ai.", label: "ZCOM AI" },
  { value: "user.", label: "Team" },
  { value: "auth.", label: "Sign-in" },
  { value: "settings.", label: "Settings" },
];

/** The details JSON, pretty-printed when it parses. */
function pretty(text: string | null): string | null {
  if (!text) return null;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function AuditLogSettings() {
  const { can } = useAuth();
  const { getClient } = useClients();
  // PRD-014 UX-27: `platformAuditLog` needs audit:read (not billing or support roles).
  const canReadAudit = can(PLATFORM_PERMISSIONS.AUDIT_READ);
  const canListUsers = can(PLATFORM_PERMISSIONS.USERS_MANAGE);
  const table = useTableUrlState();
  // useUrlSearch writes ?q= once typing stops: one query per pause, not per keystroke (review C-M6).
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewing, setViewing] = useState<AuditEntry | null>(null);

  const area = table.filters.area ?? "";
  const person = table.filters.person ?? "";
  const prefix = `${area}${table.search.trim()}`;
  const filter = { ...auditFilterOf(prefix), ...(person ? { actorId: person } : {}) };

  const query = useQuery<{ platformAuditLog: { items: AuditEntry[]; totalCount: number } }>(PLATFORM_AUDIT_LOG, {
    variables: { filter, limit: table.pageSize, offset: table.offset },
    fetchPolicy: "cache-and-network",
    skip: !canReadAudit,
  });
  const users = useQuery<{ platformUsers: PlatformList<PlatformUser> }>(PLATFORM_USERS, {
    variables: { limit: 100, offset: 0 },
    skip: !canReadAudit || !canListUsers,
    fetchPolicy: "cache-first",
  });
  const data = query.data ?? query.previousData;
  const rows = data?.platformAuditLog.items ?? [];
  const total = data?.platformAuditLog.totalCount ?? 0;

  const groups = useMemo<FilterGroup[]>(() => {
    const list: FilterGroup[] = [];
    const people = users.data?.platformUsers.items ?? [];
    if (people.length) {
      list.push({ key: "person", label: "Person", type: "single", options: people.map((user) => ({ value: user.id, label: user.name || user.email })) });
    }
    list.push({ key: "area", label: "Action area", type: "single", options: AREAS });
    return list;
  }, [users.data]);
  const filterValues: FilterValues = { area, person };

  const targetName = (row: AuditEntry) =>
    row.targetType === "tenant" && row.targetId ? (getClient(row.targetId)?.storeName ?? null) : null;

  const copyEntry = (row: AuditEntry) => {
    void navigator.clipboard
      ?.writeText(JSON.stringify(row, null, 2))
      .then(() => addToast({ title: "Entry copied." }))
      .catch(() => toastError("Couldn't copy the entry."));
  };

  if (!canReadAudit) {
    return (
      <div>
        <SettingsSectionHeader section="audit" />
        <Card>
          <EmptyState
            icon={IconLock}
            title="Your role can't see the audit log"
            description="The owner, admins and read-only members can. Ask the owner if you need it."
          />
        </Card>
      </div>
    );
  }

  const searchError = query.error ? auditSearchErrorCopy(query.error) : null;
  const filtered = !!prefix || !!person;

  return (
    <div>
      <SettingsSectionHeader section="audit" />
      {query.error && !searchError ? (
        <ErrorState title="Couldn't load the audit log." description={toasts.genericError} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          aria-label="Audit log"
          columns={columns}
          rows={searchError ? [] : rows}
          getRowKey={(row) => row.id}
          isLoading={query.loading && !data}
          isReloading={query.loading && !!data}
          rowHeight="tall"
          onRowAction={setViewing}
          rowActions={(row) => [
            { key: "view", label: "View details", icon: IconView, onSelect: () => setViewing(row) },
            { key: "copy", label: "Copy entry", icon: IconDuplicate, onSelect: () => copyEntry(row) },
          ]}
          rowActionsLabel={(row) => `Actions for ${row.action}`}
          toolbar={
            <>
              <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2">
                <SearchInput
                  placement="toolbar"
                  placeholder="Search actions, e.g. tenant."
                  value={search}
                  onValueChange={setSearch}
                  onClear={() => setSearch("")}
                />
                <FilterButton count={countActiveFilters(filterValues)} onPress={() => setFiltersOpen(true)} />
              </div>
              {searchError ? (
                <p role="alert" className="px-4 py-2 text-label text-tone-danger-text">
                  {searchError}
                </p>
              ) : null}
            </>
          }
          renderCell={(row, key) => {
            switch (key) {
              case "at":
                return <span className="whitespace-nowrap num">{formatDateTime(row.at)}</span>;
              case "who":
                return <span className="block truncate" title={row.actorEmail}>{row.actorEmail}</span>;
              case "action":
                return <span className="block truncate font-mono text-label">{row.action}</span>;
              case "target": {
                const name = targetName(row);
                return name ? (
                  <span className="block truncate">{name}</span>
                ) : row.targetId ? (
                  <span className="block truncate font-mono text-label text-fg-muted" title={row.targetId}>
                    {row.targetId}
                  </span>
                ) : (
                  <span className="text-fg-muted">{row.targetType}</span>
                );
              }
              default:
                return null;
            }
          }}
          mobileRow={(row) => (
            <div className="min-w-0">
              <p className="truncate font-mono text-label font-medium text-fg">{row.action}</p>
              <p className="truncate text-label text-fg-muted num">
                {formatDateTime(row.at)} · {row.actorEmail}
                {targetName(row) ? ` · ${targetName(row)}` : ""}
              </p>
            </div>
          )}
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
            filtered ? (
              <EmptyState
                kind="no-results"
                icon={IconLock}
                title="No matching entries"
                description="No action matches that search and filter. The search is case-sensitive."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setSearch("");
                      table.clearFilters();
                    }}
                  >
                    Clear search and filters
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={IconLock} title="Nothing logged yet" description="Platform changes appear here as they happen." />
            )
          }
        />
      )}

      <FilterDrawer
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={groups}
        value={filterValues}
        onApply={(values) => {
          table.setFilter("area", typeof values.area === "string" ? values.area : undefined);
          table.setFilter("person", typeof values.person === "string" ? values.person : undefined);
        }}
        onClear={() => table.clearFilters()}
      />

      <Drawer isOpen={viewing != null} onOpenChange={(open) => !open && setViewing(null)} size="sm">
        <DrawerContent>
          <DrawerHeader>Audit entry</DrawerHeader>
          <DrawerBody>{viewing ? <EntryDetails entry={viewing} storeName={targetName(viewing)} onCopy={() => copyEntry(viewing)} /> : null}</DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function EntryDetails({ entry, storeName, onCopy }: { entry: AuditEntry; storeName: string | null; onCopy: () => void }) {
  const fields: [string, string][] = [
    ["When", formatDateTime(entry.at)],
    ["Who", entry.actorEmail],
    ["Action", entry.action],
    ["Target", storeName ? `${storeName} (${entry.targetType})` : entry.targetType],
    ["Target id", entry.targetId ?? "—"],
    ["IP address", entry.ip ?? "—"],
  ];
  const before = pretty(entry.before);
  const after = pretty(entry.after);
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-body">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="break-all text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {[
        ["Before", before],
        ["After", after],
      ].map(([label, text]) =>
        text ? (
          <div key={label}>
            <p className="mb-1.5 text-label font-medium text-fg">{label}</p>
            <pre className="whitespace-pre-wrap break-all rounded-xl bg-surface-sunken p-3 font-mono text-caption text-fg">{text}</pre>
          </div>
        ) : null,
      )}
      <div>
        <Button variant="secondary" size="sm" startIcon={<IconDuplicate aria-hidden />} onPress={onCopy}>
          Copy entry
        </Button>
      </div>
    </div>
  );
}
