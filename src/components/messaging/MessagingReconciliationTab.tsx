/**
 * Console › Messaging › Usage check (backend PRD-050 D20, FR-1.11): each
 * month (IST) the emails ZCOM sent through every store's MSG91 account, and
 * Zerror's parent account, against MSG91's mail log. The month and the
 * status filter live in `?month=` / `?status=` so the console feed's
 * "MSG91 email count differs" alert opens the right list. "Run again"
 * (platform:messaging:manage, audited) re-reads MSG91 for the month or one
 * store and replaces the rows.
 *
 * Backend PRD-050 D22: the parent row also counts Zerror's own platform
 * mail through the parent SMTP and every store's shared-address mail
 * (whatever its account's state); its second line shows the split.
 */
import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CellText,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Select,
  SelectItem,
  TablePagination,
  TableToolbar,
  formatDateTime,
  rowControlProps,
  toast,
  toastError,
  type DataTableColumn,
} from "../ui";
import { IconChartBar } from "../ui/icons";
import { PLATFORM_MESSAGING_RECONCILIATIONS, RERUN_MESSAGING_RECONCILIATION } from "../../graphql/messaging";
import {
  RECONCILIATION_STATUS_LABEL,
  RECONCILIATION_STATUS_TABS,
  RECONCILIATION_STATUS_TONE,
  differenceText,
  formatReconcileMonth,
  isReconciliationStatusTab,
  parentSourcesText,
  purposeSummary,
  reconciliationFailureCopy,
  reconciliationVariables,
  type MessagingReconciliation,
  type ReconciliationList,
  type ReconciliationStatusTab,
} from "../../lib/platform-messaging-reconciliation.util";

const PAGE_SIZE = 20;

type ReconciliationData = { platformMessagingReconciliations: ReconciliationList };

