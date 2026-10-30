/**
 * Store detail › Change plan (PRD-016 FR-2..FR-7, FR-26; PRD-017 FR-4.2)
 *
 * Lists only the plans the server allows for this store (ACTIVE global
 * plans, the store's custom plans, and its current version for a cycle
 * change; never another LEGACY one) and shows `previewTenantPlanChange`
 * before the operator confirms: credit for unused time, charge, due now,
 * next invoice and over-limit warnings. `NOW` is allowed outside a trial
 * (proration). A downgrade now is refused by the preview
 * (`DOWNGRADE_AT_PERIOD_END`); the override asks for a reason and the
 * store gets the difference as credit: once the override is on, the dialog
 * shows the forced preview (`override: true`) with the credit it issues
 * (`creditIssued`), and the credits list shows it after the change.
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLATFORM_PLANS } from "../../graphql/plans";
import { CHANGE_TENANT_PLAN, PREVIEW_TENANT_PLAN_CHANGE } from "../../graphql/subscriptions";
import { errorReasonOf } from "../../lib/apollo-client";
import { billingFailureCopy, isUserInputError } from "../../lib/mutation-errors";
import { planVersionLabel } from "../../lib/plan-catalog.util";
import {
  BILLING_REASON_COPY,
  isDowngradeRefusal,
  overLimitLabels,
  planChangeOptions,
  planChangeVariables,
  previewRowsOf,
} from "../../lib/platform-billing.util";
import { formatDate } from "../../lib/utils";
import type { Client, Subscription } from "../../types";
import type {
  PlanChangeEffective,
  PlatformBillingCycle,
  PlatformPlan,
  PlatformPlanChangePreview,
} from "../../types/platform-api";
import {
  Button as UiButton,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  SegmentedControl,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  Textarea,
  formatMoney,
  toastError,
} from "../ui";

export interface ChangePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  subscription?: Subscription;
  /** Re-reads the store after the change (its badge and fee live on the tenant). */
  onChanged: () => Promise<unknown>;
}

