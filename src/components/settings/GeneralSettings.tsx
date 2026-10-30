/**
 * Settings › General (04 S-07c): Store health (the two health thresholds, saved with the save bar) and the
 * read-only Keyboard shortcuts list (#shortcuts). Adding ⌘J to the list waits for Check first 05 #25.
 */
import { addToast } from "@heroui/react";
import { useEffect, useState } from "react";
import { toasts } from "../../copy";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { ShortcutsList } from "../layout/AppShell";
import { Card, ErrorState, FieldGrid, Input, toastError } from "../ui";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { dayError, toDraftNumber } from "./settings-form.util";

const RENEWAL_RANGE = { min: 1, max: 60 };
const INACTIVE_RANGE = { min: 1, max: 180 };

export function GeneralSettings() {
  const { settings, loading, error: loadError, retry, updateSettings } = usePlatformSettings();
  const { can } = useAuth();
  const readOnly = !can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);
  const [renewal, setRenewal] = useState(toDraftNumber(settings.health.expiringWithinDays));
  const [inactive, setInactive] = useState(toDraftNumber(settings.health.inactiveAfterDays));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setRenewal(toDraftNumber(settings.health.expiringWithinDays));
    setInactive(toDraftNumber(settings.health.inactiveAfterDays));
  }, [settings.health.expiringWithinDays, settings.health.inactiveAfterDays]);

  const renewalError = dayError(renewal, RENEWAL_RANGE);
  const inactiveError = dayError(inactive, INACTIVE_RANGE);
  const dirtyCount =
    Number(renewal !== toDraftNumber(settings.health.expiringWithinDays)) +
    Number(inactive !== toDraftNumber(settings.health.inactiveAfterDays));
  const errorCount = showErrors ? Number(!!renewalError) + Number(!!inactiveError) : 0;
  const disabled = readOnly || loading || busy;

  const discard = () => {
    setRenewal(toDraftNumber(settings.health.expiringWithinDays));
    setInactive(toDraftNumber(settings.health.inactiveAfterDays));
    setShowErrors(false);
    setServerError(null);
  };

  const save = async () => {
    setShowErrors(true);
    if (renewalError || inactiveError) return;
    setBusy(true);
    setServerError(null);
    try {
      await updateSettings({
        ...settings,
        health: { expiringWithinDays: Number(renewal), inactiveAfterDays: Number(inactive) },
      });
      setShowErrors(false);
      addToast({ title: toasts.changesSaved });
    } catch (err) {
      const message = mutationFailureCopy(err);
      if (message && isUserInputError(err)) setServerError(message);
      else if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SettingsSectionHeader section="general" />
      <div className="flex flex-col gap-4">
        {loadError ? (
          <Card>
            <ErrorState
              title="Couldn't load the platform settings."
              description="Nothing can be changed until they load, so the saved values aren't replaced by defaults."
              onRetry={retry}
            />
          </Card>
        ) : (
          <Card title="Store health" description="When Subscriptions flags a store.">
            <FieldGrid>
              <Input
                id="health-renewal"
                label="Flag a store at risk when its renewal is within"
                type="number"
                min={RENEWAL_RANGE.min}
                max={RENEWAL_RANGE.max}
                value={renewal}
                onValueChange={setRenewal}
                endContent={<span className="text-label text-fg-subtle">days</span>}
                classNames={{ input: "num" }}
                isDisabled={disabled}
                isInvalid={showErrors && !!renewalError}
                errorMessage={renewalError ?? undefined}
              />
              <Input
                id="health-inactive"
                label="Flag a store inactive after"
                type="number"
                min={INACTIVE_RANGE.min}
                max={INACTIVE_RANGE.max}
                value={inactive}
                onValueChange={setInactive}
                endContent={<span className="text-label text-fg-subtle">days</span>}
                description="Days without activity."
                classNames={{ input: "num" }}
                isDisabled={disabled}
                isInvalid={(showErrors && !!inactiveError) || !!serverError}
                errorMessage={inactiveError ?? serverError ?? undefined}
              />
            </FieldGrid>
            {readOnly ? <p className="mt-3 text-label text-fg-muted">Only a platform owner can change these.</p> : null}
          </Card>
        )}

        <Card id="shortcuts" data-settings-field title="Keyboard shortcuts" description="Keys for search, the menu and other quick actions.">
          <ShortcutsList />
        </Card>

        {readOnly ? null : (
          <SettingsSaveBar
            isDirty={dirtyCount > 0}
            onDiscard={discard}
            onSave={() => void save()}
            isSaving={busy}
            dirtyCount={dirtyCount}
            errorCount={errorCount}
          />
        )}
      </div>
    </div>
  );
}
