import { addToast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { PlatformPaymentProvider, PlatformSettings } from "../../types";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { toasts } from "../../copy";
import { Button as UiButton, Card, Chip, Input, Select, SelectItem, Switch, Textarea, toastError } from "../ui";

/** ADR-002 amendment: the provider is a setting; Razorpay is next, Nimbbl stays available. */
const PROVIDERS: { key: PlatformPaymentProvider; label: string; hint: string }[] = [
  { key: "MANUAL", label: "Manual (bank transfer / UPI)", hint: "Staff record payments in the console." },
  { key: "RAZORPAY", label: "Razorpay", hint: "Webhooks settle invoices automatically once the secret is set." },
  { key: "NIMBBL", label: "Nimbbl", hint: "Webhooks settle invoices automatically once the secret is set." },
];

function parseDays(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((part) => Number(part))
    .filter((day) => Number.isInteger(day) && day > 0);
}

/** Settings › Billing rules (PRD-005 FR-7.1): grace period, health thresholds, reminder schedule. */
export function BillingRulesSettings() {
  const { settings, loading, updateSettings } = usePlatformSettings();
  const { can } = useAuth();
  // settings:manage is owner-only; others see the rules read-only (review C-M5).
  const readOnly = !can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);
  const disabled = loading || readOnly;
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [before, setBefore] = useState(settings.reminders.daysBeforeDue.join(", "));
  const [after, setAfter] = useState(settings.reminders.daysAfterDue.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
    setBefore(settings.reminders.daysBeforeDue.join(", "));
    setAfter(settings.reminders.daysAfterDue.join(", "));
  }, [settings]);

  const number = (value: string) => Math.max(0, Math.floor(Number(value) || 0));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateSettings({
        ...draft,
        reminders: { ...draft.reminders, daysBeforeDue: parseDays(before), daysAfterDue: parseDays(after) },
      });
      addToast({ title: toasts.changesSaved });
    } catch (err) {
      const message = mutationFailureCopy(err);
      if (message && isUserInputError(err)) setError(message);
      else if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-content-form flex-col gap-4">
      <Card title="Grace period" description="Days after a renewal passes unpaid before the store counts as past its grace period. Stores can override it.">
        <Input
          label="Default grace period (days)"
          type="number"
          min={0}
          max={365}
          value={String(draft.gracePeriodDays)}
          onValueChange={(value) => setDraft({ ...draft, gracePeriodDays: number(value) })}
          isDisabled={disabled}
          className="max-w-xs"
        />
      </Card>

      <Card title="Payment provider" description="How stores pay Zcommerce. Secrets live in the server environment; this only picks which provider is live.">
        <div className="flex flex-col gap-3">
          <Select
            label="Provider"
            selectedKeys={new Set([draft.billing?.provider ?? "MANUAL"])}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (typeof value === "string") {
                setDraft({ ...draft, billing: { provider: value as PlatformPaymentProvider, configured: draft.billing?.configured ?? false } });
              }
            }}
            disallowEmptySelection
            isDisabled={disabled}
            className="max-w-xs"
          >
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider.key} description={provider.hint}>
                {provider.label}
              </SelectItem>
            ))}
          </Select>
          {draft.billing && draft.billing.provider !== "MANUAL" ? (
            <Chip tone={settings.billing?.configured && settings.billing.provider === draft.billing.provider ? "success" : "warning"}>
              {settings.billing?.configured && settings.billing.provider === draft.billing.provider
                ? "Webhook secret configured"
                : "Webhook secret not set on the server; webhooks will be rejected"}
            </Chip>
          ) : null}
        </div>
      </Card>

      <Card title="Health thresholds" description="When Collections flags a store as at risk.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Renewal within (days)"
            type="number"
            min={0}
            value={String(draft.health.expiringWithinDays)}
            onValueChange={(value) => setDraft({ ...draft, health: { ...draft.health, expiringWithinDays: number(value) } })}
            isDisabled={disabled}
          />
          <Input
            label="Inactive after (days)"
            type="number"
            min={0}
            value={String(draft.health.inactiveAfterDays)}
            onValueChange={(value) => setDraft({ ...draft, health: { ...draft.health, inactiveAfterDays: number(value) } })}
            isDisabled={disabled}
          />
        </div>
      </Card>

      <Card title="Renewal reminders" description="Days before and after the renewal date, comma-separated. Channels apply to every reminder.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Days before due" placeholder="7, 3, 1" value={before} onValueChange={setBefore} isDisabled={disabled} />
            <Input label="Days after due" placeholder="1, 3, 7" value={after} onValueChange={setAfter} isDisabled={disabled} />
          </div>
          <div className="flex flex-wrap gap-6">
            <Switch isSelected={draft.reminders.email} onValueChange={(on) => setDraft({ ...draft, reminders: { ...draft.reminders, email: on } })}>
              Email
            </Switch>
            <Switch isSelected={draft.reminders.sms} onValueChange={(on) => setDraft({ ...draft, reminders: { ...draft.reminders, sms: on } })}>
              SMS
            </Switch>
            <Switch isSelected={draft.reminders.whatsapp} onValueChange={(on) => setDraft({ ...draft, reminders: { ...draft.reminders, whatsapp: on } })}>
              WhatsApp
            </Switch>
          </div>
          <Textarea
            label="Reminder text"
            description="Placeholders: {{ownerName}}, {{storeName}}, {{plan}}, {{renewalDate}}, {{days}}"
            value={draft.reminders.template ?? ""}
            onValueChange={(value) => setDraft({ ...draft, reminders: { ...draft.reminders, template: value } })}
            isDisabled={disabled}
            isInvalid={!!error}
            errorMessage={error ?? undefined}
          />
        </div>
      </Card>

      {readOnly ? (
        <p className="text-label text-fg-muted">Only a platform owner can change these rules.</p>
      ) : (
        <div className="flex justify-end">
          <UiButton variant="primary" isLoading={busy} isDisabled={disabled} onPress={() => void save()}>
            Save changes
          </UiButton>
        </div>
      )}
    </div>
  );
}