export function ChangePlanDialog({ isOpen, onClose, client, subscription, onChanged }: ChangePlanDialogProps) {
  const tenantId = client.id;
  const isTrial = subscription?.status === "TRIAL";
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<PlatformBillingCycle>(subscription?.billingCycle ?? "MONTHLY");
  const [effective, setEffective] = useState<PlanChangeEffective>("PERIOD_END");
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [changePlan] = useMutation(CHANGE_TENANT_PLAN);

  const plansQuery = useQuery<{ platformPlans: PlatformPlan[] }>(PLATFORM_PLANS, {
    variables: { tenantId, includeInactive: true },
    skip: !isOpen,
    fetchPolicy: "cache-and-network",
  });
  const options = useMemo(
    () => planChangeOptions(plansQuery.data?.platformPlans ?? [], tenantId, subscription?.planId),
    [plansQuery.data, subscription?.planId, tenantId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setCycle(subscription?.billingCycle ?? "MONTHLY");
    setEffective("PERIOD_END");
    setOverride(false);
    setReason("");
    setError(null);
    setPlanId("");
  }, [isOpen, subscription?.billingCycle]);

  useEffect(() => {
    if (!isOpen || planId || options.length === 0) return;
    const current = options.find((option) => option.id === subscription?.planId);
    setPlanId(current?.id ?? options[0].id);
  }, [isOpen, options, planId, subscription?.planId]);

  const preview = useQuery<{ previewTenantPlanChange: PlatformPlanChangePreview }>(PREVIEW_TENANT_PLAN_CHANGE, {
    variables: { tenantId, planId, billingCycle: cycle, effective },
    skip: !isOpen || !planId,
    fetchPolicy: "network-only",
  });
  const previewData = preview.error ? null : preview.data?.previewTenantPlanChange;
  const previewReason = preview.error ? errorReasonOf(preview.error) : undefined;
  const needsOverride = effective === "NOW" && isDowngradeRefusal(previewReason);
  const blocked = !!preview.error && !needsOverride;
  // The forced downgrade's own preview; asked only once the override is on
  const forcedPreview = useQuery<{ previewTenantPlanChange: PlatformPlanChangePreview }>(
    PREVIEW_TENANT_PLAN_CHANGE,
    {
      variables: { tenantId, planId, billingCycle: cycle, effective, override: true },
      skip: !isOpen || !planId || !needsOverride || !override,
      fetchPolicy: "network-only",
    },
  );
  const forcedData = needsOverride && override && !forcedPreview.error
    ? forcedPreview.data?.previewTenantPlanChange
    : null;
  const shownPreview = previewData ?? forcedData ?? null;

  const run = async () => {
    if (!planId) {
      setError("Pick a plan.");
      return;
    }
    const result = planChangeVariables({
      tenantId,
      planId,
      billingCycle: cycle,
      effective,
      override: needsOverride && override,
      reason,
    });
    if (!result.variables) {
      setError(result.error);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await changePlan({ variables: result.variables });
      await onChanged();
      addToast({
        title: isTrial
          ? "Plan changed."
          : effective === "NOW"
            ? needsOverride
              ? "Plan changed now; the difference is credited to the store."
              : "Plan changed now."
            : "Plan change scheduled for the next renewal.",
      });
      onClose();
    } catch (err) {
      const message = billingFailureCopy(err);
      if (message && (isUserInputError(err) || errorReasonOf(err))) setError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const money = (amount: number) =>
    formatMoney(amount, { currency: shownPreview?.currency ?? "INR", paise: true });
  const renewal = subscription?.renewalDate ? formatDate(subscription.renewalDate) : "the next renewal";

  return (
    <Modal isOpen={isOpen} onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>Change {client.storeName}'s plan</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {plansQuery.error && !plansQuery.data ? (
              <p className="text-body text-tone-danger-text" role="alert">
                Couldn't load the plans this store can move to.
              </p>
            ) : (
              <Select
                label="Plan"
                selectedKeys={planId ? new Set([planId]) : new Set()}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") setPlanId(value);
                }}
                disallowEmptySelection
                isLoading={plansQuery.loading && !plansQuery.data}
                description="Only plans this store can be given: active plans and its own custom plans."
              >
                {options.map((plan) => (
                  <SelectItem key={plan.id}>
                    {`${planVersionLabel(plan)}${plan.tenantId ? " (custom)" : ""}${plan.id === subscription?.planId ? " · current" : ""}`}
                  </SelectItem>
                ))}
              </Select>
            )}
            <Select
              label="Billing cycle"
              selectedKeys={new Set([cycle])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (value === "MONTHLY" || value === "YEARLY") setCycle(value);
              }}
              disallowEmptySelection
            >
              <SelectItem key="MONTHLY">Monthly</SelectItem>
              <SelectItem key="YEARLY">Yearly</SelectItem>
            </Select>

            {isTrial ? (
              <p className="text-caption text-fg-muted">A trial changes plan straight away, with no invoice.</p>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-label text-fg-muted">Takes effect</span>
                <SegmentedControl
                  aria-label="When the change takes effect"
                  value={effective}
                  onChange={(value: string) => {
                    setEffective(value === "NOW" ? "NOW" : "PERIOD_END");
                    setOverride(false);
                    setError(null);
                  }}
                  options={[
                    { value: "PERIOD_END", label: `At renewal (${renewal})` },
                    { value: "NOW", label: "Now, prorated" },
                  ]}
                />
              </div>
            )}

            {/* PRD-016 FR-6: the server's preview; nothing is written. */}
            <section aria-label="What this change does" className="rounded-card border border-line p-3">
              {preview.loading || (needsOverride && override && forcedPreview.loading) ? (
                <div className="space-y-2" role="status" aria-label="Loading the preview">
                  <Skeleton className="h-5 w-full rounded" />
                  <Skeleton className="h-5 w-2/3 rounded" />
                </div>
              ) : shownPreview ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body text-fg">
                    {forcedData
                      ? "Downgrades now with the override."
                      : shownPreview.effective === "NOW"
                        ? "Changes now."
                        : `Changes on ${formatDate(shownPreview.effectiveAt)}, the next renewal.`}
                  </p>
                  <dl className="flex flex-col gap-1 text-body">
                    {previewRowsOf(shownPreview).map((row) => (
                      <div key={row.key} className="flex justify-between gap-4">
                        <dt className="text-fg-muted">{row.label}</dt>
                        <dd className="num text-fg">{money(row.amount)}</dd>
                      </div>
                    ))}
                  </dl>
                  {shownPreview.overLimits.length > 0 ? (
                    <p className="text-label text-tone-warning" role="note">
                      This store has {overLimitLabels(shownPreview.overLimits).join(" and ")}. It keeps its data but
                      can't add more until it is under the limit.
                    </p>
                  ) : null}
                </div>
              ) : preview.error ? (
                <p className="text-body text-fg" role="alert">
                  {(previewReason && BILLING_REASON_COPY[previewReason]) ?? billingFailureCopy(preview.error)}
                </p>
              ) : (
                <p className="text-body text-fg-muted">Pick a plan to see what changes.</p>
              )}
            </section>

            {needsOverride ? (
              <div className="flex flex-col gap-2">
                <Switch isSelected={override} onValueChange={setOverride}>
                  Override: downgrade now and credit the store
                </Switch>
                {override ? (
                  <Textarea
                    label="Reason"
                    isRequired
                    description="Required. The unused part of what the store paid becomes credit for its next invoices. Your name and the reason go to the audit log."
                    value={reason}
                    onValueChange={setReason}
                  />
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="text-body text-tone-danger-text" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton
            variant={needsOverride ? "destructive" : "primary"}
            isLoading={busy}
            isDisabled={
              busy ||
              !planId ||
              preview.loading ||
              blocked ||
              (needsOverride && (!override || !reason.trim()))
            }
            onPress={() => void run()}
          >
            {isTrial ? "Change plan" : effective === "NOW" ? "Change plan now" : "Schedule change"}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