export function MessagingReconciliationTab({ canManage }: { canManage: boolean }) {
  const [params, setParams] = useSearchParams();
  const requestedStatus = params.get("status");
  const status: ReconciliationStatusTab = isReconciliationStatusTab(requestedStatus) ? requestedStatus : "ALL";
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month") : null;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const setParam = (key: string, value: string | null) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
    setPage(1);
  };

  const { data, loading, error, refetch } = useQuery<ReconciliationData>(PLATFORM_MESSAGING_RECONCILIATIONS, {
    variables: reconciliationVariables(month, status, pageSize, (page - 1) * pageSize),
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const [rerun, { loading: rerunning }] = useMutation(RERUN_MESSAGING_RECONCILIATION, {
    refetchQueries: ["PlatformMessagingReconciliations"],
  });

  const list = data?.platformMessagingReconciliations;
  const rows = list?.items ?? [];
  const shownMonth = list?.month ?? month;

  const runAgain = async (tenantId: string | null) => {
    if (!shownMonth) return;
    try {
      const result = await rerun({ variables: { month: shownMonth, tenantId } });
      const summary = result.data?.rerunMessagingReconciliation;
      toast.success(
        summary
          ? `${formatReconcileMonth(shownMonth)} checked again: ${summary.matched} match, ${summary.mismatched} differ`
          : "Checked again",
      );
    } catch (failure) {
      const message = reconciliationFailureCopy(failure);
      if (message) toastError(message);
    }
  };

  const columns: DataTableColumn<MessagingReconciliation>[] = [
    { key: "store", label: "Account", mobile: "title" },
    { key: "status", label: "Status", width: 150, skeleton: "badge", mobile: "badge" },
    { key: "ours", label: "ZCOM sent", width: 200, align: "end", mobile: "primary" },
    { key: "provider", label: "MSG91 logged", width: 140, align: "end", mobile: "value" },
    { key: "difference", label: "Difference", width: 140, align: "end", mobile: "meta" },
    { key: "checked", label: "Checked", width: 190, hideWhen: "narrow", mobile: "meta" },
    ...(canManage ? [{ key: "actions", label: "Actions", hideLabel: true, width: 130, mobile: "hide" as const }] : []),
  ];

  const renderCell = (row: MessagingReconciliation, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.storeName || row.slug || row.tenantId}</p>
            <p className="truncate text-label text-fg-muted">
              {row.scope === "PARENT"
                ? parentSourcesText(row)
                : row.storeSmtp > 0
                  ? `Also ${row.storeSmtp.toLocaleString("en-IN")} through the store's own SMTP`
                  : row.slug ?? ""}
            </p>
          </div>
        );
      case "status":
        return (
          <div className="min-w-0">
            <Chip tone={RECONCILIATION_STATUS_TONE[row.status]}>{RECONCILIATION_STATUS_LABEL[row.status]}</Chip>
            {row.error ? <p className="mt-1 line-clamp-2 text-label text-fg-muted">{row.error}</p> : null}
          </div>
        );
      case "ours":
        return (
          <div className="min-w-0 text-end">
            <p className="tabular-nums font-medium text-fg">{row.ours.total.toLocaleString("en-IN")}</p>
            <p className="truncate text-label text-fg-muted">{purposeSummary(row.ours.byPurpose)}</p>
          </div>
        );
      case "provider":
        return (
          <CellText className="tabular-nums text-fg">
            {row.provider ? row.provider.total.toLocaleString("en-IN") : "—"}
          </CellText>
        );
      case "difference":
        return (
          <CellText className={row.status === "MISMATCH" ? "tabular-nums font-medium text-tone-danger-text" : "tabular-nums text-fg"}>
            {differenceText(row)}
          </CellText>
        );
      case "checked":
        return (
          <CellText className="text-label text-fg-muted">
            {formatDateTime(row.checkedAt)}
            {row.attempts > 1 ? ` · ${row.attempts} tries` : ""}
          </CellText>
        );
      case "actions":
        return row.scope === "STORE" ? (
          <div className="flex justify-end" {...rowControlProps}>
            <Button variant="ghost" size="sm" isDisabled={rerunning} onPress={() => void runAgain(row.tenantId)}>
              Check again
            </Button>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  const totals = list?.totals;

  return (
    <div className="space-y-4">
      {totals && shownMonth ? (
        <Card
          title={`MSG91 email usage · ${formatReconcileMonth(shownMonth)}`}
          description="Emails ZCOM sent through each MSG91 account against MSG91's mail log. Within 5 emails or 2 % counts as a match."
          actions={
            canManage ? (
              <Button variant="secondary" size="sm" isLoading={rerunning} onPress={() => void runAgain(null)}>
                Run again
              </Button>
            ) : null
          }
        >
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-label text-fg-muted">Stores checked</dt>
              <dd className="text-title-3 tabular-nums text-fg">{totals.stores}</dd>
            </div>
            <div>
              <dt className="text-label text-fg-muted">Differ</dt>
              <dd className={totals.mismatched > 0 ? "text-title-3 tabular-nums text-tone-danger-text" : "text-title-3 tabular-nums text-fg"}>
                {totals.mismatched}
              </dd>
            </div>
            <div>
              <dt className="text-label text-fg-muted">ZCOM sent</dt>
              <dd className="text-title-3 tabular-nums text-fg">{totals.ours.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-label text-fg-muted">MSG91 logged</dt>
              <dd className="text-title-3 tabular-nums text-fg">{totals.provider.toLocaleString("en-IN")}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <TableToolbar<ReconciliationStatusTab>
        tabs={RECONCILIATION_STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
        tab={status}
        onTabChange={(next) => setParam("status", next === "ALL" ? null : next)}
        tabsLabel="Usage check status"
      >
        {list && list.months.length > 0 ? (
          <Select
            aria-label="Month"
            className="w-full sm:w-48"
            size="sm"
            selectedKeys={new Set([shownMonth ?? list.months[0]])}
            disallowEmptySelection
            onSelectionChange={(keys) => setParam("month", String(Array.from(keys)[0] ?? "") || null)}
          >
            {list.months.map((value) => (
              <SelectItem key={value}>{formatReconcileMonth(value)}</SelectItem>
            ))}
          </Select>
        ) : null}
      </TableToolbar>

      {error && !data ? (
        <ErrorState title="Couldn't load the usage check." onRetry={() => void refetch()} />
      ) : (
        <DataTable<MessagingReconciliation>
          aria-label="MSG91 usage check"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          renderCell={renderCell}
          isLoading={loading && !data}
          isReloading={loading && !!data}
          tabKey={`${shownMonth ?? ""}:${status}`}
          footer={
            data && (rows.length > 0 || page > 1) ? (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={list?.total ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                isDisabled={loading}
              />
            ) : null
          }
          emptyContent={
            <EmptyState
              icon={IconChartBar}
              title={
                !shownMonth
                  ? "No usage check yet"
                  : status === "ALL"
                    ? `No accounts checked for ${formatReconcileMonth(shownMonth)}`
                    : `No ${RECONCILIATION_STATUS_LABEL[status].toLowerCase()} accounts for ${formatReconcileMonth(shownMonth)}`
              }
              description="The check runs on the 1st and 2nd of each month (IST) for every connected MSG91 account."
            />
          }
        />
      )}
    </div>
  );
}
