import { addToast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { Client } from "../../types";
import type { TenantMoneyInFlight, TenantSuspendCategory } from "../../types/platform-api";
import { errorReasonOf } from "../../lib/apollo-client";
import { billingFailureCopy, isUserInputError } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { reactivationVariables } from "../../lib/platform-billing.util";
import {
  DEFAULT_SUSPEND_CATEGORY,
  SUSPEND_CATEGORY_OPTIONS,
  deleteBlockers,
  deleteVariables,
  lifecycleFailureCopy,
  moneyCountsFromError,
  purgeCountdown,
  suspendCategoryLabel,
} from "../../lib/tenant-lifecycle.util";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { confirms, toasts } from "../../copy";
import { MoneyInFlightPanel } from "./MoneyInFlightPanel";
import {
  Button as UiButton,
  Input,
  Modal,
  ModalBody,
  Select,
  SelectItem,
  Switch,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  toastError,
} from "../ui";

/** `category` changes why a suspended store is suspended (PRD-018 FR-1.1). */
export type StoreAction = "suspend" | "category" | "reactivate" | "delete" | "restore";

export interface StoreActionDialogProps {
  client: Client | null;
  action: StoreAction | null;
  onClose: () => void;
  /** Runs after the store was deleted (e.g. leave the detail page). */
  onDeleted?: () => void;
}

/** Reasons the dialog shows in place rather than as a toast. */
const INLINE_REASONS = new Set([
  "PAYMENT_REQUIRED",
  "MONEY_IN_FLIGHT",
  "OWNER_ONLY",
  "PURGE_STARTED",
  "NOTE_REQUIRED",
]);

/**
 * Confirm dialogs for the store actions, shared by the stores table row
 * menu and the store detail page. Wording from docs/design/05-wording.md
 * §7–8. PRD-018: suspend picks a category and shows the money in flight;
 * delete asks for the slug, shows the money in flight and, when the
 * server refuses with `MONEY_IN_FLIGHT`, lists the blockers and lets the
 * platform owner delete anyway with a reason; restore brings a deleted
 * store back as suspended inside its grace period.
 */
export function StoreActionDialog({ client, action, onClose, onDeleted }: StoreActionDialogProps) {
  const { setClientStatus, deleteClient, restoreClient } = useClients();
  const { can, user } = useAuth();
  // PRD-016 FR-18: the override of a BILLING suspension needs billing:manage too.
  const canOverride = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  // Q10 / PRD-018 FR-2.1: only the platform owner deletes, and forces.
  const isOwner = user?.role === "PLATFORM_OWNER";
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<TenantSuspendCategory>(DEFAULT_SUSPEND_CATEGORY);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [force, setForce] = useState(false);
  const [blockedCounts, setBlockedCounts] = useState<Partial<TenantMoneyInFlight> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = client?.storeName ?? "";
  const open = client != null && action != null;

  useEffect(() => {
    setReason("");
    setOverride(false);
    setConfirmSlug("");
    setForce(false);
    setBlockedCounts(null);
    setError(null);
    // A category change starts from another category than the current one
    setCategory(
      action === "category" && client?.suspendCategory === DEFAULT_SUSPEND_CATEGORY
        ? "MAINTENANCE"
        : DEFAULT_SUSPEND_CATEGORY,
    );
  }, [client?.id, client?.suspendCategory, action]);

  if (!client || !action) return null;

  const copy = dialogCopy(action, name, client);
  const needsSlug = action === "delete" && !!client.slug;
  const slugMatches = !needsSlug || confirmSlug.trim() === client.slug;
  const blockers = blockedCounts ? deleteBlockers(blockedCounts) : [];
  const countdown = purgeCountdown(client.purgeAfter);

  const run = async () => {
    if ((action === "suspend" || action === "category") && !reason.trim()) {
      setError("Give a reason; the owner and the audit log see it.");
      return;
    }
    if (action === "category" && category === client.suspendCategory) {
      setError("Pick a different category.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action === "suspend" || action === "category") {
        await setClientStatus(client.id, "suspended", reason, undefined, category);
        addToast({
          title:
            action === "category"
              ? `${client.storeName} is now suspended for ${suspendCategoryLabel(category).toLowerCase()}.`
              : toasts.storeSuspended(client.storeName),
        });
      } else if (action === "reactivate") {
        const result = reactivationVariables(override, reason);
        if (!result.variables) {
          setError(result.error);
          return;
        }
        await setClientStatus(client.id, "active", undefined, result.variables);
        addToast({ title: toasts.storeReactivated(client.storeName) });
      } else if (action === "restore") {
        await restoreClient(client.id);
        addToast({
          title: `${client.storeName} restored.`,
          description: "It is suspended (owner's request) until you reactivate it.",
        });
      } else {
        const result = deleteVariables({
          id: client.id,
          slug: client.slug,
          confirmSlug,
          force,
          forceReason: reason,
        });
        if (!result.variables) {
          setError(result.error);
          return;
        }
        const { forceReason } = result.variables;
        await deleteClient(
          client.id,
          result.variables.confirmSlug,
          result.variables.force && forceReason ? { forceReason } : undefined,
        );
        addToast({
          title: toasts.storeDeleted(client.storeName),
          description: "Its data is kept for the grace period; you can restore it until then.",
        });
        onDeleted?.();
      }
      onClose();
    } catch (err) {
      const counts = moneyCountsFromError(err);
      if (counts) setBlockedCounts(counts);
      // FORBIDDEN and MFA_REQUIRED are reported once by the Apollo link (review C-M5).
      const message =
        action === "reactivate" ? billingFailureCopy(err) : lifecycleFailureCopy(err);
      const inline = isUserInputError(err) || INLINE_REASONS.has(errorReasonOf(err) ?? "");
      if (message && inline) setError(message);
      else if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDisabled =
    busy ||
    !slugMatches ||
    (action === "reactivate" && override && !reason.trim()) ||
    (action === "delete" && force && !reason.trim()) ||
    (action === "restore" && !!countdown?.expired);

  return (
    <Modal isOpen={open} onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>{copy.title}</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">{copy.description}</p>

          {action === "suspend" || action === "category" ? (
            <>
              <Select
                label="Category"
                selectedKeys={new Set([category])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  const option = SUSPEND_CATEGORY_OPTIONS.find((item) => item.value === value);
                  if (option) setCategory(option.value);
                }}
                disallowEmptySelection
                description={SUSPEND_CATEGORY_OPTIONS.find((item) => item.value === category)?.description}
                className="mt-3"
              >
                {SUSPEND_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
              <Textarea
                label="Reason"
                placeholder="Unpaid for 60 days"
                value={reason}
                onValueChange={setReason}
                isInvalid={!!error}
                errorMessage={error ?? undefined}
                className="mt-3"
              />
            </>
          ) : null}

          {/* PRD-018 FR-1.2: what stays open; payments keep settling while suspended. */}
          {action === "suspend" ? (
            <>
              <MoneyInFlightPanel tenantId={client.id} className="mt-3" />
              <p className="mt-1 text-caption text-fg-muted">
                Payments already started still settle while the store is suspended.
              </p>
            </>
          ) : null}

          {action === "reactivate" && canOverride ? (
            <>
              <Switch isSelected={override} onValueChange={setOverride} className="mt-3">
                Override: the store was suspended for an unpaid invoice
              </Switch>
              <p className="mt-1 text-caption text-fg-muted">
                A store suspended for non-payment comes back by itself when it pays. Use the override only for an
                agreed exception.
              </p>
            </>
          ) : null}
          {action === "reactivate" && (override || error) ? (
            <Textarea
              label="Reason"
              isRequired={override}
              description={override ? "Required. Your name and the reason go to the audit log." : undefined}
              value={reason}
              onValueChange={setReason}
              isInvalid={!!error}
              errorMessage={error ?? undefined}
              className="mt-3"
            />
          ) : null}

          {action === "restore" ? (
            countdown && !countdown.expired ? (
              <p className="mt-2 text-body text-fg">
                Data will be purged on {formatDate(client.purgeAfter!)} ({countdown.daysLeft} days left).
              </p>
            ) : countdown?.expired ? (
              <p role="alert" className="mt-2 text-body text-tone-danger-text">
                The grace period ended on {formatDate(client.purgeAfter!)}; this store can't be restored.
              </p>
            ) : null
          ) : null}
          {action === "restore" && error ? (
            <p role="alert" className="mt-2 text-body text-tone-danger-text">
              {error}
            </p>
          ) : null}

          {action === "delete" ? (
            <>
              <MoneyInFlightPanel
                tenantId={client.id}
                highlightBlockers
                override={blockedCounts}
                className="mt-3"
              />
              {blockers.length > 0 || blockedCounts ? (
                <div role="alert" className="mt-2 flex flex-col gap-1">
                  <p className="text-body text-tone-danger-text">
                    The server refused the delete
                    {blockers.length > 0
                      ? `: ${blockers.map((row) => `${row.count} ${row.label.toLowerCase()}`).join(", ")}.`
                      : " because the open items couldn't all be counted."}
                  </p>
                  {isOwner ? (
                    <Switch isSelected={force} onValueChange={setForce} className="mt-1">
                      Delete anyway (platform owner)
                    </Switch>
                  ) : (
                    <p className="text-caption text-fg-muted">
                      Only the platform owner can delete a store with money in flight.
                    </p>
                  )}
                </div>
              ) : null}
              {force ? (
                <Textarea
                  label="Reason for deleting anyway"
                  isRequired
                  description="Required. Your name, the reason and the open counts go to the audit log."
                  value={reason}
                  onValueChange={setReason}
                  className="mt-3"
                />
              ) : null}
              {needsSlug ? (
                <Input
                  label={`Type ${client.slug} to confirm`}
                  value={confirmSlug}
                  onValueChange={setConfirmSlug}
                  isInvalid={!!error && !blockedCounts}
                  errorMessage={!blockedCounts ? error ?? undefined : undefined}
                  autoComplete="off"
                  className="mt-3"
                />
              ) : null}
              {error && blockedCounts && force ? (
                <p role="alert" className="mt-2 text-body text-tone-danger-text">
                  {error}
                </p>
              ) : null}
            </>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <UiButton variant="ghost" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton
            variant={action === "reactivate" || action === "restore" ? "primary" : "danger"}
            isLoading={busy}
            isDisabled={confirmDisabled}
            onPress={() => void run()}
          >
            {action === "delete" && force ? "Delete anyway" : copy.confirmLabel}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function dialogCopy(action: StoreAction, name: string, client: Client) {
  switch (action) {
    case "suspend":
      return confirms.suspendStore(name);
    case "category":
      return {
        title: `Change why ${name} is suspended`,
        description: `It is suspended for ${suspendCategoryLabel(client.suspendCategory).toLowerCase()} now. The category decides whether store staff can still sign in to settle orders.`,
        confirmLabel: "Change category",
      };
    case "reactivate":
      return confirms.reactivateStore(name);
    case "restore":
      return {
        title: `Restore ${name}?`,
        description:
          "The store comes back suspended (owner's request) with all its data. Reconnect its apps, then reactivate it.",
        confirmLabel: "Restore store",
      };
    default:
      return confirms.deleteStore(name);
  }
}
