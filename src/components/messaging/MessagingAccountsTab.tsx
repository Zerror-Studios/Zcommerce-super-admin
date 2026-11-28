/**
 * Console › Messaging › Accounts (backend PRD-050 FR-1.1, FR-1.2, FR-1.9,
 * D19): every store's MSG91 account with its state, kind, which credentials
 * are saved (never the values), the sending domain and its verification,
 * and whether MSG91 sending is on. Sending is read-only here: switching it on
 * is the `messaging-email-move` CLI with the owner's per-store yes.
 * Create messaging account (an explicit per-store confirmation) and
 * Connect / update credentials need platform:messaging:manage.
 * D21: MSG91's KYC of each account (sending can't be switched on before it
 * is approved) and its hourly email limit, edited in "KYC and limit".
 * Backend PRD-051 FR-1: each store's WhatsApp number (status, quality and
 * daily limit, the last refresh's problem), edited and refreshed from MSG91
 * in "WhatsApp" (platform:messaging:manage, audited).
 */
import { useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
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
import { IconInfo, IconMessages } from "../ui/icons";
import { PLATFORM_MESSAGING_ACCOUNTS, PLATFORM_MESSAGING_SETTINGS } from "../../graphql/messaging";
import {
  ACCOUNT_KIND_LABEL,
  ACCOUNT_STATE_LABEL,
  ACCOUNT_STATE_TONE,
  KYC_STATUS_LABEL,
  KYC_STATUS_TONE,
  WHATSAPP_LIMIT_LABEL,
  WHATSAPP_QUALITY_LABEL,
  WHATSAPP_QUALITY_TONE,
  credentialSummary,
  whatsAppStatusChip,
  domainSummary,
  messagingAccountStateEnum,
  type MessagingAccount,
  type MessagingAccountState,
  type MessagingSettings,
} from "../../lib/platform-messaging.util";
import { useClients } from "../../providers/ClientsProvider";
import {
  AccountKycDialog,
  ConnectAccountDialog,
  CreateAccountDialog,
  WhatsAppNumberDialog,
  type StoreOption,
} from "./MessagingDialogs";
import { WhatsAppMoveReportCard } from "./WhatsAppMoveReportCard";
import { MESSAGING_REFETCH } from "./MessagingQueueTab";

const PAGE_SIZE = 20;

type StateTab = MessagingAccountState | "ALL";

const STATE_TABS: Array<{ value: StateTab; label: string }> = [
  { value: "ALL", label: "All" },
  { value: messagingAccountStateEnum.ACTIVE, label: ACCOUNT_STATE_LABEL.ACTIVE },
  { value: messagingAccountStateEnum.FAILED, label: ACCOUNT_STATE_LABEL.FAILED },
  { value: messagingAccountStateEnum.REQUESTED, label: ACCOUNT_STATE_LABEL.REQUESTED },
  { value: messagingAccountStateEnum.NOT_STARTED, label: ACCOUNT_STATE_LABEL.NOT_STARTED },
];

type AccountsData = { platformMessagingAccounts: { items: MessagingAccount[]; totalCount: number } };

type Dialog =
  | { kind: "create"; store: StoreOption | null }
  | { kind: "connect"; store: StoreOption | null; account: MessagingAccount | null }
  | { kind: "kyc"; account: MessagingAccount }
  | { kind: "whatsapp"; account: MessagingAccount }
  | null;

export function MessagingAccountsTab({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<StateTab>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [dialog, setDialog] = useState<Dialog>(null);
  const { clients } = useClients();
  const stores = useMemo<StoreOption[]>(
    () =>
      clients
        .map((client) => ({ id: client.id, name: client.storeName }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  const { data, loading, error, refetch } = useQuery<AccountsData>(PLATFORM_MESSAGING_ACCOUNTS, {
    variables: { state: state === "ALL" ? null : state, limit: pageSize, offset: (page - 1) * pageSize },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const settings = useQuery<{ platformMessagingSettings: MessagingSettings }>(PLATFORM_MESSAGING_SETTINGS, {
    skip: !canManage,
  }).data?.platformMessagingSettings;
  const rows = data?.platformMessagingAccounts.items ?? [];

  const columns: DataTableColumn<MessagingAccount>[] = [
    { key: "store", label: "Store", mobile: "primary" },
    { key: "state", label: "State", width: 130, skeleton: "badge", mobile: "badge" },
    { key: "credentials", label: "Credentials", width: 230, hideWhen: "narrow", mobile: "meta" },
    { key: "kyc", label: "KYC · limit", width: 170, skeleton: "badge", hideWhen: "narrow", mobile: "meta" },
    { key: "domain", label: "Sending domain", width: 240, mobile: "title" },
    { key: "whatsapp", label: "WhatsApp", width: 170, skeleton: "badge", hideWhen: "narrow", mobile: "meta" },
    { key: "sending", label: "Sending", width: 110, skeleton: "badge", mobile: "value" },
    ...(canManage ? [{ key: "actions", label: "Actions", hideLabel: true, width: 220, mobile: "hide" as const }] : []),
  ];

  const renderCell = (row: MessagingAccount, key: string) => {
    switch (key) {
      case "store":
        return (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-fg">{row.storeName || row.slug}</p>
            <p className="truncate text-label text-fg-muted">
              {ACCOUNT_KIND_LABEL[row.kind]}
              {row.childId ? ` · child ${row.childId}` : ""}
            </p>
          </div>
        );
      case "state":
        return (
          <div className="min-w-0">
            <Chip tone={ACCOUNT_STATE_TONE[row.state]}>{ACCOUNT_STATE_LABEL[row.state]}</Chip>
            {row.state === messagingAccountStateEnum.FAILED && (row.failureReason || row.lastTestMessage) ? (
              <p className="mt-1 line-clamp-2 text-label text-tone-danger-text">{row.failureReason || row.lastTestMessage}</p>
            ) : row.lastTestAt ? (
              <p className="mt-1 text-label text-fg-muted">Checked {formatDateTime(row.lastTestAt)}</p>
            ) : null}
          </div>
        );
      case "credentials":
        return <CellText className="text-fg-muted">{credentialSummary(row)}</CellText>;
      case "kyc":
        return (
          <div className="min-w-0">
            <Chip tone={KYC_STATUS_TONE[row.kycStatus] ?? "warning"}>{KYC_STATUS_LABEL[row.kycStatus] ?? row.kycStatus}</Chip>
            <p className="mt-1 text-label text-fg-muted">
              <span className="num">{row.hourlyEmailLimit}</span> emails an hour
            </p>
          </div>
        );
      case "domain": {
        const summary = domainSummary(row);
        return (
          <div className="min-w-0">
            {row.domain ? <p className="truncate font-mono text-body text-fg">{row.domain}</p> : null}
            <Chip tone={summary.tone}>{summary.label}</Chip>
          </div>
        );
      }
      case "whatsapp": {
        const chip = whatsAppStatusChip(row.whatsapp?.status);
        const quality = row.whatsapp?.qualityRating ?? "UNKNOWN";
        return (
          <div className="min-w-0">
            <Chip tone={chip.tone}>{chip.label}</Chip>
            {row.whatsapp?.number ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-label text-fg-muted">
                <Chip tone={WHATSAPP_QUALITY_TONE[quality] ?? "neutral"} dot={false}>
                  {WHATSAPP_QUALITY_LABEL[quality] ?? quality}
                </Chip>
                <span>{WHATSAPP_LIMIT_LABEL[row.whatsapp.limitTier] ?? row.whatsapp.limitTier}</span>
              </div>
            ) : null}
            {row.whatsapp?.healthError ? <p className="mt-1 line-clamp-2 text-label text-tone-warning">{row.whatsapp.healthError}</p> : null}
          </div>
        );
      }
      case "sending":
        return <Chip tone={row.sendingEnabled ? "success" : "neutral"}>{row.sendingEnabled ? "On" : "Off"}</Chip>;
      case "actions":
        return (
          <div className="flex flex-wrap justify-end gap-2" {...rowControlProps}>
            {row.state !== messagingAccountStateEnum.ACTIVE && !row.childId ? (
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setDialog({ kind: "create", store: { id: row.tenantId, name: row.storeName || row.slug } })}
              >
                Create account
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onPress={() =>
                setDialog({ kind: "connect", store: { id: row.tenantId, name: row.storeName || row.slug }, account: row })
              }
            >
              {row.hasAuthKey || row.state === messagingAccountStateEnum.ACTIVE ? "Update credentials" : "Connect"}
            </Button>
            <Button variant="secondary" size="sm" onPress={() => setDialog({ kind: "kyc", account: row })}>
              KYC and limit
            </Button>
            <Button variant="secondary" size="sm" onPress={() => setDialog({ kind: "whatsapp", account: row })}>
              WhatsApp
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <p className="flex gap-2 rounded-xl bg-tone-info-soft px-3 py-2 text-label text-fg">
        <IconInfo aria-hidden className="mt-0.5 size-4 shrink-0" />
        Sending through MSG91 is switched on per store only with the owner's yes, by the{" "}
        <span className="font-mono">messaging-email-move</span> command (D19), and only once MSG91 approved the
        account's KYC (D21). The console shows it and never changes it.
      </p>

      <TableToolbar<StateTab>
        tabs={STATE_TABS}
        tab={state}
        onTabChange={(next) => {
          setState(next);
          setPage(1);
        }}
        tabsLabel="Account state"
      >
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onPress={() => setDialog({ kind: "connect", store: null, account: null })}>
              Connect existing account
            </Button>
            <Button variant="primary" size="sm" onPress={() => setDialog({ kind: "create", store: null })}>
              Create messaging account
            </Button>
          </div>
        ) : null}
      </TableToolbar>

      {error && !data ? (
        <ErrorState title="Couldn't load the MSG91 accounts." onRetry={() => void refetch()} />
      ) : (
        <DataTable<MessagingAccount>
          aria-label="MSG91 accounts"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.tenantId}
          renderCell={renderCell}
          isLoading={loading && !data}
          isReloading={loading && !!data}
          tabKey={state}
          rowHeight="tall"
          footer={
            data && (rows.length > 0 || page > 1) ? (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={data.platformMessagingAccounts.totalCount}
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
              icon={IconMessages}
              title={state === "ALL" ? "No MSG91 accounts yet" : `No accounts in ${ACCOUNT_STATE_LABEL[state].toLowerCase()}`}
              description="An account appears once a store turns email on or ops create or connect one."
            />
          }
        />
      )}

      {/* Backend PRD-051 FR-13: stores still on their own MSG91 WhatsApp install */}
      <WhatsAppMoveReportCard />

      {dialog?.kind === "create" ? (
        <CreateAccountDialog
          isOpen
          onClose={() => setDialog(null)}
          store={dialog.store}
          stores={stores}
          addClientApiEnabled={settings?.addClientApiEnabled ?? false}
          refetchQueries={MESSAGING_REFETCH}
        />
      ) : null}
      {dialog?.kind === "kyc" ? (
        <AccountKycDialog isOpen onClose={() => setDialog(null)} account={dialog.account} refetchQueries={MESSAGING_REFETCH} />
      ) : null}
      {dialog?.kind === "whatsapp" ? (
        <WhatsAppNumberDialog isOpen onClose={() => setDialog(null)} account={dialog.account} refetchQueries={MESSAGING_REFETCH} />
      ) : null}
      {dialog?.kind === "connect" ? (
        <ConnectAccountDialog
          isOpen
          onClose={() => setDialog(null)}
          account={dialog.account}
          store={dialog.store}
          stores={stores}
          refetchQueries={MESSAGING_REFETCH}
        />
      ) : null}
    </div>
  );
}
