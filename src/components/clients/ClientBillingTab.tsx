/**
 * Billing & plan (04 S-03d): the Payment status card and the store's own grace period. The grace period stages
 * in the page's one save bar (02 §7.1): the card has no Save button of its own.
 */
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import type { Client, Subscription } from "../../types";
import { graceDaysFor, paymentState } from "../../lib/storeStatus";
import { formatDate } from "../../lib/utils";
import { Card, Chip, Input, Switch, formatMoney } from "../ui";
import { toasts } from "../../copy";
import { KeyValue, KeyValueGrid } from "./StoreDetailParts";

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

// ─── Payment status ──────────────────────────────────────────────────────────

export function PaymentStatusCard({
  client,
  subscription,
  defaultGracePeriodDays,
}: {
  client: Client;
  subscription?: Subscription;
  defaultGracePeriodDays: number;
}) {
  const payment = paymentState(subscription);
  return (
    <Card title="Payment status" actions={<Chip tone={payment.tone}>{payment.label}</Chip>} className="h-full">
      <KeyValueGrid columns={2}>
        <KeyValue label="Next invoice">{subscription ? formatDate(subscription.renewalDate) : null}</KeyValue>
        <KeyValue label="Amount due">
          {subscription && subscription.amountDue > 0 ? (
            <span className="num">{formatMoney(subscription.amountDue)}</span>
          ) : (
            "Nothing due"
          )}
        </KeyValue>
        <KeyValue label="Grace period">{days(graceDaysFor(client, defaultGracePeriodDays))}</KeyValue>
        <KeyValue label="Suspension date">{payment.detail ?? "None scheduled"}</KeyValue>
      </KeyValueGrid>
    </Card>
  );
}

// ─── Grace period ────────────────────────────────────────────────────────────

export interface GracePeriodDraft {
  useOverride: boolean;
  setUseOverride: (next: boolean) => void;
  daysInput: string;
  setDaysInput: (next: string) => void;
  error: string | null;
  isDirty: boolean;
  isSaving: boolean;
  save: () => Promise<void>;
  discard: () => void;
}

/**
 * The grace-period draft (PRD-024 FR-1.4, D-04): the "saved" toast waits for the server's answer, which
 * `onSaveGracePeriod` resolves true once it has it.
 */
export function useGracePeriodDraft({
  client,
  defaultGracePeriodDays,
  onSaveGracePeriod,
}: {
  client: Client;
  defaultGracePeriodDays: number;
  onSaveGracePeriod: (days: number | undefined) => Promise<boolean>;
}): GracePeriodDraft {
  const savedOverride = client.gracePeriodDays;
  const [useOverride, setUseOverrideState] = useState(savedOverride != null);
  const [daysInput, setDaysInputState] = useState(String(savedOverride ?? defaultGracePeriodDays));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    setUseOverrideState(client.gracePeriodDays != null);
    setDaysInputState(String(client.gracePeriodDays ?? defaultGracePeriodDays));
    setError(null);
  }, [client.id, client.gracePeriodDays, defaultGracePeriodDays]);

  const isDirty = useMemo(() => {
    if (!useOverride) return savedOverride != null;
    const n = Number(daysInput);
    if (!Number.isFinite(n)) return true;
    return savedOverride !== n;
  }, [useOverride, daysInput, savedOverride]);

  const setUseOverride = (next: boolean) => {
    setUseOverrideState(next);
    if (!next) {
      setDaysInputState(String(defaultGracePeriodDays));
      setError(null);
    }
  };

  const setDaysInput = (next: string) => {
    setDaysInputState(next);
    setError(null);
  };

  const save = async () => {
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

  const discard = () => {
    setUseOverrideState(savedOverride != null);
    setDaysInputState(String(savedOverride ?? defaultGracePeriodDays));
    setError(null);
  };

  return { useOverride, setUseOverride, daysInput, setDaysInput, error, isDirty, isSaving, save, discard };
}

export function GracePeriodCard({
  draft,
  defaultGracePeriodDays,
  canEdit,
}: {
  draft: GracePeriodDraft;
  defaultGracePeriodDays: number;
  /** False for roles without tenants:manage: the override is shown but not editable. */
  canEdit: boolean;
}) {
  return (
    <Card
      title="Grace period"
      description={`Extra days before this store is suspended for non-payment. Default: ${days(defaultGracePeriodDays)}.`}
      className="h-full"
    >
      <div className="flex flex-col gap-4">
        <Switch isSelected={draft.useOverride} isDisabled={!canEdit} onValueChange={draft.setUseOverride}>
          Custom grace period for this store
        </Switch>
        {draft.useOverride ? (
          <Input
            type="number"
            label="Days"
            min={0}
            max={30}
            value={draft.daysInput}
            onValueChange={draft.setDaysInput}
            isDisabled={!canEdit}
            isInvalid={!!draft.error}
            errorMessage={draft.error}
            description="0–30 days after the due date"
            className="max-w-40"
          />
        ) : null}
      </div>
    </Card>
  );
}
