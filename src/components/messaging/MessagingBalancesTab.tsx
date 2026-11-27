/**
 * Console › Messaging › Balances (backend PRD-050 FR-4.6): every store's
 * prepaid message balance, lowest first, with a "Low only" view (stores
 * warned LOW or EMPTY). A row opens the store's balance: the figures, the
 * ledger page by page and its latest top-ups. "Grant or correct" and the
 * top-up actions need platform:messaging:manage.
 */
import { useQuery } from "@apollo/client";
import { useState } from "react";
import {
  Button,
  CellText,
  Chip,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Skeleton,
  TablePagination,
  TableToolbar,
  formatDateTime,
  rowControlProps,
  type DataTableColumn,
} from "../ui";
import { IconWallet } from "../ui/icons";
import { PLATFORM_MESSAGING_BALANCE, PLATFORM_MESSAGING_BALANCES } from "../../graphql/messaging";
import {
  BALANCE_FILTER_TABS,
  TOPUP_STATUS_LABEL,
  TOPUP_STATUS_TONE,
  balanceLevelChip,
  balanceListVariables,
  formatPaise,
  ledgerByLabel,
  ledgerKindLabel,
  messagingTopUpStatusEnum,
  type BalanceFilter,
  type MessagingBalance,
  type MessagingLedgerEntry,
  type MessagingTopUp,
} from "../../lib/platform-messaging-balance.util";
import { AdjustBalanceDialog, RecordTopUpPaymentDialog, WithdrawTopUpDialog } from "./MessagingBalanceDialogs";

const PAGE_SIZE = 20;
const LEDGER_PAGE_SIZE = 20;

type BalancesData = { platformMessagingBalances: { items: MessagingBalance[]; total: number } };

type BalanceDetailData = {
  platformMessagingBalance: {
    balance: MessagingBalance;
    ledger: MessagingLedgerEntry[];
    ledgerTotal: number;
    topUps: MessagingTopUp[];
  };
};

export type BalanceDialog =
  | { kind: "adjust"; balance: MessagingBalance }
  | { kind: "pay" | "withdraw"; topUp: MessagingTopUp }
  | null;

/** The dialogs the Balances and Top-up requests tabs open. */
export function BalanceDialogs({ dialog, onClose }: { dialog: BalanceDialog; onClose: () => void }) {
  if (dialog?.kind === "adjust") return <AdjustBalanceDialog balance={dialog.balance} onClose={onClose} />;
  if (dialog?.kind === "pay") return <RecordTopUpPaymentDialog topUp={dialog.topUp} onClose={onClose} />;
  if (dialog?.kind === "withdraw") return <WithdrawTopUpDialog topUp={dialog.topUp} onClose={onClose} />;
  return null;
}

function storeNameOf(row: { tenantName: string | null; tenantId: string }): string {
  return row.tenantName || row.tenantId;
}

