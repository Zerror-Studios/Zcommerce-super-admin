import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Client, Subscription } from "../../types";
import { usePayments } from "../../hooks/use-platform-reports";
import { graceDaysFor, paymentState } from "../../lib/storeStatus";
import { formatDate, formatDateTime } from "../../lib/utils";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import {
  Button as UiButton,
  Card,
  Chip,
  CopyableId,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  StatusChip,
  Switch,
  TablePagination,
  formatMoney,
  useTableUrlState,
  type DataTableColumn,
} from "../ui";
import { IconInvoice } from "../ui/icons";
import { emptyStates, toasts } from "../../copy";

export interface ClientBillingTabProps {
  client: Client;
  subscription?: Subscription;
  defaultGracePeriodDays: number;
  /** Resolves true once the server saved it (PRD-024 FR-1.4: the toast waits for that). */
  onSaveGracePeriod: (days: number | undefined) => Promise<boolean>;
  /** False for roles without tenants:manage: the override is shown but not editable. */
  canEdit?: boolean;
  /** Two-column store page: "rail" = payment status + grace period, "main" = billing history. */
  part: "main" | "rail";
}

const txnColumns: DataTableColumn[] = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount", align: "end" },
  { key: "status", label: "Status" },
  { key: "transactionId", label: "Transaction ID" },
];

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Store detail › Billing (docs/design/04-super-admin.md §3.4): payment status → billing history → grace period. */
export function ClientBillingTab({
  client,
  subscription,
  defaultGracePeriodDays,
  onSaveGracePeriod,
  canEdit = true,
  part,
}: ClientBillingTabProps) {
  // PRD-005 FR-5.2: this store's platform payments (payment_log), read by the main column only.
  const payments = usePayments({ tenantId: client.id, skip: part === "rail" });
  const transactions = payments.data;
  // Billing history pages at 50 (docs/design/09-settings-and-scale.md §3.1); ?bill_page= keeps the page.
  const history = useTableUrlState({ prefix: "bill" });
  const historyPage = Math.min(history.page, Math.max(1, Math.ceil(transactions.length / history.pageSize)));
  const historyRows = transactions.slice((historyPage - 1) * history.pageSize, historyPage * history.pageSize);
  const savedOverride = client.gracePeriodDays;
  const [useOverride, setUseOverride] = useState(savedOverride != null);
  const [daysInput, setDaysInput] = useState(String(savedOverride ?? defaultGracePeriodDays));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUseOverride(client.gracePeriodDays != null);
    setDaysInput(String(client.gracePeriodDays ?? defaultGracePeriodDays));
    setError(null);
  }, [client.id, client.gracePeriodDays, defaultGracePeriodDays]);

  const dirty = useMemo(() => {
    if (!useOverride) return savedOverride != null;
    const n = Number(daysInput);
    if (!Number.isFinite(n)) return true;
    return savedOverride !== n;
  }, [useOverride, daysInput, savedOverride]);

  const graceDays = graceDaysFor(client, defaultGracePeriodDays);
  const payment = paymentState(subscription);

  // PRD-024 FR-1.4 (D-04): the "saved" toast waits for the server's answer.
  const onSave = async () => {
    const n = useOverride ? Number(daysInput) : undefined;
    if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 30 || !Number.isInteger(n))) {
      setError("Use a whole number from 0 to 30.");
      return;
    }
    setError(null);
    setSaving(true);
    const saved = await onSaveGracePeriod(n);
    setSaving(false);
    if (!saved) return;
    addToast({
      title:
        n === undefined
          ? toasts.gracePeriodDefault(days(defaultGracePeriodDays))
          : toasts.gracePeriodSet(days(n), client.storeName),
    });
  };

  const onCancel = () => {
    setUseOverride(savedOverride != null);
    setDaysInput(String(savedOverride ?? defaultGracePeriodDays));
    setError(null);
  };

  if (part === "rail") {
    return (
      <>
        <Card title="Payment status" actions={<Chip tone={payment.tone}>{payment.label}</Chip>}>
          <dl className="grid grid-cols-2 gap-4">
            <StatusItem label="Next invoice">
              {subscription ? formatDate(subscription.renewalDate) : <span className="text-fg-subtle">—</span>}
            </StatusItem>
            <StatusItem label="Amount due">
              {subscription && subscription.amountDue > 0 ? (
                <span className="num">{formatMoney(subscription.amountDue, { whole: true })}</span>
              ) : (
                <span className="text-fg-subtle">—</span>
              )}
            </StatusItem>
            <StatusItem label="Grace period">{days(graceDays)}</StatusItem>
            <StatusItem label="Suspension">
              {payment.detail ?? <span className="text-fg-subtle">—</span>}
            </StatusItem>
          </dl>
        </Card>
        <Card
          title="Grace period"
          description={`Extra days before this store is suspended for non-payment. Default: ${days(defaultGracePeriodDays)}.`}
        >
          <div className="flex flex-col gap-4">
            <Switch
              isSelected={useOverride}
              isDisabled={!canEdit}
              onValueChange={(next) => {
                setUseOverride(next);
                if (!next) {
                  setDaysInput(String(defaultGracePeriodDays));
                  setError(null);
                }
              }}
            >
              Custom grace period for this store
            </Switch>

            {useOverride ? (
              <Input
                type="number"
                label="Grace period (days)"
                min={0}
                max={30}
                value={daysInput}
                onValueChange={setDaysInput}
                isDisabled={!canEdit}
                isInvalid={!!error}
                errorMessage={error}
                description="0–30 days after the due date"
                className="max-w-40"
              />
            ) : null}

            <div className="flex items-center gap-2">
              {dirty ? (
                <UiButton variant="ghost" onPress={onCancel}>
                  Cancel
                </UiButton>
              ) : null}
              <UiButton variant="primary" isDisabled={!dirty || !canEdit} isLoading={saving} onPress={() => void onSave()}>
                Save
              </UiButton>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
      <section aria-labelledby="billing-history" className="flex flex-col gap-3">
        <h3 id="billing-history" className="text-subtitle font-semibold text-fg">
          Billing history
        </h3>
        {payments.error ? (
          <ErrorState
            inline
            className="rounded-card border border-line bg-surface"
            title="Couldn't load the billing history."
            onRetry={() => void payments.refetch()}
          />
        ) : (
          <DataTable
            aria-label="Billing history"
            columns={txnColumns}
            rows={historyRows}
            getRowKey={(txn) => txn.id}
            isLoading={payments.loading}
            renderCell={(txn, key) => {
              switch (key) {
                case "date":
                  return <span className="whitespace-nowrap num">{formatDateTime(txn.date)}</span>;
                case "amount":
                  return <span className="num">{formatMoney(txn.amount, { currency: txn.currency, paise: true })}</span>;
                case "status":
                  return <StatusChip domain="payment" status={txn.status} />;
                case "transactionId":
                  return <CopyableId value={txn.transactionId} className="text-label text-fg-muted" />;
                default:
                  return null;
              }
            }}
            footer={
              <TablePagination
                page={historyPage}
                pageSize={history.pageSize}
                total={transactions.length}
                onPageChange={history.setPage}
              />
            }
            emptyContent={
              <EmptyState icon={IconInvoice} title={emptyStates.storeInvoices.title} description={emptyStates.storeInvoices.description} />
            }
          />
        )}
        {payments.error ? null : (
          <LoadMoreFooter
            shown={transactions.length}
            total={payments.totalCount}
            hasMore={payments.hasMore}
            loading={payments.loadingMore}
            onLoadMore={payments.loadMore}
            noun="payments"
          />
        )}
      </section>
  );
}

function StatusItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="mt-1 text-body text-fg">{children}</dd>
    </div>
  );
}
