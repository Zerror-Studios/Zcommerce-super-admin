/**
 * Billing & plan (04 S-03d): the Payment status card and the store's own grace period. The grace period stages
 * in the page's one save bar (02 §7.1): the card has no Save button of its own.
 */
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import type { Client, Subscription } from "../../types";
import { graceDaysFor, paymentState } from "../../lib/storeStatus";
import { formatDate } from "../../lib/utils";
import {
  Button as UiButton,
  Card,
  Chip,
  IconTime,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
  Switch,
  formatMoney,
} from "../ui";
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
  /** True once the server has saved it. */
  save: () => Promise<boolean>;
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
      return false;
    }
    setError(null);
    setSaving(true);
    const saved = await onSaveGracePeriod(n);
    setSaving(false);
    if (!saved) return false;
    addToast({
      title:
        n === undefined
          ? toasts.gracePeriodDefault(days(defaultGracePeriodDays))
          : toasts.gracePeriodSet(days(n), client.storeName),
    });
    return true;
  };

  const discard = () => {
    setUseOverrideState(savedOverride != null);
    setDaysInputState(String(savedOverride ?? defaultGracePeriodDays));
    setError(null);
  };

  return { useOverride, setUseOverride, daysInput, setDaysInput, error, isDirty, isSaving, save, discard };
}

/**
 * Billing › Adjust › Grace period (owner, 2026-11-26: a pop-up from the Adjust card instead of its own card and the
 * page save bar). Opens on the saved value; Save sends it and closes once the server has it.
 */
export function GracePeriodDialog({
  isOpen,
  onClose,
  draft,
  defaultGracePeriodDays,
  storeName,
}: {
  isOpen: boolean;
  onClose: () => void;
  draft: GracePeriodDraft;
  defaultGracePeriodDays: number;
  storeName: string;
}) {
  const close = () => {
    draft.discard();
    onClose();
  };
  const save = async () => {
    if (!draft.isDirty) {
      onClose();
      return;
    }
    if (await draft.save()) onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={close} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconTime aria-hidden />}>Grace period for {storeName}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            Extra days before this store is suspended for non-payment. Default: {days(defaultGracePeriodDays)}.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            <Switch isSelected={draft.useOverride} onValueChange={draft.setUseOverride}>
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
                isInvalid={!!draft.error}
                errorMessage={draft.error}
                description="0–30 days after the due date"
                className="max-w-40"
              />
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={close} isDisabled={draft.isSaving}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={draft.isSaving} isDisabled={draft.isSaving} onPress={() => void save()}>
            Save
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
