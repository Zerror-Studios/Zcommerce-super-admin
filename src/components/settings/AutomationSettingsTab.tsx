import { addToast, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type Selection } from "@heroui/react";
import { toastError } from "../ui";
import { useMemo, useState } from "react";
import { subscriptionStatusEnum, type Client, type Subscription } from "../../types";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { selectionToIdSet } from "../../lib/tableSelection";
import { daysUntil, formatDate } from "../../lib/utils";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { useApolloClient, useMutation } from "@apollo/client";
import { useEffect } from "react";
import { PREVIEW_RENEWAL_REMINDER, SEND_RENEWAL_REMINDERS } from "../../graphql/billing";
import type { ReminderBatch, ReminderPreview } from "../../types/platform-api";
import { toasts } from "../../copy";
import { dataTableClassNames, dataTableSelectionProps, tablePanelClassName } from "../common/dataTableStyles";
import { StatusChip } from "../common/StatusChip";
import { TableToolbar } from "../common/TableToolbar";
import { IconMessages, IconSend, IconView } from "../ui/icons";
import {
  Button as UiButton,
  EmptyState,
  ErrorState,
  KpiStrip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  SelectionBar,
  Skeleton,
  StatCard,
  cx,
  tableRowClasses,
  toneTextClasses,
} from "../ui";

type WindowFilter = "all" | "30" | "14" | "7" | "3" | "overdue";

interface StoreRow {
  id: string;
  client: Client;
  subscription: Subscription;
  daysLeft: number;
}

