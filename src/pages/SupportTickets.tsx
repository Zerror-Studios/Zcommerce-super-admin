import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { PageHeader } from "../components/common/PageHeader";
import { SupportTicketDrawer } from "../components/support/SupportTicketDrawer";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  SUPPORT_TABS,
  durationLabel,
  emptyTabTitle,
  replyDue,
  supportAbilities,
  type SupportCounts,
  type SupportTab,
  type SupportTicket,
} from "../components/support/support.util";
import {
  CellText,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  SummaryPanel,
  TablePagination,
  TableToolbar,
  cx,
  prefetchTableQuery,
  toneTextClasses,
  useIdleTablePrefetch,
  useTableQuery,
  useTableQueryClient,
  useTableUrlState,
  type DataTableColumn,
  type SummaryCell,
} from "../components/ui";
import { IconLock, IconSupport } from "../components/ui/icons";
import { PLATFORM_SUPPORT_SUMMARY, PLATFORM_SUPPORT_TICKETS } from "../graphql/support";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useAuth } from "../providers/AuthProvider";

const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS: DataTableColumn<SupportTicket>[] = [
  { key: "ticket", label: "Ticket", mobile: "primary" },
  { key: "store", label: "Store", width: 200, mobile: "title" },
  { key: "priority", label: "Priority", width: 110, skeleton: "badge", hideWhen: "narrow" },
  { key: "status", label: "Status", width: 170, skeleton: "badge", mobile: "badge" },
  { key: "assigned", label: "Assigned", width: 150, hideWhen: "narrow" },
  { key: "due", label: "Reply due", width: 150, mobile: "value" },
];

/**
 * Super Admin › Support › Tickets (board 45, round 2 §6.4; PRD-049 FR-A32): every store's tickets. The KPI band
 * (open, waiting on a store, resolved and awaiting the store's confirmation, median first reply this week against
 * the target), the views Open · Unassigned · Mine · Urgent · Due soon · Waiting on store · Resolved · Closed · All,
 * search, and the table with the SLA timer ("Reply due"), store, type, priority (and the store's own impact),
 * status and assignee. A row opens the drawer with the thread, internal notes, Resolve and assign-to.
 * `?ticket=<id>` opens one (the console feed links there). The server pages each view (`?page=`, rows per page
 * remembered); a new view or search starts at page 1. Needs platform:support:read.
 */
