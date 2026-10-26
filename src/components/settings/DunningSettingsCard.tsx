/**
 * Settings › Billing rules › Overdue payments (PRD-016 FR-16, FR-26)
 *
 * The dunning timings: orders pause N days after a store goes past due,
 * the store is suspended M days after, and a trial-ended store K days
 * after the trial. Switching dunning on is gated (D6/D7: a lawyer must
 * confirm the timeline and the merchant terms must publish it; D9 also
 * waits for in-dashboard payment and restricted admin mode): the switch is
 * locked while dunning is off and the console never sends `enabled: true`.
 * It can only switch a running dunning off.
 */

import { addToast } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  canToggleDunning,
  DUNNING_GATE_COPY,
  dunningToDraft,
  validateDunningDraft,
  type DunningDraft,
  type DunningErrors,
} from "../../lib/platform-billing.util";
import { billingFailureCopy, isUserInputError } from "../../lib/mutation-errors";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import type { PlatformDunningSettings } from "../../types/platform-api";
import {
  Button as UiButton,
  Card,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
  toastError,
} from "../ui";

export interface DunningSettingsCardProps {
  /** True without settings:manage. */
  readOnly: boolean;
}

/** Shown until the server answers (the server's own defaults, PRD-016 Q6/Q7). */
const FALLBACK_DUNNING: PlatformDunningSettings = {
  enabled: false,
  pauseOrdersAfterDays: 7,
  suspendAfterDays: 21,
  trialSuspendAfterDays: 14,
};

export function DunningSettingsCard({ readOnly }: DunningSettingsCardProps) {
  const { settings, loading, updateSettingsPatch } = usePlatformSettings();
  const saved = useMemo(() => settings.dunning ?? FALLBACK_DUNNING, [settings.dunning]);
  const [draft, setDraft] = useState<DunningDraft>(() => dunningToDraft(saved));
  const [errors, setErrors] = useState<DunningErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setDraft(dunningToDraft(saved));
    setErrors({});
  }, [saved]);

  const dirty = useMemo(() => {
    const current = dunningToDraft(saved);
    return (Object.keys(current) as (keyof DunningDraft)[]).some((key) => current[key] !== draft[key]);
  }, [draft, saved]);

  const toggleAllowed = !readOnly && canToggleDunning(saved);
  const disabled = readOnly || loading;

  const review = () => {
    const result = validateDunningDraft(draft, saved);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setConfirming(true);
  };

  const save = async () => {
    const result = validateDunningDraft(draft, saved);
    if (!result.patch || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await updateSettingsPatch({ dunning: result.patch });
      addToast({ title: "Overdue payment rules saved." });
      setConfirming(false);
    } catch (error) {
      const message = billingFailureCopy(error);
      if (message && isUserInputError(error)) {
        setConfirming(false);
        setErrors({ suspendAfterDays: message });
      } else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const field = (key: keyof DunningErrors, label: string, description: string) => (
    <Input
      label={label}
      type="number"
      min={0}
      max={365}
      value={draft[key]}
      onValueChange={(value) => setDraft({ ...draft, [key]: value })}
      isDisabled={disabled}
      isInvalid={!!errors[key]}
      errorMessage={errors[key]}
      description={description}
    />
  );

  return (
    <Card
      title="Overdue payments"
      description="What happens to a store that doesn't pay: orders pause first, then the store is suspended."
      actions={<Chip tone={saved.enabled ? "warning" : "neutral"}>{saved.enabled ? "On" : "Off"}</Chip>}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-line bg-surface-muted p-3" role="note">
          <p className="text-body font-medium text-fg">Switch-on gated: legal timeline must be confirmed (PRD-016 D6/D7)</p>
          <p className="mt-1 text-label text-fg-muted">{DUNNING_GATE_COPY}</p>
        </div>

        <div className="flex flex-col gap-1">
          <Switch
            isSelected={draft.enabled}
            isDisabled={!toggleAllowed}
            onValueChange={(on) => setDraft({ ...draft, enabled: on })}
          >
            Pause orders and suspend stores automatically
          </Switch>
          <p className="text-caption text-fg-muted">
            {saved.enabled
              ? "Dunning is on. You can switch it off here; switching it back on waits for the same gate."
              : "Locked off until the gate above is met. The timings below take effect only when dunning is switched on."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {field("pauseOrdersAfterDays", "Pause orders after (days)", "Days after the store goes past due.")}
          {field("suspendAfterDays", "Suspend after (days)", "Days after it goes past due; on or after the pause.")}
          {field("trialSuspendAfterDays", "Suspend after trial (days)", "Days after an unpaid trial ends.")}
        </div>

        {readOnly ? (
          <p className="text-label text-fg-muted">Only a platform owner can change these rules.</p>
        ) : (
          <div className="flex justify-end">
            <UiButton variant="secondary" isDisabled={!dirty || loading} onPress={review}>
              Save overdue rules
            </UiButton>
          </div>
        )}
      </div>

      <Modal isOpen={confirming} onClose={() => setConfirming(false)} width="sm">
        <ModalContent>
          <ModalHeader>{saved.enabled && !draft.enabled ? "Switch dunning off?" : "Save the overdue timings?"}</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">
              {saved.enabled && !draft.enabled
                ? "Stores are no longer paused or suspended automatically. Stores already paused stay paused until they pay or you reactivate them."
                : `Orders pause ${draft.pauseOrdersAfterDays} days and stores are suspended ${draft.suspendAfterDays} days after a payment is overdue; an unpaid trial is suspended ${draft.trialSuspendAfterDays} days after it ends.${
                    saved.enabled ? "" : " Nothing happens while dunning is off."
                  }`}
            </p>
            <p className="mt-2 text-body text-fg-muted">Your name and the before and after values go to the audit log.</p>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setConfirming(false)} isDisabled={busy}>
              Cancel
            </UiButton>
            <UiButton variant="primary" isLoading={busy} isDisabled={busy} onPress={() => void save()}>
              Save
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
