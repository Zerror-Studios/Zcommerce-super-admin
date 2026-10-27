/**
 * Create / edit a plan (PRD-017 FR-1.3, FR-1.4, FR-4.1)
 *
 * Display fields change in place. Price, limits and features of a plan
 * any store uses are locked: saving them creates the next version, which
 * the inline notice says before the save (no modal surprise, §6). Each
 * limit has an explicit "Unlimited" choice (stored as 0, PRD-016 D12). The
 * dialog waits for the server and shows its field errors in place (UX-24).
 * The ZCOM AI section changes in place on this version, for every store on
 * it, and never versions the plan (PRD-017 D14); a LEGACY version opens
 * with only its display fields and AI settings editable.
 * Plan writes need `platform:plans:manage` and two-step verification.
 */

import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { CREATE_PLAN, UPDATE_PLAN } from "../../graphql/plans";
import { PLAN_LABELS, PLAN_NAMES } from "../../lib/display-labels.util";
import { billingFailureCopy } from "../../lib/mutation-errors";
import {
  ANALYTICS_OPTIONS,
  BLOG_SYSTEM_OPTIONS,
  emptyPlanDraft,
  isPlanInUse,
  PLAN_LIMIT_FIELDS,
  planErrorsFromServer,
  planToDraft,
  SUPPORT_OPTIONS,
  toPlanUpdateInput,
  validatePlanDraft,
  versioningNoticeOf,
  type PlanDraft,
  type PlanFormErrors,
} from "../../lib/plan-catalog.util";
import type { PlanName } from "../../types";
import type { PlatformPlan, PlatformPlanUpdateResult } from "../../types/platform-api";
import {
  Button as UiButton,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Textarea,
  toastError,
} from "../ui";

export interface PlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The plan to edit; omitted to create one. */
  plan?: PlatformPlan | null;
  /** Creates a custom plan for this store (store detail, FR-4.2). */
  tenantId?: string | null;
  tenantName?: string;
}

function selectValue(keys: unknown): string | null {
  const value = Array.from(keys as Iterable<unknown>)[0];
  return typeof value === "string" ? value : null;
}

