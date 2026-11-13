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
  durationLabel,
  replyDue,
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
  TableToolbar,
  cx,
  prefetchTableQuery,
  toneTextClasses,
  useIdleTablePrefetch,
  useTableQuery,
  useTableQueryClient,
  type DataTableColumn,
  type SummaryCell,
} from "../components/ui";
import { IconSupport } from "../components/ui/icons";
import { PLATFORM_SUPPORT_SUMMARY, PLATFORM_SUPPORT_TICKETS } from "../graphql/support";
import { useDebouncedValue } from "../hooks/use-debounced-value";

const PAGE_LIMIT = 100;
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
 * Super Admin › Support › Tickets (board 45, round 2 §6.4): every store's tickets. The KPI band (open, waiting on a
 * store, median first reply this week against the target, solved this week), tabs Open · Waiting on store · Solved
 * · Mine, search, and the table with the SLA timer ("Reply due"), store, priority, status and assignee. A row opens
 * the drawer with the thread, internal notes and assign-to. `?ticket=<id>` opens one.
 */
export function SupportTickets() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<SupportTab>("OPEN");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const openId = params.get("ticket");
  // Round 3 C3: one cache entry per tab and search (60s fresh); another tab's tickets never stay on screen.
  const { data, loading, error, refetch, isInitialLoading, isReloading } = useTableQuery(PLATFORM_SUPPORT_TICKETS, {
    variables: { tab, search: debounced || null, limit: PAGE_LIMIT, offset: 0 },
    tabKey: tab,
  });
  const apollo = useTableQueryClient();
  const prefetchTab = (next: SupportTab) =>
    prefetchTableQuery(apollo, PLATFORM_SUPPORT_TICKETS, { tab: next, search: debounced || null, limit: PAGE_LIMIT, offset: 0 });
  const { data: summaryData, loading: summaryLoading } = useQuery(PLATFORM_SUPPORT_SUMMARY, { fetchPolicy: "cache-and-network" });
  const rows: SupportTicket[] = data?.platformSupportTickets?.items ?? [];
  // Round 3 C5: the counts come with the list; while a new tab loads, the last counts stay on the tabs.
  const lastCounts = useRef(data?.platformSupportTickets?.counts);
  if (data?.platformSupportTickets?.counts) lastCounts.current = data.platformSupportTickets.counts;
  const counts = data?.platformSupportTickets?.counts ?? lastCounts.current;
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
        key: "first-reply",
        label: "First reply",
        value: summary?.firstReplyMedianMinutes == null ? "—" : durationLabel(summary.firstReplyMedianMinutes * 60_000),
        note: summary
          ? summary.firstReplyMedianMinutes == null
            ? "No first replies this week"
            : `Median this week${highTarget ? ` · target ${highTarget} h for high` : ""}`
          : undefined,
      },
      { key: "solved", label: "Solved this week", value: summary?.solvedThisWeek ?? "—" },
    ];
  }, [summary]);

  const tabs = [
    { value: "OPEN" as SupportTab, label: "Open", count: counts?.open },
    { value: "WAITING_ON_STORE" as SupportTab, label: "Waiting on store", count: counts?.waitingOnStore },
    { value: "SOLVED" as SupportTab, label: "Solved", count: counts?.solved },
    { value: "MINE" as SupportTab, label: "Mine", count: counts?.mine },
  ];

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
              {row.ref} · {row.topicLabel}
              {row.attachmentCount ? ` · ${row.attachmentCount} ${row.attachmentCount === 1 ? "file" : "files"}` : ""}
            </p>
          </div>
        );
      case "store":
        return <CellText>{row.storeName || row.storeSlug}</CellText>;
      case "priority":
        return <Chip tone={PRIORITY_TONE[row.priority]}>{PRIORITY_LABEL[row.priority]}</Chip>;
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

  return (
    <>
      <PageHeader title="Tickets" eyebrow="Support" description="Every store's questions to Zcom support" />

      <div className="space-y-4">
        <SummaryPanel cells={cells} isLoading={summaryLoading && !summaryData} storageKey="support-tickets" aria-label="Support summary" />

        {/* The kit toolbar: tabs on the left, the 240px search on the right in the same row (phone: a search icon). */}
        <TableToolbar<SupportTab>
          tabs={tabs}
          tab={tab}
          onTabChange={setTab}
          tabsLabel="Ticket status"
          onTabIntent={prefetchTab}
          search={search}
          onSearchChange={setSearch}
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
            emptyContent={
              <EmptyState
                icon={IconSupport}
                title={debounced ? `No tickets match "${debounced}"` : tab === "OPEN" ? "No open tickets" : "Nothing here"}
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
