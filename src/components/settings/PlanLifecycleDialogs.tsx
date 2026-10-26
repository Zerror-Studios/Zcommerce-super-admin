/**
 * Archive a plan and migrate its subscribers (PRD-017 FR-1.5, FR-1.6,
 * FR-4.1)
 *
 * Archive never deletes. While stores use the plan it needs a replacement
 * in the same scope, and those stores move to it at their next renewal.
 * Migrate schedules every store on a plan for a target plan at the first
 * renewal at least `noticeDays` away (default 30, D3); it is idempotent.
 * Before the run the dialog shows the server's dry-run counts
 * (`previewPlanMigration`), after it the counts the run answered. Both
 * wait for the server (UX-24).
 */

import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { ARCHIVE_PLAN, MIGRATE_PLAN_SUBSCRIBERS, PREVIEW_PLAN_MIGRATION } from "../../graphql/plans";
import { billingFailureCopy, isUserInputError } from "../../lib/mutation-errors";
import {
  DEFAULT_MIGRATION_NOTICE_DAYS,
  parseNoticeDays,
  planVersionLabel,
  replacementOptionsFor,
} from "../../lib/plan-catalog.util";
import type { PlanMigrationResult, PlatformPlan } from "../../types/platform-api";
import {
  Button as UiButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  toastError,
} from "../ui";

export interface PlanDialogProps {
  plan: PlatformPlan | null;
  /** Every plan the page loaded; replacements are picked from these. */
  plans: readonly PlatformPlan[];
  onClose: () => void;
}

function storesText(count: number): string {
  return `${count} ${count === 1 ? "store" : "stores"}`;
}

// ─── Archive ──────────────────────────────────────────────────────────────