const columns = [
  { key: "storeName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "renewalDate", label: "Due date" },
  { key: "daysLeft", label: "Days left" },
  { key: "status", label: "Status" },
] as const;

const EMAIL_SUBJECT =
  "Your Zcom subscription renews in {{days}} days";
const EMAIL_BODY =
  "Hi {{ownerName}},\n\nYour store {{storeName}} on the {{plan}} plan renews on {{renewalDate}} (in {{days}} days).\n\nPlease ensure your payment method is up to date to avoid service interruption.\n\n— Zcom";

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function AutomationSettingsTab() {
  const { clients, subscriptions, loading, error, refetch } = useClients();
  const { can } = useAuth();
  // Sending needs billing:manage; previewing only billing:read (review C-M5).
  const canSend = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const [search, setSearch] = useState("");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("30");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const apollo = useApolloClient();
  const [sendReminders] = useMutation<{ sendRenewalReminders: ReminderBatch }>(SEND_RENEWAL_REMINDERS);

  const subscriptionByClientId = useMemo(() => latestSubscriptionByClient(subscriptions), [subscriptions]);

  const allStoreRows = useMemo(() => {
    const rows: StoreRow[] = [];
    clients.forEach((client) => {
      const subscription = subscriptionByClientId.get(client.id);
      if (!subscription || subscription.status === subscriptionStatusEnum.CANCELLED) return;
      rows.push({
        id: client.id,
        client,
        subscription,
        daysLeft: daysUntil(subscription.renewalDate),
      });
    });
    return rows.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [clients, subscriptionByClientId]);

  const storeRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allStoreRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.client.storeName.toLowerCase().includes(query) ||
        row.client.ownerEmail.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      switch (windowFilter) {
        case "all":
          return true;
        case "overdue":
          return row.daysLeft < 0 || row.subscription.status === subscriptionStatusEnum.PAST_DUE;
        default: {
          const max = Number(windowFilter);
          return row.daysLeft >= 0 && row.daysLeft <= max;
        }
      }
    });
  }, [allStoreRows, search, windowFilter]);

  const selectedCount = selected.size;

  const counts = useMemo(
    () => ({
      within30: allStoreRows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 30)
        .length,
      within7: allStoreRows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7)
        .length,
      overdue: allStoreRows.filter((r) => r.daysLeft < 0).length,
    }),
    [allStoreRows],
  );

  const handleSelectionChange = (keys: Selection) => {
    setSelected(selectionToIdSet(keys, storeRows.map((row) => row.id)));
  };

  const handleSend = async () => {
    if (selectedCount === 0) {
      toastError("Select at least one store.");
      return;
    }
    // PRD-005 FR-7.3: the server renders, logs and queues the reminders
    setSending(true);
    try {
      const { data } = await sendReminders({ variables: { tenantIds: [...selected] } });
      const batch = data?.sendRenewalReminders;
      if (batch?.skipped.length) {
        toastError(`${batch.skipped.length} skipped: ${batch.skipped[0].reason}`);
      }
      addToast({ title: toasts.reminderSent(batch?.queued ?? 0), color: "success" });
    } catch (error) {
      // BAD_USER_INPUT and CONFLICT carry the server's message; FORBIDDEN and
      // MFA_REQUIRED are reported once by the Apollo link (review C-L6).
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
      return;
    } finally {
      setSending(false);
    }
    setSelected(new Set());
    setPreviewOpen(false);
  };

  // The preview for the first selected store, rendered by the server.
  useEffect(() => {
    if (!previewOpen) return;
    const [first] = [...selected];
    const tenantId = first ?? storeRows[0]?.id;
    if (!tenantId) return;
    let cancelled = false;
    apollo
      .query<{ previewRenewalReminder: ReminderPreview }>({
        query: PREVIEW_RENEWAL_REMINDER,
        variables: { tenantId },
        fetchPolicy: "network-only",
      })
      .then(({ data }) => {
        if (!cancelled) setPreview(data.previewRenewalReminder);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [apollo, previewOpen, selected, storeRows]);

  const renderCell = (row: StoreRow, key: string) => {
    const { client, subscription, daysLeft } = row;

    switch (key) {
      case "storeName":
        return (
          <div className="min-w-0 max-w-64">
            <p className="truncate font-medium text-fg">{client.storeName}</p>
            <p className="truncate text-caption text-fg-subtle">{client.ownerEmail}</p>
          </div>
        );
      case "plan":
        return <StatusChip kind="plan" value={client.plan} />;
      case "renewalDate":
        return <span className="num">{formatDate(subscription.renewalDate)}</span>;
      case "daysLeft": {
        const label =
          daysLeft < 0
            ? `Overdue · ${plural(Math.abs(daysLeft), "day")}`
            : daysLeft === 0
              ? "Due today"
              : plural(daysLeft, "day");
        const tone =
          daysLeft <= 0
            ? toneTextClasses.danger
            : daysLeft <= 7
              ? toneTextClasses.warning
              : "text-fg";
        return <span className={cx("block text-right num", daysLeft <= 7 && "font-medium", tone)}>{label}</span>;
      }
      case "status":
        return <StatusChip kind="subscription" value={subscription.status} />;
      default:
        return <span className="text-fg-subtle">—</span>;
    }
  };

  const previewButton = (
    <UiButton
      variant="ghost"
      size="sm"
      startIcon={<IconView aria-hidden />}
      onPress={() => setPreviewOpen(true)}
    >
      Preview email
    </UiButton>
  );

  // The rows come from the store list: show its error, not "No stores in this window".
  if (error) {
    return <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <KpiStrip>
        <StatCard bare label="Expiring in 30 days" value={counts.within30} deltaLabel="Stores due for renewal" isLoading={loading} />
        <StatCard bare label="Expiring in 7 days" value={counts.within7} deltaLabel="Stores due this week" isLoading={loading} />
        <StatCard
          bare
          isLoading={loading}
          label="Overdue"
          value={counts.overdue}
          valueTone={counts.overdue > 0 ? "danger" : "default"}
          deltaLabel="Stores past their due date"
        />
      </KpiStrip>

      <div className={tablePanelClassName}>
        {selectedCount > 0 ? (
          <SelectionBar count={selectedCount} onClear={() => setSelected(new Set())}>
            {previewButton}
            {canSend ? (
              <UiButton
                variant="ghost"
                size="sm"
                startIcon={<IconSend aria-hidden />}
                isLoading={sending}
                onPress={() => void handleSend()}
              >
                Send reminder
              </UiButton>
            ) : null}
          </SelectionBar>
        ) : (
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search stores to remind"
            endContent={
              <>
                <Select
                  aria-label="Due window"
                  size="sm"
                  className="w-44"
                  selectedKeys={new Set([windowFilter])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];
                    if (
                      value === "all" ||
                      value === "30" ||
                      value === "14" ||
                      value === "7" ||
                      value === "3" ||
                      value === "overdue"
                    ) {
                      setWindowFilter(value);
                      setSelected(new Set());
                    }
                  }}
                  disallowEmptySelection
                >
                  <SelectItem key="30">Due within 30 days</SelectItem>
                  <SelectItem key="14">Due within 14 days</SelectItem>
                  <SelectItem key="7">Due within 7 days</SelectItem>
                  <SelectItem key="3">Due within 3 days</SelectItem>
                  <SelectItem key="overdue">Overdue</SelectItem>
                  <SelectItem key="all">All stores</SelectItem>
                </Select>
                {previewButton}
              </>
            }
          />
        )}

        <Table
          aria-label="Stores to remind"
          {...dataTableSelectionProps}
          selectedKeys={selected}
          onSelectionChange={handleSelectionChange}
          classNames={{ ...dataTableClassNames, tr: tableRowClasses }}
        >
          <TableHeader columns={[...columns]}>
            {(column) => (
              <TableColumn key={column.key} align={column.key === "daysLeft" ? "end" : "start"}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={storeRows}
            isLoading={loading}
            loadingContent={<Skeleton className="h-10 w-full rounded-lg" />}
            emptyContent={
              <EmptyState
                icon={IconMessages}
                title="No stores in this window"
                description="Choose a wider window or search for another store."
              />
            }
          >
            {(row) => (
              <TableRow key={row.id}>
                {(columnKey) => (
                  <TableCell>{renderCell(row, String(columnKey))}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width="md"
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-0.5">
                Email preview
                <span className="text-sm font-normal text-fg-muted">
                  Every selected store gets this template. Placeholders are filled in when it's sent.
                </span>
              </ModalHeader>
              <ModalBody className="gap-4">
                <div>
                  <p className="text-label font-medium text-fg">Subject</p>
                  <p className="mt-1.5 rounded-lg border border-line bg-surface-muted px-3 py-2 text-body text-fg">
                    {preview?.subject ?? EMAIL_SUBJECT}
                  </p>
                </div>
                <div>
                  <p className="text-label font-medium text-fg">Message</p>
                  <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-line bg-surface-muted px-4 py-3 text-body text-fg">
                    {preview?.body ?? EMAIL_BODY}
                  </p>
                </div>
                <p className="text-caption text-fg-muted">
                  Placeholders: <span className="font-mono">{"{{days}}"}</span>,{" "}
                  <span className="font-mono">{"{{storeName}}"}</span>,{" "}
                  <span className="font-mono">{"{{ownerName}}"}</span>,{" "}
                  <span className="font-mono">{"{{plan}}"}</span>,{" "}
                  <span className="font-mono">{"{{renewalDate}}"}</span>
                </p>
              </ModalBody>
              <ModalFooter>
                <UiButton variant="ghost" onPress={close}>
                  Cancel
                </UiButton>
                <UiButton
                  variant="primary"
                  isDisabled={selectedCount === 0 || !canSend}
                  isLoading={sending}
                  onPress={() => void handleSend()}
                >
                  {selectedCount > 0 ? `Send reminder to ${plural(selectedCount, "store")}` : "Send reminder"}
                </UiButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
