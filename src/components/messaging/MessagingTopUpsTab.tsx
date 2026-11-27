/**
 * Console › Messaging › Top-up requests (backend PRD-050 FR-4.6): stores'
 * requests to add to their message balance, newest first, waiting for
 * payment by default and filterable by status. "Record payment" (a bank
 * transfer's reference; the server credits the balance) and "Withdraw"
 * (with the reason) need platform:messaging:manage.
 */
import { useQuery } from "@apollo/client";
import { useState } from "react";
import {
  Button,
  CellText,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  TablePagination,
  TableToolbar,
  formatDateTime,
  rowControlProps,
  type DataTableColumn,
} from "../ui";
import { IconWallet } from "../ui/icons";
import { PLATFORM_MESSAGING_TOPUPS } from "../../graphql/messaging";
import {
  TOPUP_STATUS_LABEL,
  TOPUP_STATUS_TABS,
  TOPUP_STATUS_TONE,
  formatPaise,
  messagingTopUpStatusEnum,
  topUpListVariables,
  topUpRequesterText,
  type MessagingTopUp,
  type TopUpStatusTab,
} from "../../lib/platform-messaging-balance.util";
import { BalanceDialogs, type BalanceDialog } from "./MessagingBalancesTab";

const PAGE_SIZE = 20;

type TopUpsData = { platformMessagingTopUps: { items: MessagingTopUp[]; total: number } };

export function MessagingTopUpsTab({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<TopUpStatusTab>(messagingTopUpStatusEnum.PENDING);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [dialog, setDialog] = useState<BalanceDialog>(null);

  const { data, loading, error, refetch } = useQuery<TopUpsData>(PLATFORM_MESSAGING_TOPUPS, {
    variables: topUpListVariables(status, pageSize, (page - 1) * pageSize),
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const rows = data?.platformMessagingTopUps.items ?? [];

  const columns: DataTableColumn<MessagingTopUp>[] = [
    { key: "number", label: "Request", width: 170, mobile: "title" },
    { key: "store", label: "Store", mobile: "primary" },
    { key: "amount", label: "Amount", width: 140, align: "end", mobile: "value" },
    { key: "status", label: "Status", width: 170, skeleton: "badge", mobile: "badge" },
    { key: "paid", label: "Payment", width: 220, hideWhen: "narrow", mobile: "meta" },
    ...(canManage ? [{ key: "actions", label: "Actions", hideLabel: true, width: 220, mobile: "hide" as const }] : []),
  ];

  const renderCell = (row: MessagingTopUp, key: string) => {
    switch (key) {
      case "number":
        return (
          <div className="min-w-0">
            <p className="truncate font-mono text-body text-fg">{row.number}</p>
            <p className="truncate text-label text-fg-muted">{formatDateTime(row.createdAt)}</p>
          </div>
        );
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.tenantName || row.tenantId}</p>
            {topUpRequesterText(row) ? <p className="truncate text-label text-fg-muted">{topUpRequesterText(row)}</p> : null}
          </div>
        );
      case "amount":
        return <CellText className="tabular-nums font-medium text-fg">{formatPaise(row.amountPaise)}</CellText>;
      case "status":
        return <Chip tone={TOPUP_STATUS_TONE[row.status]}>{TOPUP_STATUS_LABEL[row.status]}</Chip>;
      case "paid":
        if (row.status === messagingTopUpStatusEnum.PAID) {
          return (
            <div className="min-w-0">
              <p className="truncate text-label text-fg">
                {row.paidAt ? formatDateTime(row.paidAt) : "Paid"}
                {row.provider ? ` · ${row.provider}` : ""}
              </p>
              {row.reference ? <p className="truncate text-label text-fg-muted">Ref {row.reference}</p> : null}
            </div>
          );
        }
        return <CellText className="text-fg-muted">—</CellText>;
      case "actions":
        return row.status === messagingTopUpStatusEnum.PENDING ? (
          <div className="flex flex-wrap justify-end gap-2" {...rowControlProps}>
            <Button variant="secondary" size="sm" onPress={() => setDialog({ kind: "pay", topUp: row })}>
              Record payment
            </Button>
            <Button variant="ghost" size="sm" onPress={() => setDialog({ kind: "withdraw", topUp: row })}>
              Withdraw
            </Button>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <TableToolbar<TopUpStatusTab>
        tabs={TOPUP_STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
        tab={status}
        onTabChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        tabsLabel="Top-up status"
      />

      {error && !data ? (
        <ErrorState title="Couldn't load the top-up requests." onRetry={() => void refetch()} />
      ) : (
        <DataTable<MessagingTopUp>
          aria-label="Top-up requests"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          renderCell={renderCell}
          isLoading={loading && !data}
          isReloading={loading && !!data}
          tabKey={status}
          footer={
            data && (rows.length > 0 || page > 1) ? (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={data.platformMessagingTopUps.total}
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
              icon={IconWallet}
              title={
                status === messagingTopUpStatusEnum.PENDING
                  ? "No top-up is waiting for payment"
                  : status === "ALL"
                    ? "No top-up requests yet"
                    : `No ${TOPUP_STATUS_LABEL[status].toLowerCase()} top-ups`
              }
              description="A request appears when a store asks to top up its message balance."
            />
          }
        />
      )}

      <BalanceDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