export function ArchivePlanDialog({ plan, plans, onClose }: PlanDialogProps) {
  const [replacementId, setReplacementId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [archivePlan] = useMutation(ARCHIVE_PLAN, { refetchQueries: ["PlatformPlans"] });

  useEffect(() => {
    setReplacementId("");
    setError(null);
  }, [plan?.id]);

  if (!plan) return null;
  const inUse = (plan.subscriberCount ?? 0) > 0 || (plan.pendingCount ?? 0) > 0;
  const options = replacementOptionsFor(plan, plans);
  const replacement = options.find((option) => option.id === replacementId);
  const affected = (plan.subscriberCount ?? 0) + (plan.pendingCount ?? 0);

  const run = async () => {
    if (inUse && !replacementId) {
      setError("Pick the plan these stores move to.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await archivePlan({ variables: { id: plan.id, replacementPlanId: replacementId || null } });
      addToast({
        title: replacement
          ? `${planVersionLabel(plan)} archived. ${storesText(affected)} move to ${planVersionLabel(replacement)} at their next renewal.`
          : `${planVersionLabel(plan)} archived.`,
      });
      onClose();
    } catch (err) {
      // PLAN_IN_USE and friends belong in the dialog, next to the picker.
      const message = billingFailureCopy(err);
      if (message) setError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>Archive {planVersionLabel(plan)}?</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">
            An archived plan is never deleted and can't be sold or assigned again.
            {inUse ? ` ${storesText(affected)} use it now, so pick where they go.` : " No store uses it."}
          </p>
          {inUse ? (
            options.length === 0 ? (
              <p className="mt-3 text-body text-tone-danger-text" role="alert">
                There is no other active plan in this scope to move them to. Create one first.
              </p>
            ) : (
              <Select
                label="Replacement plan"
                className="mt-3"
                selectedKeys={replacementId ? new Set([replacementId]) : new Set()}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") setReplacementId(value);
                }}
                isInvalid={!!error}
                errorMessage={error ?? undefined}
              >
                {options.map((option) => (
                  <SelectItem key={option.id}>{planVersionLabel(option)}</SelectItem>
                ))}
              </Select>
            )
          ) : error ? (
            <p className="mt-3 text-body text-tone-danger-text" role="alert">
              {error}
            </p>
          ) : null}
          {replacement ? (
            <p className="mt-3 text-body text-fg">
              {storesText(affected)} move to {planVersionLabel(replacement)} at their next renewal.
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <UiButton variant="ghost" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton
            variant="danger"
            isLoading={busy}
            isDisabled={busy || (inUse && options.length === 0)}
            onPress={() => void run()}
          >
            Archive plan
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Migrate subscribers ──────────────────────────────────────────────────

export function MigratePlanDialog({ plan, plans, onClose }: PlanDialogProps) {
  const [targetId, setTargetId] = useState("");
  const [notice, setNotice] = useState(String(DEFAULT_MIGRATION_NOTICE_DAYS));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanMigrationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [migrate] = useMutation<{ migratePlanSubscribers: PlanMigrationResult }>(MIGRATE_PLAN_SUBSCRIBERS, {
    refetchQueries: ["PlatformPlans"],
  });

  useEffect(() => {
    setTargetId("");
    setNotice(String(DEFAULT_MIGRATION_NOTICE_DAYS));
    setError(null);
    setResult(null);
  }, [plan?.id]);

  // The dry run for the picked target and notice (nothing is written)
  const previewNotice = parseNoticeDays(notice);
  const preview = useQuery<{ previewPlanMigration: PlanMigrationResult }>(PREVIEW_PLAN_MIGRATION, {
    variables: { fromPlanId: plan?.id, toPlanId: targetId, noticeDays: previewNotice },
    skip: !plan || !targetId || previewNotice === null || result !== null,
    fetchPolicy: "network-only",
  });
  const dryRun = preview.error ? null : preview.data?.previewPlanMigration;

  if (!plan) return null;
  const options = replacementOptionsFor(plan, plans);
  const target = options.find((option) => option.id === targetId);
  const subscribers = plan.subscriberCount ?? 0;

  const run = async () => {
    const noticeDays = parseNoticeDays(notice);
    if (!targetId) {
      setError("Pick the plan to move these stores to.");
      return;
    }
    if (noticeDays === null) {
      setError("Notice is a whole number of days from 0 to 365.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await migrate({ variables: { fromPlanId: plan.id, toPlanId: targetId, noticeDays } });
      const counts = response.data?.migratePlanSubscribers ?? null;
      setResult(counts);
      addToast({ title: `${storesText(counts?.scheduled ?? 0)} scheduled to move.` });
    } catch (err) {
      const message = billingFailureCopy(err);
      if (message) {
        if (isUserInputError(err)) setError(message);
        else toastError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>Migrate stores on {planVersionLabel(plan)}</ModalHeader>
        <ModalBody>
          {result ? (
            <div className="flex flex-col gap-2 text-body text-fg" role="status">
              <p>{storesText(result.scheduled)} scheduled to move{target ? ` to ${planVersionLabel(target)}` : ""}.</p>
              {result.deferredForNotice > 0 ? (
                <p className="text-fg-muted">
                  {storesText(result.deferredForNotice)} renew sooner than the notice, so they move at the renewal after.
                </p>
              ) : null}
              {result.alreadyScheduled > 0 ? (
                <p className="text-fg-muted">{storesText(result.alreadyScheduled)} were already scheduled; nothing changed for them.</p>
              ) : null}
              <p className="text-fg-muted">Each store is emailed the change. Running this again changes nothing.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-body text-fg-muted">
                {storesText(subscribers)} on this version move at their first renewal at least the notice period away,
                with an invoice at the new price. Until then they keep their current price.
              </p>
              <Select
                label="Move them to"
                selectedKeys={targetId ? new Set([targetId]) : new Set()}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") setTargetId(value);
                }}
              >
                {options.map((option) => (
                  <SelectItem key={option.id}>{planVersionLabel(option)}</SelectItem>
                ))}
              </Select>
              <Input
                label="Notice (days)"
                type="number"
                min={0}
                max={365}
                value={notice}
                onValueChange={setNotice}
                description="Stores renewing sooner move at the renewal after."
                isInvalid={!!error}
                errorMessage={error ?? undefined}
              />
              {targetId && previewNotice !== null ? (
                <section aria-label="What the move would do" aria-live="polite" className="rounded-card border border-line p-3 text-body">
                  {preview.loading ? (
                    <p className="text-fg-muted">Counting the stores…</p>
                  ) : dryRun ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-fg">{storesText(dryRun.scheduled)} would be scheduled to move.</p>
                      {dryRun.deferredForNotice > 0 ? (
                        <p className="text-fg-muted">
                          {storesText(dryRun.deferredForNotice)} of them renew sooner than the notice and would move at the renewal after.
                        </p>
                      ) : null}
                      {dryRun.alreadyScheduled > 0 ? (
                        <p className="text-fg-muted">{storesText(dryRun.alreadyScheduled)} already scheduled; unchanged.</p>
                      ) : null}
                    </div>
                  ) : preview.error ? (
                    <p className="text-tone-danger-text" role="alert">
                      {billingFailureCopy(preview.error) ?? "Couldn't count the stores this would move."}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {result ? (
            <UiButton variant="primary" onPress={onClose}>
              Done
            </UiButton>
          ) : (
            <>
              <UiButton variant="ghost" onPress={onClose} isDisabled={busy}>
                Cancel
              </UiButton>
              <UiButton
                variant="primary"
                isLoading={busy}
                isDisabled={busy || options.length === 0 || subscribers === 0}
                onPress={() => void run()}
              >
                Schedule the move
              </UiButton>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