export function MessagingBalancesTab({ canManage }: { canManage: boolean }) {
  const [filter, setFilter] = useState<BalanceFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [openTenantId, setOpenTenantId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<BalanceDialog>(null);

  const { data, loading, error, refetch } = useQuery<BalancesData>(PLATFORM_MESSAGING_BALANCES, {
    variables: balanceListVariables(filter, pageSize, (page - 1) * pageSize),
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const rows = data?.platformMessagingBalances.items ?? [];

  const columns: DataTableColumn<MessagingBalance>[] = [
    { key: "store", label: "Store", mobile: "primary" },
    { key: "available", label: "Available", width: 150, align: "end", mobile: "value" },
    { key: "balance", label: "Balance", width: 150, align: "end", hideWhen: "narrow", mobile: "hide" },
    { key: "reserved", label: "Held for sends", width: 150, align: "end", hideWhen: "narrow", mobile: "hide" },
    { key: "lastTopUp", label: "Last top-up", width: 140, align: "end", hideWhen: "narrow", mobile: "hide" },
    { key: "level", label: "Level", width: 110, skeleton: "badge", mobile: "badge" },
    ...(canManage ? [{ key: "actions", label: "Actions", hideLabel: true, width: 170, mobile: "hide" as const }] : []),
  ];

  const renderCell = (row: MessagingBalance, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{storeNameOf(row)}</p>
            {row.updatedAt ? (
              <p className="truncate text-label text-fg-muted">Updated {formatDateTime(row.updatedAt)}</p>
            ) : null}
          </div>
        );
      case "available":
        return <CellText className="tabular-nums font-medium text-fg">{formatPaise(row.availablePaise)}</CellText>;
      case "balance":
        return <CellText className="tabular-nums">{formatPaise(row.balancePaise)}</CellText>;
      case "reserved":
        return <CellText className="tabular-nums text-fg-muted">{formatPaise(row.reservedPaise)}</CellText>;
      case "lastTopUp":
        return <CellText className="tabular-nums text-fg-muted">{formatPaise(row.lastTopUpPaise)}</CellText>;
      case "level": {
        const chip = balanceLevelChip(row.level);
        return chip ? <Chip tone={chip.tone}>{chip.label}</Chip> : <Chip tone="success">OK</Chip>;
      }
      case "actions":
        return (
          <div className="flex justify-end" {...rowControlProps}>
            <Button variant="secondary" size="sm" onPress={() => setDialog({ kind: "adjust", balance: row })}>
              Grant or correct
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <TableToolbar<BalanceFilter>
        tabs={BALANCE_FILTER_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
        tab={filter}
        onTabChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
        tabsLabel="Balance filter"
      />

      {error && !data ? (
        <ErrorState title="Couldn't load the message balances." onRetry={() => void refetch()} />
      ) : (
        <DataTable<MessagingBalance>
          aria-label="Message balances"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.tenantId}
          renderCell={renderCell}
          onRowAction={(row) => setOpenTenantId(row.tenantId)}
          isLoading={loading && !data}
          isReloading={loading && !!data}
          tabKey={filter}
          footer={
            data && (rows.length > 0 || page > 1) ? (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={data.platformMessagingBalances.total}
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
              title={filter === "LOW" ? "No store is low on message balance" : "No message balances yet"}
              description={
                filter === "LOW"
                  ? "Stores show here once their balance drops under 20% of their last top-up."
                  : "A balance appears once a store tops up or is granted credit."
              }
            />
          }
        />
      )}

      <BalanceDrawer
        tenantId={openTenantId}
        canManage={canManage}
        onClose={() => setOpenTenantId(null)}
        onDialog={setDialog}
      />
      <BalanceDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

// ─── Store balance drawer ─────────────────────────────────────────────────

interface BalanceDrawerProps {
  tenantId: string | null;
  canManage: boolean;
  onClose: () => void;
  onDialog: (dialog: BalanceDialog) => void;
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-sunken px-3 py-2">
      <p className="text-label text-fg-muted">{label}</p>
      <p className={`tabular-nums text-body text-fg ${strong ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}

function BalanceDrawer({ tenantId, canManage, onClose, onDialog }: BalanceDrawerProps) {
  const [ledgerPage, setLedgerPage] = useState(1);
  const [shownFor, setShownFor] = useState(tenantId);
  if (shownFor !== tenantId) {
    setShownFor(tenantId);
    setLedgerPage(1);
  }

  const { data, loading, error, refetch } = useQuery<BalanceDetailData>(PLATFORM_MESSAGING_BALANCE, {
    variables: { tenantId, limit: LEDGER_PAGE_SIZE, offset: (ledgerPage - 1) * LEDGER_PAGE_SIZE },
    skip: !tenantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const detail = data?.platformMessagingBalance;
  const balance = detail?.balance;

  const ledgerColumns: DataTableColumn<MessagingLedgerEntry>[] = [
    { key: "when", label: "When", width: 160, mobile: "meta" },
    { key: "kind", label: "Movement", mobile: "primary" },
    { key: "amount", label: "Amount", width: 120, align: "end", mobile: "value" },
    { key: "after", label: "Balance after", width: 130, align: "end", hideWhen: "narrow", mobile: "hide" },
  ];

  const renderLedgerCell = (row: MessagingLedgerEntry, key: string) => {
    switch (key) {
      case "when":
        return <CellText className="text-fg-muted">{formatDateTime(row.createdAt)}</CellText>;
      case "kind":
        return (
          <div className="min-w-0">
            <p className="truncate text-body text-fg">{ledgerKindLabel(row.kind)}</p>
            <p className="line-clamp-2 text-label text-fg-muted">
              {[row.reason, ledgerByLabel(row.by)].filter((part) => part && part !== "—").join(" · ") || "—"}
            </p>
          </div>
        );
      case "amount":
        return (
          <CellText className="tabular-nums">
            {row.amountPaise !== 0
              ? formatPaise(row.amountPaise, { showSign: true })
              : `${formatPaise(row.reservedDeltaPaise, { showSign: true })} held`}
          </CellText>
        );
      case "after":
        return <CellText className="tabular-nums text-fg-muted">{formatPaise(row.balanceAfterPaise)}</CellText>;
      default:
        return null;
    }
  };

  const level = balance ? balanceLevelChip(balance.level) : null;

  return (
    <Drawer
      isOpen={Boolean(tenantId)}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={balance ? storeNameOf(balance) : "Message balance"}
      subtitle="Prepaid message balance"
      headerActions={
        balance && canManage ? (
          <Button variant="secondary" size="sm" onPress={() => onDialog({ kind: "adjust", balance })}>
            Grant or correct
          </Button>
        ) : null
      }
    >
      {error && !data ? (
        <ErrorState title="Couldn't load this store's balance." onRetry={() => void refetch()} />
      ) : !balance ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            {level ? <Chip tone={level.tone}>{level.label}</Chip> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Figure label="Available" value={formatPaise(balance.availablePaise)} strong />
              <Figure label="Balance" value={formatPaise(balance.balancePaise)} />
              <Figure label="Held for sends" value={formatPaise(balance.reservedPaise)} />
              <Figure label="Last top-up" value={formatPaise(balance.lastTopUpPaise)} />
            </div>
            {/* Backend PRD-050 D22: the store's automatic top-up, read-only */}
            <p className="text-label text-fg-muted">
              {balance.autoTopUpEnabled
                ? `Automatic top-up: asks for ${formatPaise(balance.autoTopUpAmountPaise ?? 0)} when the balance falls under ${formatPaise(balance.autoTopUpThresholdPaise ?? 0)}.`
                : "Automatic top-up is off."}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-body font-semibold text-fg">Ledger</h3>
            <DataTable<MessagingLedgerEntry>
              aria-label="Message balance ledger"
              columns={ledgerColumns}
              rows={detail.ledger}
              getRowKey={(row) => row.id}
              renderCell={renderLedgerCell}
              isLoading={false}
              isReloading={loading}
              tabKey={`${tenantId}:${ledgerPage}`}
              footer={
                detail.ledger.length > 0 || ledgerPage > 1 ? (
                  <TablePagination
                    page={ledgerPage}
                    pageSize={LEDGER_PAGE_SIZE}
                    total={detail.ledgerTotal}
                    onPageChange={setLedgerPage}
                    isDisabled={loading}
                  />
                ) : null
              }
              emptyContent={<EmptyState icon={IconWallet} title="No movements yet" />}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-body font-semibold text-fg">Top-ups</h3>
            {detail.topUps.length === 0 ? (
              <p className="text-label text-fg-muted">This store hasn't asked for a top-up.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {detail.topUps.map((topUp) => (
                  <li key={topUp.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-body text-fg">
                        <span className="font-mono">{topUp.number}</span> · {formatPaise(topUp.amountPaise)}
                      </p>
                      <p className="text-label text-fg-muted">
                        {formatDateTime(topUp.createdAt)}
                        {topUp.reference ? ` · ref ${topUp.reference}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={TOPUP_STATUS_TONE[topUp.status]}>{TOPUP_STATUS_LABEL[topUp.status]}</Chip>
                      {canManage && topUp.status === messagingTopUpStatusEnum.PENDING ? (
                        <>
                          <Button variant="secondary" size="sm" onPress={() => onDialog({ kind: "pay", topUp })}>
                            Record payment
                          </Button>
                          <Button variant="ghost" size="sm" onPress={() => onDialog({ kind: "withdraw", topUp })}>
                            Withdraw
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
