import { addToast, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Client, Subscription } from "../../types";
import { usePayments } from "../../hooks/use-platform-reports";
import { graceDaysFor, paymentState } from "../../lib/storeStatus";
import { formatDate, formatDateTime } from "../../lib/utils";
import { dataTableClassNames } from "../common/dataTableStyles";
import { LoadMoreFooter } from "../common/LoadMoreFooter";
import { Button as UiButton, Card, Chip, CopyableId, EmptyState, ErrorState, Input, Skeleton, StatusChip, Switch, formatMoney } from "../ui";
import { IconInvoice } from "../ui/icons";
import { emptyStates } from "../../copy";

export interface ClientBillingTabProps {
  client: Client;
  subscription?: Subscription;
  defaultGracePeriodDays: number;
  onSaveGracePeriod: (days: number | undefined) => void;
  /** False for roles without tenants:manage: the override is shown but not editable. */
  canEdit?: boolean;
}

const txnColumns = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount", align: "end" as const },
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
}: ClientBillingTabProps) {
  // PRD-005 FR-5.2: this store's platform payments (payment_log)
  const payments = usePayments({ tenantId: client.id });
  const transactions = payments.data;
  const savedOverride = client.gracePeriodDays;
  const [useOverride, setUseOverride] = useState(savedOverride != null);
  const [daysInput, setDaysInput] = useState(String(savedOverride ?? defaultGracePeriodDays));
  const [error, setError] = useState<string | null>(null);

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

  const onSave = () => {
    if (!useOverride) {
      setError(null);
      onSaveGracePeriod(undefined);
      addToast({ title: `Grace period set to the default (${days(defaultGracePeriodDays)}).` });
      return;
    }
    const n = Number(daysInput);
    if (!Number.isFinite(n) || n < 0 || n > 30 || !Number.isInteger(n)) {
      setError("Use a whole number from 0 to 30.");
      return;
    }
    setError(null);
    onSaveGracePeriod(n);
    addToast({ title: `Grace period set to ${days(n)} for ${client.storeName}.` });
  };

  const onCancel = () => {
    setUseOverride(savedOverride != null);
    setDaysInput(String(savedOverride ?? defaultGracePeriodDays));
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Status and the grace-period control side by side (same right column as the store overview), history below. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Payment status" className="h-full" actions={<Chip tone={payment.tone}>{payment.label}</Chip>}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
          className="h-full"
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
              <UiButton variant="primary" isDisabled={!dirty || !canEdit} onPress={onSave}>
                Save
              </UiButton>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Billing history" padding="none" className="overflow-hidden">
        {payments.error ? (
          <ErrorState inline title="Couldn't load the billing history." onRetry={() => void payments.refetch()} />
        ) : payments.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
        <Table
          aria-label="Billing history"
          removeWrapper
          classNames={{
            ...dataTableClassNames,
            base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
            // No selection column here, so the first column isn't the 48px checkbox column.
            th: dataTableClassNames.th.replace("first:w-12 ", ""),
            td: dataTableClassNames.td.replace("first:w-12 ", ""),
            tr: dataTableClassNames.tr.replace("cursor-pointer ", ""),
          }}
        >
          <TableHeader columns={txnColumns}>
            {(column) => (
              <TableColumn key={column.key} align={column.align ?? "start"} className={column.align === "end" ? "text-end" : undefined}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={transactions}
            emptyContent={
              <EmptyState icon={IconInvoice} title={emptyStates.storeInvoices.title} description={emptyStates.storeInvoices.description} />
            }
          >
            {(txn) => (
              <TableRow key={txn.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(txn.date)}</TableCell>
                <TableCell className="text-end">
                  <span className="num">{formatMoney(txn.amount, { currency: txn.currency, paise: true })}</span>
                </TableCell>
                <TableCell>
                  <StatusChip domain="payment" status={txn.status} />
                </TableCell>
                <TableCell>
                  <CopyableId value={txn.transactionId} className="text-label text-fg-muted" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        )}
        <LoadMoreFooter
          shown={transactions.length}
          total={payments.totalCount}
          hasMore={payments.hasMore && !payments.error}
          loading={payments.loadingMore}
          onLoadMore={payments.loadMore}
          noun="payments"
        />
      </Card>
    </div>
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