export function PlanEditorModal({ isOpen, onClose, plan, tenantId = null, tenantName }: PlanEditorModalProps) {
  const editing = !!plan;
  const [draft, setDraft] = useState<PlanDraft>(() => (plan ? planToDraft(plan) : emptyPlanDraft(tenantId)));
  const [errors, setErrors] = useState<PlanFormErrors>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [createPlan] = useMutation(CREATE_PLAN, { refetchQueries: ["PlatformPlans"] });
  const [updatePlan] = useMutation<{ updatePlan: PlatformPlanUpdateResult }>(UPDATE_PLAN, {
    refetchQueries: ["PlatformPlans"],
  });

  useEffect(() => {
    if (!isOpen) return;
    setDraft(plan ? planToDraft(plan) : emptyPlanDraft(tenantId));
    setErrors({});
  }, [isOpen, plan, tenantId]);

  const notice = plan ? versioningNoticeOf(plan) : null;
  const isCustom = draft.tenantId != null;
  // A LEGACY version keeps its terms; only display and AI change (D14)
  const termsLocked = plan?.status === "LEGACY";
  const storesOnVersion = plan ? (plan.subscriberCount ?? plan.tenantCount ?? 0) : 0;
  const set = (patch: Partial<PlanDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    const result = validatePlanDraft(draft);
    if (!result.input) {
      setErrors(result.errors);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErrors({});
    try {
      if (plan) {
        const patch = toPlanUpdateInput(plan, result.input);
        if (!patch) {
          onClose();
          return;
        }
        const response = await updatePlan({ variables: { id: plan.id, input: patch } });
        const saved = response.data?.updatePlan;
        addToast({
          title: saved?.versioned
            ? `Saved as version ${saved.plan.version ?? (plan.version ?? 1) + 1}. Stores on version ${plan.version ?? 1} keep it until you migrate them.`
            : "Plan saved.",
        });
      } else {
        await createPlan({ variables: { input: result.input } });
        addToast({ title: result.input.status === "ACTIVE" ? "Plan created and on sale." : "Plan created as a draft." });
      }
      onClose();
    } catch (error) {
      const fieldErrors = planErrorsFromServer(error);
      if (fieldErrors) setErrors(fieldErrors);
      else {
        const message = billingFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} width="lg">
      <ModalContent>
        <ModalHeader>
          {editing
            ? `Edit ${plan?.displayName || PLAN_LABELS[plan!.name]} v${plan?.version ?? 1}`
            : isCustom
              ? `New custom plan${tenantName ? ` for ${tenantName}` : ""}`
              : "New plan"}
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-5">
            {errors.form ? (
              <p className="text-body text-tone-danger-text" role="alert">
                {errors.form}
              </p>
            ) : null}

            {/* Display fields: always editable in place. */}
            <section className="flex flex-col gap-3" aria-label="Shown to stores">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label="Tier"
                  selectedKeys={new Set([draft.name])}
                  onSelectionChange={(keys) => {
                    const value = selectValue(keys);
                    if (value) set({ name: value as PlanName });
                  }}
                  disallowEmptySelection
                  isDisabled={editing}
                  description={editing ? "The tier of a plan can't change." : undefined}
                >
                  {PLAN_NAMES.map((name) => (
                    <SelectItem key={name}>{PLAN_LABELS[name]}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Name stores see"
                  value={draft.displayName}
                  onValueChange={(displayName) => set({ displayName })}
                  isInvalid={!!errors.displayName}
                  errorMessage={errors.displayName}
                />
              </div>
              <Textarea
                label="Description"
                value={draft.description}
                onValueChange={(description) => set({ description })}
                isInvalid={!!errors.description}
                errorMessage={errors.description}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Sort order"
                  type="number"
                  value={draft.sortOrder}
                  onValueChange={(sortOrder) => set({ sortOrder })}
                  isInvalid={!!errors.sortOrder}
                  errorMessage={errors.sortOrder}
                  description="Lower numbers are listed first."
                />
                <div className="flex flex-col justify-center gap-2">
                  {isCustom ? (
                    <p className="text-caption text-fg-muted">A custom plan is never listed to other stores.</p>
                  ) : (
                    <Switch isSelected={draft.isPublic} onValueChange={(isPublic) => set({ isPublic })}>
                      Listed to stores
                    </Switch>
                  )}
                  {!editing || plan?.status === "DRAFT" ? (
                    <Switch
                      isSelected={draft.status === "ACTIVE"}
                      onValueChange={(on) => set({ status: on ? "ACTIVE" : "DRAFT" })}
                    >
                      On sale (active)
                    </Switch>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Commercial terms: locked while stores use the plan (FR-1.4). */}
            {termsLocked ? (
              <p className="rounded-card border border-line bg-surface-muted p-3 text-label text-fg" role="note">
                This is a legacy version: its price, limits and features can't change. You can still edit its
                display fields and its AI settings.
              </p>
            ) : (
            <section className="flex flex-col gap-3" aria-label="Price, limits and features">
              <h3 className="text-label font-semibold text-fg-muted">Price, limits and features</h3>
              {notice ? (
                <p className="rounded-card border border-line bg-surface-muted p-3 text-label text-fg" role="note">
                  {notice}
                </p>
              ) : plan && !isPlanInUse(plan) ? (
                <p className="text-caption text-fg-muted">No store uses this plan, so changes apply to it directly.</p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Monthly price (₹)"
                  type="number"
                  min={0}
                  value={draft.priceMonthly}
                  onValueChange={(priceMonthly) => set({ priceMonthly })}
                  isInvalid={!!errors["price.monthly"]}
                  errorMessage={errors["price.monthly"]}
                />
                <Input
                  label="Yearly price (₹)"
                  type="number"
                  min={0}
                  value={draft.priceYearly}
                  onValueChange={(priceYearly) => set({ priceYearly })}
                  isInvalid={!!errors["price.yearly"]}
                  errorMessage={errors["price.yearly"]}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PLAN_LIMIT_FIELDS.map(({ key, label }) => {
                  const limit = draft.limits[key];
                  const error = errors[`limits.${key}`];
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <Input
                        label={label}
                        type="number"
                        min={1}
                        value={limit.unlimited ? "" : limit.value}
                        placeholder={limit.unlimited ? "Unlimited" : undefined}
                        onValueChange={(value) =>
                          set({ limits: { ...draft.limits, [key]: { unlimited: false, value } } })
                        }
                        isDisabled={limit.unlimited}
                        isInvalid={!!error}
                        errorMessage={error}
                      />
                      <Checkbox
                        isSelected={limit.unlimited}
                        onValueChange={(unlimited) =>
                          set({ limits: { ...draft.limits, [key]: { unlimited, value: unlimited ? "" : limit.value } } })
                        }
                      >
                        Unlimited
                      </Checkbox>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select
                  label="Blog"
                  selectedKeys={new Set([draft.features.blogSystem])}
                  onSelectionChange={(keys) => {
                    const value = selectValue(keys);
                    if (value) set({ features: { ...draft.features, blogSystem: value } });
                  }}
                  disallowEmptySelection
                >
                  {BLOG_SYSTEM_OPTIONS.map((option) => (
                    <SelectItem key={option.key}>{option.label}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Analytics"
                  selectedKeys={new Set([draft.features.analytics])}
                  onSelectionChange={(keys) => {
                    const value = selectValue(keys);
                    if (value) set({ features: { ...draft.features, analytics: value } });
                  }}
                  disallowEmptySelection
                >
                  {ANALYTICS_OPTIONS.map((option) => (
                    <SelectItem key={option.key}>{option.label}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Support"
                  selectedKeys={new Set([draft.features.prioritySupport])}
                  onSelectionChange={(keys) => {
                    const value = selectValue(keys);
                    if (value) set({ features: { ...draft.features, prioritySupport: value } });
                  }}
                  disallowEmptySelection
                >
                  {SUPPORT_OPTIONS.map((option) => (
                    <SelectItem key={option.key}>{option.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(
                  [
                    ["onlineStore", "Online store"],
                    ["lookCreation", "Lookbooks"],
                    ["salesChannels", "Sales channels"],
                    ["unlimitedWebHosting", "Unlimited hosting"],
                    ["sslCertificate", "SSL certificate"],
                  ] as const
                ).map(([key, label]) => (
                  <Switch
                    key={key}
                    isSelected={draft.features[key]}
                    onValueChange={(on) => set({ features: { ...draft.features, [key]: on } })}
                  >
                    {label}
                  </Switch>
                ))}
              </div>
            </section>
            )}

            {/* ZCOM AI: in place, never a new version (PRD-017 D14). */}
            <section className="flex flex-col gap-3" aria-label="ZCOM AI">
              <h3 className="text-label font-semibold text-fg-muted">ZCOM AI</h3>
              <p className="text-caption text-fg-muted">
                {editing && storesOnVersion > 0
                  ? `Changes here apply to the ${storesOnVersion} ${storesOnVersion === 1 ? "store" : "stores"} on this version within a few minutes, without a new version.`
                  : "Changes here apply to this version in place, without a new version."}{" "}
                For one store only, use the AI card on its page.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Switch
                  isSelected={draft.features.aiEnabled}
                  onValueChange={(aiEnabled) => set({ features: { ...draft.features, aiEnabled } })}
                >
                  Ask ZCOM and AI insights
                </Switch>
                <Switch
                  isSelected={draft.features.aiDailySummary}
                  onValueChange={(aiDailySummary) => set({ features: { ...draft.features, aiDailySummary } })}
                  isDisabled={!draft.features.aiEnabled}
                >
                  Daily summary
                </Switch>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  label="Questions per week"
                  type="number"
                  min={0}
                  value={draft.ai.questionsPerWeek}
                  onValueChange={(questionsPerWeek) => set({ ai: { ...draft.ai, questionsPerWeek } })}
                  isDisabled={!draft.features.aiEnabled}
                  isInvalid={!!errors["limits.aiQuestionsPerWeek"]}
                  errorMessage={errors["limits.aiQuestionsPerWeek"]}
                  description="0 = none"
                />
                <Input
                  label="Monthly token budget"
                  type="number"
                  min={0}
                  value={draft.ai.monthlyTokenBudget}
                  onValueChange={(monthlyTokenBudget) => set({ ai: { ...draft.ai, monthlyTokenBudget } })}
                  isDisabled={!draft.features.aiEnabled}
                  isInvalid={!!errors["limits.aiMonthlyTokenBudget"]}
                  errorMessage={errors["limits.aiMonthlyTokenBudget"]}
                  description="0 = none"
                />
                <div className="flex flex-col gap-1">
                  <Input
                    label="Claude connector calls per week"
                    type="number"
                    min={0}
                    value={draft.ai.connectorFairUse ? "" : draft.ai.connectorCallsPerWeek}
                    placeholder={draft.ai.connectorFairUse ? "Fair use" : undefined}
                    onValueChange={(connectorCallsPerWeek) =>
                      set({ ai: { ...draft.ai, connectorFairUse: false, connectorCallsPerWeek } })
                    }
                    isDisabled={!draft.features.aiEnabled || draft.ai.connectorFairUse}
                    isInvalid={!!errors["limits.aiConnectorCallsPerWeek"]}
                    errorMessage={errors["limits.aiConnectorCallsPerWeek"]}
                  />
                  <Checkbox
                    isSelected={draft.ai.connectorFairUse}
                    onValueChange={(connectorFairUse) => set({ ai: { ...draft.ai, connectorFairUse } })}
                    isDisabled={!draft.features.aiEnabled}
                  >
                    Fair use
                  </Checkbox>
                </div>
              </div>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="ghost" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton variant="primary" isLoading={busy} isDisabled={busy} onPress={() => void save()}>
            {editing ? "Save plan" : "Create plan"}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
