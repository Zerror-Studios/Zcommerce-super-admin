import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DISMISS_AI_TOP_UP_REQUEST } from "../../graphql/ai";
import { useAiTopUpRequests } from "../../hooks/use-platform-ai";
import { useUrlSearch } from "../../hooks/use-url-search";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { TOP_UP_STATUS_OPTIONS, topUpEmptyCopy } from "../../lib/platform-ai.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { matchesText } from "../../lib/text-search.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformAiTopUpRequest, PlatformAiTopUpRequestStatus } from "../../types/platform-api";
import { toasts } from "../../copy";
import { ConfirmModal } from "../common/ConfirmModal";
import { IconClose, IconGift } from "../ui/icons";
import {
  Button,
  DataTable,
  EmptyState,
  SearchInput,
  SegmentedSwitch,
  TablePagination,
  formatDate,
  formatDateTime,
  toastError,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import { AiErrorCard, AiToolbar } from "./ai-table";
import { datedCsvName, useAiExport, type AiTabProps } from "./ai-export";
import { GrantTopUpDialog } from "./GrantTopUpDialog";

const openColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "week", label: "Week of", width: 130 },
  { key: "requested", label: "Requested", width: 130 },
  { key: "action", label: "Quick action", width: 110, hideLabel: true, mobile: "hide" },
];

const handledColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "week", label: "Week of", width: 130 },
  { key: "requested", label: "Requested", width: 130 },
  { key: "handled", label: "Handled", width: 150 },
];

/** The status in the URL (`?status=granted`); Open by default. */
function statusFromParam(value: string | undefined): PlatformAiTopUpRequestStatus {
  const match = TOP_UP_STATUS_OPTIONS.find((option) => option.key.toLowerCase() === value);
  return match?.key ?? "OPEN";
}

/**
 * ZCOM AI › Top-up requests (PRD-021 FR-6.4): stores that ran out of questions and asked for more (one request per
 * store per week). Grant adds questions until the end of the store's month and closes its open requests; Dismiss
 * closes one without granting. Both need `platform:ai:manage`. Search matches the stores on this page (the
 * requests have no server search).
 */