export function SupportTickets() {
  const { can } = useAuth();
  const abilities = supportAbilities(can);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<SupportTab>("OPEN");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const openId = params.get("ticket");
  // Page and rows per page live in the URL (`?ticket=` is the drawer, not a filter).
  const table = useTableUrlState({ ignore: ["ticket"] });
  // Round 3 C3: one cache entry per tab, search and page (60s fresh); another tab's tickets never stay on screen.
  const { data, loading, error, refetch, isInitialLoading, isReloading } = useTableQuery(PLATFORM_SUPPORT_TICKETS, {
    variables: { tab, search: debounced || null, limit: table.pageSize, offset: table.offset },
    tabKey: tab,
    skip: !abilities.read,
  });
  const apollo = useTableQueryClient();
  const prefetchTab = (next: SupportTab) =>
    prefetchTableQuery(apollo, PLATFORM_SUPPORT_TICKETS, { tab: next, search: debounced || null, limit: table.pageSize, offset: 0 });
  const prefetchPage = (page: number) =>
    prefetchTableQuery(apollo, PLATFORM_SUPPORT_TICKETS, {
      tab,
      search: debounced || null,
      limit: table.pageSize,
      offset: (page - 1) * table.pageSize,
    });
  const changeTab = (next: SupportTab) => {
    setTab(next);
    table.setPage(1);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    if (table.page !== 1) table.setPage(1);
  };
  const { data: summaryData, loading: summaryLoading } = useQuery(PLATFORM_SUPPORT_SUMMARY, {
    fetchPolicy: "cache-and-network",
    skip: !abilities.read,
  });
  const rows: SupportTicket[] = data?.platformSupportTickets?.items ?? [];
  // Round 3 C5: the counts come with the list; while a new tab loads, the last counts stay on the tabs.
  const lastCounts = useRef(data?.platformSupportTickets?.counts);
  if (data?.platformSupportTickets?.counts) lastCounts.current = data.platformSupportTickets.counts;
  const counts: SupportCounts | undefined = data?.platformSupportTickets?.counts ?? lastCounts.current;
  const summary = summaryData?.platformSupportSummary;

  const cells: SummaryCell[] = useMemo(() => {
    const highTarget = summary?.replyTargetHours?.HIGH;
    return [
      {
        key: "open",
        label: "Open",
        value: summary?.open ?? "—",
        note: summary ? `${summary.openHighPriority} high priority${summary.overdue ? ` · ${summary.overdue} late` : ""}` : undefined,
        tone: summary?.overdue ? "danger" : "default",
      },
      {
        key: "waiting",
        label: "Waiting on a store",
        value: summary?.waitingOnStore ?? "—",
        note: summary?.waitingStoreNames?.length ? summary.waitingStoreNames.join(", ") : undefined,
      },
      {
        key: "resolved",
        label: "Resolved, awaiting confirmation",
        value: summary?.resolvedAwaitingConfirmation ?? "—",
        note: summary ? `${summary.solvedThisWeek} closed this week` : undefined,
        info: "The store confirms the fix, says it's still a problem, or the ticket closes itself.",
      },
      {
        key: "first-reply",
        label: "First reply",
        value: summary?.firstReplyMedianMinutes == null ? "—" : durationLabel(summary.firstReplyMedianMinutes * 60_000),
        note: summary
          ? summary.firstReplyMedianMinutes == null
            ? "No first replies this week"
            : `Median this week${highTarget ? ` · target ${highTarget} h for high` : ""}`
          : undefined,
      },
    ];
  }, [summary]);

  const tabs = SUPPORT_TABS.map((item) => ({
    value: item.value,
    label: item.label,
    count: item.count ? counts?.[item.count] : undefined,
  }));

  useIdleTablePrefetch(
    !!data && !loading,
    tabs.filter((item) => item.value !== tab).map((item) => () => prefetchTab(item.value)),
  );

  const setOpen = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set("ticket", id);
        else next.delete("ticket");
        return next;
      },
      { replace: true },
    );
  const index = rows.findIndex((row) => row.id === openId);

  const renderCell = (row: SupportTicket, key: string) => {
    switch (key) {
      case "ticket":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.title}</p>
            <p className="font-mono text-label text-fg-muted">
              {row.ref} · {row.typeLabel} · {row.topicLabel}
              {row.attachmentCount ? ` · ${row.attachmentCount} ${row.attachmentCount === 1 ? "file" : "files"}` : ""}
            </p>
          </div>
        );
      case "store":
        return <CellText>{row.storeName || row.storeSlug}</CellText>;
      case "priority":
        return (
          <div className="min-w-0">
            <Chip tone={PRIORITY_TONE[row.priority]}>{PRIORITY_LABEL[row.priority]}</Chip>
            {row.impact && row.impact !== row.priority ? (
              <p className="mt-0.5 truncate text-caption text-fg-muted">Store said {PRIORITY_LABEL[row.impact].toLowerCase()}</p>
            ) : null}
          </div>
        );
      case "status":
        return <Chip tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Chip>;
      case "assigned":
        return <CellText className={row.assignee ? undefined : "text-fg-muted"}>{row.assignee?.name ?? "Not assigned"}</CellText>;
      case "due": {
        const due = replyDue(row);
        return <span className={cx("text-body font-medium", toneTextClasses[due.tone])}>{due.label}</span>;
      }
      default:
        return null;
    }
  };

  if (!abilities.read) {
    return (
      <>
        <PageHeader title="Tickets" eyebrow="Support" description="Every store's questions to Zcom support" />
        <EmptyState icon={IconLock} title="Support tickets aren't available to your role" description="Ask a platform owner for support access." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tickets" eyebrow="Support" description="Every store's questions to Zcom support" />

      <div className="space-y-4">
        <SummaryPanel cells={cells} isLoading={summaryLoading && !summaryData} storageKey="support-tickets" aria-label="Support summary" />

        {/* The kit toolbar: tabs on the left, the 240px search on the right in the same row (phone: a search icon). */}
        <TableToolbar<SupportTab>
          tabs={tabs}
          tab={tab}
          onTabChange={changeTab}
          tabsLabel="Ticket status"
          onTabIntent={prefetchTab}
          search={search}
          onSearchChange={changeSearch}
          searchPlaceholder="Ticket, store or words"
        />

        {error && !rows.length ? (
          <ErrorState title="Couldn't load tickets." onRetry={() => void refetch()} />
        ) : (
          <DataTable<SupportTicket>
            aria-label="Support tickets"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.id}
            renderCell={renderCell}
            isLoading={isInitialLoading}
            isReloading={isReloading}
            tabKey={tab}
            onRowAction={(row) => setOpen(row.id)}
            rowHeight="tall"
            footer={
              // A page emptied by solved tickets still shows the controls to step back.
              rows.length > 0 || table.page > 1 ? (
                <TablePagination
                  page={table.page}
                  pageSize={table.pageSize}
                  total={data?.platformSupportTickets?.totalCount ?? rows.length}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                  onPageIntent={prefetchPage}
                  isDisabled={isReloading}
                />
              ) : null
            }
            emptyContent={
              <EmptyState
                icon={IconSupport}
                title={debounced ? `No tickets match "${debounced}"` : emptyTabTitle(tab)}
                description="Tickets stores raise from Help & support show here."
              />
            }
          />
        )}
      </div>

      <SupportTicketDrawer
        ticketId={openId}
        onClose={() => setOpen(null)}
        onPrev={index > 0 ? () => setOpen(rows[index - 1].id) : undefined}
        onNext={index >= 0 && index < rows.length - 1 ? () => setOpen(rows[index + 1].id) : undefined}
        prevDisabled={index <= 0}
        nextDisabled={index < 0 || index >= rows.length - 1}
      />
    </>
  );
}
