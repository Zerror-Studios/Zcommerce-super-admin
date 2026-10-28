import { addToast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { PlatformPaymentProvider, PlatformSettings } from "../../types";
import { useMessagingStatus } from "../../hooks/use-messaging-status";
import { channelAvailability } from "../../lib/messaging-channels.util";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { canEditPlatformSettings } from "../../lib/platformSettings";
import { useAuth } from "../../providers/AuthProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { toasts } from "../../copy";
import { DunningSettingsCard } from "./DunningSettingsCard";
import { EntitlementsModeCard } from "./EntitlementsModeCard";
import { PlatformJobsCard } from "./PlatformJobsCard";
import {
  Button as UiButton,
  Card,
  Chip,
  ErrorState,
  Input,
  Select,
  SelectItem,
  Textarea,
  toastError,
} from "../ui";
import { ReminderChannelList } from "./ReminderChannelList";

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

/** The cards of the platform settings form; Settings shows them in separate sections (docs/design/09 §1.7). */
export type BillingRulesCard = "grace" | "provider" | "health" | "reminders" | "entitlements" | "dunning" | "jobs";

const ALL_CARDS: BillingRulesCard[] = ["grace", "provider", "health", "reminders", "entitlements", "dunning", "jobs"];

export interface BillingRulesSettingsProps {
  /** Which cards this section shows. Save still sends the whole settings object; cards not shown keep the server values. */
  cards?: BillingRulesCard[];
}

/** Settings › Billing (PRD-005 FR-7.1): grace period, payment provider, health thresholds, reminder schedule. */
export function BillingRulesSettings({ cards = ALL_CARDS }: BillingRulesSettingsProps) {
  const show = (card: BillingRulesCard) => cards.includes(card);
  const { settings, loading, error: loadError, retry, updateSettings } = usePlatformSettings();
  const { can } = useAuth();
  // settings:manage is owner-only; others see the rules read-only (review C-M5).
  const readOnly = !can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);
  // PRD-024 FR-1.1: nothing is editable until the server copy has loaded.
  const disabled = !canEditPlatformSettings({ loaded: !loading, readOnly });
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [before, setBefore] = useState(settings.reminders.daysBeforeDue.join(", "));
  const [after, setAfter] = useState(settings.reminders.daysAfterDue.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PRD-024 FR-4.2.5: SMS and WhatsApp only when the backend has the MSG91 names.
  const messaging = useMessagingStatus();
  const smsChannel = channelAvailability("SMS", messaging);
  const whatsappChannel = channelAvailability("WHATSAPP", messaging);

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

  // PRD-024 FR-1.1 (D-01): a failed load shows an error with Retry instead
  // of the defaults, so Save can never overwrite the server's settings.
  if (loadError) {
    return (
      <div className="flex max-w-content-form flex-col gap-4">
        <Card>
          <ErrorState
            title="Couldn't load the platform settings."
            description="Nothing can be changed until they load, so the saved rules aren't replaced by defaults."
            onRetry={retry}
          />
        </Card>
        {readOnly || !show("jobs") ? null : <PlatformJobsCard />}
      </div>
    );
  }

  return (
    <div className="flex max-w-content-form flex-col gap-4">
      {show("grace") ? (
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
      ) : null}

      {show("provider") ? (
      <Card title="Payment provider" description="How stores pay Zcom. Secrets live in the server environment; this only picks which provider is live.">
        <div className="flex flex-col gap-3">
          <Select
            label="Provider"
            selectedKeys={new Set([draft.billing?.provider ?? "MANUAL"])}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (typeof value === "string") {
                setDraft({
                  ...draft,
                  billing: {
                    ...draft.billing,
                    provider: value as PlatformPaymentProvider,
                    configured: draft.billing?.configured ?? false,
                    checkoutAvailable: draft.billing?.checkoutAvailable ?? false,
                  },
                });
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
          {/* PRD-014 FR-2.4: the server says whether the saved provider has an online checkout here. */}
          {draft.billing && draft.billing.provider !== "MANUAL" ? (
            settings.billing?.provider === draft.billing.provider ? (
              <Chip tone={settings.billing.checkoutAvailable ? "success" : "warning"}>
                {settings.billing.checkoutAvailable
                  ? "Online checkout available: stores can pay their invoices online"
                  : "No online checkout for this provider here: stores can't pay online, so record their payments in the console"}
              </Chip>
            ) : (
              <Chip tone="neutral">Save to check whether stores can pay this provider online</Chip>
            )
          ) : null}
          {/* PRD-017 FR-3.2: shown on the store's Billing page (dashboard). */}
          <Textarea
            label="Bank transfer instructions"
            description="Shown to stores when they can't pay online, or as another way to pay. Account name, number, IFSC, UPI ID."
            value={draft.billing?.bankTransferInstructions ?? ""}
            onValueChange={(value) => {
              if (draft.billing) setDraft({ ...draft, billing: { ...draft.billing, bankTransferInstructions: value } });
            }}
            maxLength={2000}
            isDisabled={disabled}
          />
          <Input
            label="Billing support contact"
            description="An email or phone stores can reach about invoices. Shown on their Billing page."
            value={draft.billing?.supportContact ?? ""}
            onValueChange={(value) => {
              if (draft.billing) setDraft({ ...draft, billing: { ...draft.billing, supportContact: value } });
            }}
            maxLength={200}
            isDisabled={disabled}
            className="max-w-md"
          />
        </div>
      </Card>
      ) : null}

      {show("health") ? (
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
      ) : null}

      {show("reminders") ? (
      <Card title="Renewal reminders" description="Days before and after the renewal date, comma-separated. Channels apply to every reminder.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Days before due" placeholder="7, 3, 1" value={before} onValueChange={setBefore} isDisabled={disabled} />
            <Input label="Days after due" placeholder="1, 3, 7" value={after} onValueChange={setAfter} isDisabled={disabled} />
          </div>
          {/* PRD-024 FR-4.2.5: SMS and WhatsApp go through the platform MSG91 account; a channel the backend
              can't deliver stays visible but disabled, with the reason. */}
          <div>
            <p className="mb-2 text-label font-medium text-fg">Send through</p>
            <ReminderChannelList
              selection={draft.reminders}
              onChange={(channel, on) => setDraft({ ...draft, reminders: { ...draft.reminders, [channel]: on } })}
              sms={smsChannel}
              whatsapp={whatsappChannel}
              isDisabled={disabled}
            />
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
      ) : null}

      {readOnly ? (
        <p className="text-label text-fg-muted">Only a platform owner can change these rules.</p>
      ) : (
        <div className="flex justify-end">
          <UiButton variant="primary" isLoading={busy} isDisabled={disabled} onPress={() => void save()}>
            Save changes
          </UiButton>
        </div>
      )}

      {/* PRD-016 FR-14, FR-16: saved on their own, each behind a confirmation. */}
      {show("entitlements") ? <EntitlementsModeCard readOnly={readOnly} /> : null}
      {show("dunning") ? <DunningSettingsCard readOnly={readOnly} /> : null}

      {/* PRD-014 PLT-13: the nightly jobs on demand (settings:manage). */}
      {readOnly || !show("jobs") ? null : <PlatformJobsCard />}
    </div>
  );
}