export function AiTopUpsTab({ tabs, exportRef }: AiTabProps) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.AI_MANAGE);
  const table = useTableUrlState();
  const [search, setSearch] = useUrlSearch(table.search, table.setSearch);
  const status = statusFromParam(table.filters.status);
  const isOpen = status === "OPEN";
  const [granting, setGranting] = useState<{ tenantId: string; name: string } | null>(null);
  const [dismissing, setDismissing] = useState<PlatformAiTopUpRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismiss] = useMutation(DISMISS_AI_TOP_UP_REQUEST);

  const api = useAiTopUpRequests({ status, limit: table.pageSize, offset: table.offset });
  // The switch's counts: one row per status is enough to read each total.
  const open = useAiTopUpRequests({ status: "OPEN", limit: 1, offset: 0 });
  const granted = useAiTopUpRequests({ status: "GRANTED", limit: 1, offset: 0 });
  const dismissed = useAiTopUpRequests({ status: "DISMISSED", limit: 1, offset: 0 });
  const counts: Record<PlatformAiTopUpRequestStatus, number | null> = {
    OPEN: open.data?.totalCount ?? null,
    GRANTED: granted.data?.totalCount ?? null,
    DISMISSED: dismissed.data?.totalCount ?? null,
  };
  const loaded = useMemo(() => api.data?.items ?? [], [api.data]);
  const rows = loaded.filter((row) => matchesText(table.search, row.storeName));
  const total = api.data?.totalCount ?? 0;

  const refetchAll = useCallback(
    () => Promise.all([api.refetch(), open.refetch(), granted.refetch(), dismissed.refetch()]).catch(() => undefined),
    [api, open, granted, dismissed],
  );

  const runExport = useCallback(() => {
    const csv = rowsToCsv(
      loaded.map((row) => ({
        store: row.storeName,
        week: formatDate(row.week),
        requested: row.createdAt ? formatDateTime(row.createdAt) : "",
        status: TOP_UP_STATUS_OPTIONS.find((option) => option.key === row.status)?.label ?? row.status,
        handled: row.handledAt ? formatDateTime(row.handledAt) : "",
      })),
      [
        { key: "store", label: "Store" },
        { key: "week", label: "Week of" },
        { key: "requested", label: "Requested" },
        { key: "status", label: "Status" },
        { key: "handled", label: "Handled" },
      ],
    );
    downloadCsv(datedCsvName("ai-top-up-requests"), csv);
  }, [loaded]);
  useAiExport(exportRef, runExport);

  const runDismiss = async () => {
    if (!dismissing || busy) return;
    setBusy(true);
    try {
      const response = await dismiss({ variables: { requestId: dismissing.id } });
      await refetchAll();
      addToast({
        title: response.data?.dismissAiTopUpRequest
          ? `Request from ${dismissing.storeName} dismissed.`
          : `The request from ${dismissing.storeName} was already handled.`,
      });
      setDismissing(null);
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  const toolbarControls = (
    <>
      <SearchInput placement="toolbar" placeholder="Search stores" value={search} onValueChange={setSearch} onClear={() => setSearch("")} />
      <SegmentedSwitch
        size="sm"
        ariaLabel="Request status"
        value={status}
        onChange={(next) => table.setParams({ status: next === "OPEN" ? undefined : next.toLowerCase() })}
        items={TOP_UP_STATUS_OPTIONS.map((option) => ({ value: option.key, label: option.label, count: counts[option.key] }))}
      />
    </>
  );

  if (api.error) {
    return <AiErrorCard tabs={tabs} title="Couldn't load the top-up requests." description={toasts.genericError} onRetry={() => void api.refetch()} />;
  }

  return (
    <>
      <DataTable<PlatformAiTopUpRequest>
        aria-label="AI top-up requests"
        columns={isOpen ? openColumns : handledColumns}
        rows={rows}
        getRowKey={(row) => row.id}
        isLoading={api.loading}
        onRowAction={(row) => navigate(`/stores/${row.tenantId}/ai`)}
        rowActions={
          isOpen && canManage
            ? (row) => [{ key: "dismiss", label: "Dismiss", icon: IconClose, onSelect: () => setDismissing(row) }]
            : undefined
        }
        rowActionsLabel={(row) => `Actions for ${row.storeName}`}
        toolbar={<AiToolbar tabs={tabs}>{toolbarControls}</AiToolbar>}
        renderCell={(row, key) => {
          switch (key) {
            case "store":
              return <span className="block truncate font-medium text-fg">{row.storeName}</span>;
            case "week":
              return <span className="whitespace-nowrap num">{formatDate(row.week)}</span>;
            case "requested":
              return <span className="whitespace-nowrap num">{row.createdAt ? formatDateTime(row.createdAt) : "—"}</span>;
            case "handled":
              return <span className="whitespace-nowrap num">{row.handledAt ? formatDateTime(row.handledAt) : "—"}</span>;
            case "action":
              return canManage ? (
                <Button size="xs" variant="secondary" onPress={() => setGranting({ tenantId: row.tenantId, name: row.storeName })}>
                  Grant
                </Button>
              ) : (
                <span className="text-label text-fg-muted">View only</span>
              );
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
          />
        }
        emptyContent={
          table.search.trim() ? (
            <EmptyState
              kind="no-results"
              icon={IconGift}
              title="No matching requests"
              description="No store on this page matches that search."
              action={
                <Button variant="secondary" size="sm" onPress={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState icon={IconGift} title={topUpEmptyCopy(status)} description="Requests from stores appear here." />
          )
        }
      />

      <GrantTopUpDialog store={granting} onClose={() => setGranting(null)} onGranted={refetchAll} />

      <ConfirmModal
        isOpen={!!dismissing}
        onClose={() => setDismissing(null)}
        onConfirm={() => void runDismiss()}
        title="Dismiss this request?"
        description={`${dismissing?.storeName ?? "The store"} gets no extra questions. Its weekly limit resets on Monday as usual.`}
        confirmLabel="Dismiss request"
        confirmColor="primary"
        isLoading={busy}
      />
    </>
  );
}
