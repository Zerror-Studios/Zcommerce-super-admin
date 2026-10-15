import { addToast, Input, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import type { Client, Transaction } from "../../types";
import { formatCurrency, formatDateTime } from "../../lib/utils";
import { getInputClasses } from "../../styles/inputStyle";
import { dataTableClassNames } from "../common/dataTableStyles";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import { StatusChip } from "../common/StatusChip";
import { Button as UiButton } from "../ui";
import { CardWrapper } from "../ui/CardWrapper";

export interface ClientBillingTabProps {
  client: Client;
  transactions: Transaction[];
  defaultGracePeriodDays: number;
  onSaveGracePeriod: (days: number | undefined) => void;
}

const txnColumns = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "transactionId", label: "Transaction ID" },
] as const;

export function ClientBillingTab({
  client,
  transactions,
  defaultGracePeriodDays,
  onSaveGracePeriod,
}: ClientBillingTabProps) {
  const savedOverride = client.gracePeriodDays;
  const [useOverride, setUseOverride] = useState(savedOverride != null);
  const [days, setDays] = useState(
    String(savedOverride ?? defaultGracePeriodDays),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUseOverride(client.gracePeriodDays != null);
    setDays(String(client.gracePeriodDays ?? defaultGracePeriodDays));
    setError(null);
  }, [client.id, client.gracePeriodDays, defaultGracePeriodDays]);

  const dirty = useMemo(() => {
    if (!useOverride) return savedOverride != null;
    const n = Number(days);
    if (!Number.isFinite(n)) return true;
    return savedOverride !== n;
  }, [useOverride, days, savedOverride]);

  const onSave = () => {
    if (!useOverride) {
      setError(null);
      onSaveGracePeriod(undefined);
      addToast({
        title: "Using platform default grace period",
        description: `${defaultGracePeriodDays} day${defaultGracePeriodDays === 1 ? "" : "s"}`,
        color: "success",
      });
      return;
    }
    const n = Number(days);
    if (!Number.isFinite(n) || n < 0 || n > 30 || !Number.isInteger(n)) {
      setError("Use a whole number from 0–30");
      addToast({ title: "Fix validation errors", color: "danger" });
      return;
    }
    setError(null);
    onSaveGracePeriod(n);
    addToast({
      title: "Grace period updated",
      description: `${n} day${n === 1 ? "" : "s"} for ${client.storeName}`,
      color: "success",
    });
  };

  const onCancel = () => {
    setUseOverride(savedOverride != null);
    setDays(String(savedOverride ?? defaultGracePeriodDays));
    setError(null);
  };

  return (
    <div className="space-y-4">
      <CardWrapper title="Grace period" description={<>Extend days after due date when this client says they will pay later. Uses the platform default ({defaultGracePeriodDays} day{defaultGracePeriodDays === 1 ? "" : "s"}) unless you set a custom value below.</>} bodyClassName="p-8 py-6 flex flex-col gap-4 sm:max-w-md">
          <Switch
            size="sm"
            isSelected={useOverride}
            onValueChange={(next) => {
              setUseOverride(next);
              if (!next) {
                setDays(String(defaultGracePeriodDays));
                setError(null);
              }
            }}
          >
            Custom grace period for this store
          </Switch>

          {!useOverride ? (
            <p className="text-caption text-default-400">
              Currently using platform default ({defaultGracePeriodDays} days)
            </p>
          ) : (
            <Input
              type="number"
              label="Grace period (days)"
              labelPlacement="outside"
              min={0}
              max={30}
              value={days}
              onValueChange={setDays}
              isInvalid={!!error}
              errorMessage={error}
              description="0–30 days after the due date"
              classNames={getInputClasses()}
            />
          )}

          <div className="flex items-center gap-2">
            <UiButton variant="outline" size="sm" isDisabled={!dirty} onPress={onCancel}>
              Cancel
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              isDisabled={!dirty}
              onPress={onSave}
            >
              Save
            </UiButton>
            {dirty ? (
              <span className="text-caption text-warning">Unsaved changes</span>
            ) : null}
          </div>
      </CardWrapper>

      <CardWrapper title="Billing history" description="Platform subscription charges for this client" bodyClassName="p-0" className="overflow-hidden">
          <Table
            aria-label="Client billing history"
            removeWrapper
            classNames={{
              ...dataTableClassNames,
              base: "rounded-none border-0 border-t border-default-200 overflow-hidden bg-surface",
            }}
          >
            <TableHeader columns={[...txnColumns]}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody
              items={transactions}
              emptyContent={
                <NoDataPlaceholder
                  title="No billing history yet"
                  description="Subscription charges for this client will show up here."
                />
              }
            >
              {(txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="text-sm">
                    {formatDateTime(txn.date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(txn.amount, txn.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="transaction" value={txn.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-default-500">
                    {txn.transactionId}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </CardWrapper>
    </div>
  );
}
