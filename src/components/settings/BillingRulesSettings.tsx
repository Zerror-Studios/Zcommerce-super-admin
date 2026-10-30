/**
 * Settings › Payments & billing rules (04 S-07f, PRD-005 FR-7.1, PRD-016 FR-16, PRD-017 FR-3.2, PRD-024)
 *
 * Cards in order: Payment provider (#provider) · Grace period · Renewal reminders · Sent reminders · Overdue
 * payments · What this means · Billing jobs. One save bar for the page: the platform settings go through
 * `updatePlatformSettings` (the whole settings object, so fields not shown keep the server values), the overdue
 * timings as their own patch. Switching overdue payments on stays gated (PRD-016 D6/D7): the switch can only
 * turn a running one off, after a confirmation.
 */
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { toasts } from "../../copy";
import { useMessagingStatus } from "../../hooks/use-messaging-status";
import { channelAvailability, type ChannelAvailability } from "../../lib/messaging-channels.util";
import { billingFailureCopy, isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  DUNNING_GATE_COPY,
  canToggleDunning,
  dunningToDraft,
  validateDunningDraft,
  type DunningDraft,
  type DunningErrors,
} from "../../lib/platform-billing.util";
import { useAuth } from "../../providers/AuthProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import type { PlatformPaymentProvider, PlatformSettings } from "../../types";
import type { PlatformDunningSettings } from "../../types/platform-api";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  FieldGrid,
  IconButton,
  Input,
  Select,
  SelectItem,
  Switch,
  Textarea,
  cx,
  fieldSpanFull,
  toastError,
} from "../ui";
import { IconAdd, IconClose, IconEdit, IconMessages, IconPhone, IconWhatsApp } from "../ui/icons";
import { PlatformJobsCard } from "./PlatformJobsCard";
import { ReminderTextModal } from "./ReminderTextModal";
import { SentRemindersCard } from "./SentRemindersCard";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import {
  MAX_REMINDERS,
  billingRulesSummary,
  dayError,
  reminderRowErrors,
  remindersToRows,
  rowsToReminders,
  toDraftNumber,
  type ReminderRow,
} from "./settings-form.util";

/** ADR-002 amendment: the provider is a setting; Razorpay is next, Nimbbl stays available. */
const PROVIDERS: { key: PlatformPaymentProvider; label: string; hint: string }[] = [
  { key: "MANUAL", label: "Manual (bank transfer / UPI)", hint: "Staff record payments in the console." },
  { key: "RAZORPAY", label: "Razorpay", hint: "Invoices settle automatically once the provider is connected." },
  { key: "NIMBBL", label: "Nimbbl", hint: "Invoices settle automatically once the provider is connected." },
];

const GRACE_RANGE = { min: 0, max: 30 };

/** Shown until the server answers (the server's own defaults, PRD-016 Q6/Q7). */
const FALLBACK_DUNNING: PlatformDunningSettings = {
  enabled: false,
  pauseOrdersAfterDays: 7,
  suspendAfterDays: 21,
  trialSuspendAfterDays: 14,
};

interface Draft {
  provider: PlatformPaymentProvider;
  supportContact: string;
  bankTransferInstructions: string;
  grace: string;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  rows: ReminderRow[];
  template: string;
}

function toDraft(settings: PlatformSettings): Draft {
  return {
    provider: settings.billing?.provider ?? "MANUAL",
    supportContact: settings.billing?.supportContact ?? "",
    bankTransferInstructions: settings.billing?.bankTransferInstructions ?? "",
    grace: toDraftNumber(settings.gracePeriodDays),
    email: settings.reminders.email,
    sms: settings.reminders.sms,
    whatsapp: settings.reminders.whatsapp,
    rows: remindersToRows(settings.reminders.daysBeforeDue, settings.reminders.daysAfterDue),
    template: settings.reminders.template ?? "",
  };
}

const sameRows = (a: ReminderRow[], b: ReminderRow[]) =>
  a.length === b.length && a.every((row, index) => row.days === b[index].days && row.when === b[index].when);

/** The next 15th (the example due date in "What this means"). */
function exampleDueDate(now = new Date()): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + (now.getUTCDate() >= 15 ? 1 : 0);
  return new Date(Date.UTC(year, month, 15));
}

export function BillingRulesSettings() {
  const { settings, loading, error: loadError, retry, updateSettings, updateSettingsPatch } = usePlatformSettings();
  const { can } = useAuth();
  // settings:manage is owner-only; others see the rules read-only (review C-M5).
  const readOnly = !can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);
  const disabled = readOnly || loading;
  const messaging = useMessagingStatus();
  const smsChannel = channelAvailability("SMS", messaging);
  const whatsappChannel = channelAvailability("WHATSAPP", messaging);

  const savedDraft = useMemo(() => toDraft(settings), [settings]);
  const savedDunning = useMemo(() => settings.dunning ?? FALLBACK_DUNNING, [settings.dunning]);
  const [draft, setDraft] = useState<Draft>(savedDraft);
  const [dunning, setDunning] = useState<DunningDraft>(() => dunningToDraft(savedDunning));
  const [dunningErrors, setDunningErrors] = useState<DunningErrors>({});
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(savedDraft), [savedDraft]);
  useEffect(() => {
    setDunning(dunningToDraft(savedDunning));
    setDunningErrors({});
  }, [savedDunning]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  // ─── Changes and errors ────────────────────────────────────────────────────
  const savedDunningDraft = dunningToDraft(savedDunning);
  const settingsChanges = [
    draft.provider !== savedDraft.provider,
    draft.supportContact !== savedDraft.supportContact,
    draft.bankTransferInstructions !== savedDraft.bankTransferInstructions,
    draft.grace !== savedDraft.grace,
    draft.email !== savedDraft.email,
    draft.sms !== savedDraft.sms,
    draft.whatsapp !== savedDraft.whatsapp,
    !sameRows(draft.rows, savedDraft.rows),
    draft.template !== savedDraft.template,
  ].filter(Boolean).length;
  const dunningChanges = (Object.keys(savedDunningDraft) as (keyof DunningDraft)[]).filter(
    (key) => savedDunningDraft[key] !== dunning[key],
  ).length;
  const dirtyCount = settingsChanges + dunningChanges;

  const graceError = dayError(draft.grace, GRACE_RANGE);
  const rowErrors = reminderRowErrors(draft.rows);
  const errorCount = showErrors
    ? Number(!!graceError) + rowErrors.filter(Boolean).length + Object.values(dunningErrors).filter(Boolean).length
    : Object.values(dunningErrors).filter(Boolean).length;

  const discard = () => {
    setDraft(savedDraft);
    setDunning(dunningToDraft(savedDunning));
    setDunningErrors({});
    setShowErrors(false);
    setServerError(null);
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const review = () => {
    setShowErrors(true);
    const dunningResult = dunningChanges ? validateDunningDraft(dunning, savedDunning) : null;
    setDunningErrors(dunningResult?.errors ?? {});
    if (graceError || rowErrors.some(Boolean) || dunningResult?.errors) return;
    if (savedDunning.enabled && !dunning.enabled) setConfirmOff(true);
    else void save();
  };

  const save = async () => {
    setBusy(true);
    setServerError(null);
    try {
      if (settingsChanges) {
        await updateSettings({
          ...settings,
          gracePeriodDays: Number(draft.grace),
          billing: {
            configured: settings.billing?.configured ?? false,
            checkoutAvailable: settings.billing?.checkoutAvailable ?? false,
            provider: draft.provider,
            supportContact: draft.supportContact,
            bankTransferInstructions: draft.bankTransferInstructions,
          },
          reminders: {
            ...rowsToReminders(draft.rows),
            email: draft.email,
            sms: draft.sms,
            whatsapp: draft.whatsapp,
            template: draft.template,
          },
        });
      }
      if (dunningChanges) {
        const result = validateDunningDraft(dunning, savedDunning);
        if (result.patch) {
          try {
            await updateSettingsPatch({ dunning: result.patch });
          } catch (error) {
            const message = billingFailureCopy(error);
            if (message && isUserInputError(error)) {
              setDunningErrors({ suspendAfterDays: message });
              return;
            }
            throw error;
          }
        }
      }
      setShowErrors(false);
      addToast({ title: toasts.changesSaved });
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message && isUserInputError(error)) setServerError(message);
      else if (message) toastError(message);
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loadError) {
    // PRD-024 FR-1.1 (D-01): a failed load shows Retry instead of the defaults, so Save can't overwrite them.
    return (
      <div>
        <SettingsSectionHeader section="billing" />
        <div className="flex flex-col gap-4">
          <Card>
            <ErrorState
              title="Couldn't load the platform settings."
              description="Nothing can be changed until they load, so the saved rules aren't replaced by defaults."
              onRetry={retry}
            />
          </Card>
          {readOnly ? null : <PlatformJobsCard />}
        </div>
      </div>
    );
  }

  const providerChanged = draft.provider !== savedDraft.provider;
  const savedBilling = settings.billing;
  const summary = billingRulesSummary({
    due: exampleDueDate(),
    graceDays: graceError ? 0 : Number(draft.grace),
    rows: draft.rows.filter((_, index) => !rowErrors[index]),
    pauseDays: Number(dunning.pauseOrdersAfterDays) || 0,
    suspendDays: Number(dunning.suspendAfterDays) || 0,
    dunningOn: dunning.enabled,
  });
  const toggleAllowed = !readOnly && canToggleDunning(savedDunning);

  return (
    <div>
      <SettingsSectionHeader section="billing" />
      <div className="flex flex-col gap-4">
        {readOnly ? <p className="text-label text-fg-muted">Only a platform owner can change these rules.</p> : null}
        {serverError ? (
          <p className="text-body text-tone-danger-text" role="alert">
            {serverError}
          </p>
        ) : null}

        {/* ── Payment provider ── */}
        <Card id="provider" data-settings-field title="Payment provider" description="How stores pay Zcom for their plans.">
          <FieldGrid>
            <div className="flex flex-col gap-2">
              <Select
                id="billing-provider"
                label="Provider"
                isRequired
                selectedKeys={new Set([draft.provider])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") set("provider", value as PlatformPaymentProvider);
                }}
                disallowEmptySelection
                isDisabled={disabled}
              >
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.key} description={provider.hint}>
                    {provider.label}
                  </SelectItem>
                ))}
              </Select>
              {/* PRD-014 FR-2.4: whether the saved provider is connected and has an online checkout here. */}
              {draft.provider !== "MANUAL" ? (
                providerChanged ? (
                  <Chip tone="neutral">Save to check this provider</Chip>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone={savedBilling?.configured ? "success" : "warning"}>
                      {savedBilling?.configured ? "Connected" : "Not connected"}
                    </Chip>
                    <Chip tone={savedBilling?.checkoutAvailable ? "success" : "warning"}>
                      {savedBilling?.checkoutAvailable ? "Stores can pay online" : "Stores can't pay online yet"}
                    </Chip>
                  </div>
                )
              ) : null}
            </div>
            <Input
              id="billing-support-contact"
              label="Billing support contact"
              description="An email or phone stores can reach about invoices."
              value={draft.supportContact}
              onValueChange={(value) => set("supportContact", value)}
              maxLength={200}
              isDisabled={disabled}
            />
            <Textarea
              id="billing-bank-instructions"
              className={fieldSpanFull}
              label="Bank transfer instructions"
              description="Shown to stores when they can't pay online. Account name, number, IFSC, UPI ID."
              value={draft.bankTransferInstructions}
              onValueChange={(value) => set("bankTransferInstructions", value)}
              maxLength={2000}
              isDisabled={disabled}
            />
          </FieldGrid>
        </Card>

        {/* ── Grace period ── */}
        <Card title="Grace period">
          <FieldGrid>
            <Input
              id="grace-period"
              label="Default grace period"
              isRequired
              type="number"
              min={GRACE_RANGE.min}
              max={GRACE_RANGE.max}
              value={draft.grace}
              onValueChange={(value) => set("grace", value)}
              endContent={<span className="text-label text-fg-subtle">days</span>}
              classNames={{ input: "num" }}
              isDisabled={disabled}
              isInvalid={showErrors && !!graceError}
              errorMessage={graceError ?? undefined}
            />
            <p className={cx(fieldSpanFull, "-mt-2 text-caption text-fg-muted")}>
              Days after an unpaid renewal before a store counts as overdue. Stores can override it on their Billing &amp; plan page.
            </p>
          </FieldGrid>
        </Card>

        {/* ── Renewal reminders ── */}
        <Card id="reminders" data-settings-field title="Renewal reminders" description="When stores are reminded to pay, and how." padding="none">
          <div className="border-t border-line-subtle px-5 py-4">
            <p className="mb-2 text-label font-medium text-fg">Channels</p>
            <div className="flex flex-wrap gap-x-6 gap-y-3" role="group" aria-label="Reminder channels">
              <ChannelSwitch label="Email" icon={IconMessages} isSelected={draft.email} onChange={(on) => set("email", on)} isDisabled={disabled} />
              <ChannelSwitch label="SMS" icon={IconPhone} isSelected={draft.sms} onChange={(on) => set("sms", on)} isDisabled={disabled} availability={smsChannel} />
              <ChannelSwitch
                label="WhatsApp"
                icon={IconWhatsApp}
                isSelected={draft.whatsapp}
                onChange={(on) => set("whatsapp", on)}
                isDisabled={disabled}
                availability={whatsappChannel}
              />
            </div>
            <p className="mt-2 text-caption text-fg-muted">SMS and WhatsApp go to the owner's phone.</p>
          </div>

          <ul className="border-t border-line-subtle">
            {draft.rows.map((row, index) => (
              <li key={index} className="flex min-h-18 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle px-5 py-3">
                <span className="w-24 shrink-0 text-body font-medium text-fg">Reminder {index + 1}</span>
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                  <Input
                    aria-label={`Reminder ${index + 1}: days`}
                    size="sm"
                    type="number"
                    min={1}
                    max={365}
                    value={row.days}
                    onValueChange={(value) => set("rows", draft.rows.map((entry, at) => (at === index ? { ...entry, days: value } : entry)))}
                    endContent={<span className="text-label text-fg-subtle">days</span>}
                    className="w-32"
                    classNames={{ input: "num" }}
                    isDisabled={disabled}
                    isInvalid={showErrors && !!rowErrors[index]}
                    errorMessage={rowErrors[index] ?? undefined}
                  />
                  <Select
                    aria-label={`Reminder ${index + 1}: before or after`}
                    size="sm"
                    className="w-52"
                    selectedKeys={new Set([row.when])}
                    disallowEmptySelection
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      if (value === "before" || value === "after") {
                        set("rows", draft.rows.map((entry, at) => (at === index ? { ...entry, when: value } : entry)));
                      }
                    }}
                    isDisabled={disabled}
                  >
                    <SelectItem key="before">before the due date</SelectItem>
                    <SelectItem key="after">after the due date</SelectItem>
                  </Select>
                </div>
                {disabled ? null : (
                  <IconButton
                    aria-label={`Remove reminder ${index + 1}`}
                    size="sm"
                    onPress={() => set("rows", draft.rows.filter((_, at) => at !== index))}
                  >
                    <IconClose aria-hidden />
                  </IconButton>
                )}
              </li>
            ))}
            {draft.rows.length === 0 ? <li className="border-b border-line-subtle px-5 py-4 text-body text-fg-muted">No reminders are sent.</li> : null}
          </ul>
          <div className="flex flex-col gap-3 px-5 py-4">
            {draft.rows.length < MAX_REMINDERS && !disabled ? (
              <div>
                <Button
                  variant="tertiary"
                  size="sm"
                  startIcon={<IconAdd aria-hidden />}
                  onPress={() => set("rows", [...draft.rows, { days: "3", when: "after" }])}
                >
                  Add reminder
                </Button>
              </div>
            ) : null}
            <div id="reminder-text" data-settings-field className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-body font-medium text-fg">Reminder text</p>
                <p className="truncate text-label text-fg-muted">{draft.template.split("\n")[0] || "No text yet"}</p>
              </div>
              {disabled ? null : (
                <Button variant="secondary" size="sm" startIcon={<IconEdit aria-hidden />} onPress={() => setTextOpen(true)}>
                  Edit text
                </Button>
              )}
            </div>
          </div>
        </Card>

        <SentRemindersCard />

        {/* ── Overdue payments ── */}
        <Card
          id="overdue"
          data-settings-field
          title="Overdue payments"
          description="What happens to a store that doesn't pay: orders pause first, then the store is suspended."
          actions={<Chip tone={savedDunning.enabled ? "warning" : "neutral"}>{savedDunning.enabled ? "On" : "Off"}</Chip>}
        >
          <div className="flex flex-col gap-4">
            {savedDunning.enabled ? null : (
              <div className="rounded-xl border border-line bg-surface-muted p-3" role="note">
                <p className="text-label text-fg-muted">{DUNNING_GATE_COPY}</p>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-body font-medium text-fg">Pause orders and suspend stores automatically</p>
                <p className="text-label text-fg-muted">
                  {savedDunning.enabled
                    ? "On. You can switch it off here; switching it back on waits for the same check."
                    : "Locked off for now. The timings below take effect once it's on."}
                </p>
              </div>
              <Switch
                aria-label="Pause orders and suspend stores automatically"
                isSelected={dunning.enabled}
                isDisabled={!toggleAllowed || loading}
                onValueChange={(on) => setDunning((current) => ({ ...current, enabled: on }))}
              />
            </div>
            <FieldGrid>
              <DunningField
                id="dunning-pause"
                label="Pause orders after"
                description="Days after the grace period ends."
                value={dunning.pauseOrdersAfterDays}
                error={dunningErrors.pauseOrdersAfterDays}
                onChange={(value) => setDunning((current) => ({ ...current, pauseOrdersAfterDays: value }))}
                isDisabled={disabled}
              />
              <DunningField
                id="dunning-suspend"
                label="Suspend after"
                description="Days after the grace period ends; on or after the pause."
                value={dunning.suspendAfterDays}
                error={dunningErrors.suspendAfterDays}
                onChange={(value) => setDunning((current) => ({ ...current, suspendAfterDays: value }))}
                isDisabled={disabled}
              />
              <DunningField
                id="dunning-trial"
                label="Suspend an unpaid trial after"
                description="Days after the trial ends."
                value={dunning.trialSuspendAfterDays}
                error={dunningErrors.trialSuspendAfterDays}
                onChange={(value) => setDunning((current) => ({ ...current, trialSuspendAfterDays: value }))}
                isDisabled={disabled}
              />
            </FieldGrid>
          </div>
        </Card>

        {/* ── What this means ── */}
        <Card title="What this means">
          <p className="text-body text-fg" aria-live="polite">
            {summary}
          </p>
        </Card>

        {readOnly ? null : <PlatformJobsCard />}

        {readOnly ? null : (
          <SettingsSaveBar
            isDirty={dirtyCount > 0}
            onDiscard={discard}
            onSave={review}
            isSaving={busy}
            dirtyCount={dirtyCount}
            errorCount={errorCount}
          />
        )}
      </div>

      <ReminderTextModal isOpen={textOpen} text={draft.template} onClose={() => setTextOpen(false)} onApply={(text) => set("template", text)} />
      <ConfirmModal
        isOpen={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => void save()}
        title="Switch automatic pausing off?"
        description="Stores are no longer paused or suspended automatically. Stores already paused stay paused until they pay or you reactivate them."
        confirmLabel="Switch off"
        confirmColor="danger"
      />
    </div>
  );
}

function DunningField({
  id,
  label,
  description,
  value,
  error,
  onChange,
  isDisabled,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  isDisabled: boolean;
}) {
  return (
    <Input
      id={id}
      label={label}
      type="number"
      min={0}
      max={365}
      value={value}
      onValueChange={onChange}
      endContent={<span className="text-label text-fg-subtle">days</span>}
      description={description}
      classNames={{ input: "num" }}
      isDisabled={isDisabled}
      isInvalid={!!error}
      errorMessage={error}
    />
  );
}

/** A channel switch; a channel the platform can't deliver stays visible, disabled, with "Not set up". */
function ChannelSwitch({
  label,
  icon: Icon,
  isSelected,
  onChange,
  isDisabled,
  availability,
}: {
  label: string;
  icon: typeof IconMessages;
  isSelected: boolean;
  onChange: (on: boolean) => void;
  isDisabled: boolean;
  availability?: ChannelAvailability;
}) {
  const available = availability?.isConfigured ?? true;
  return (
    <div className="flex items-center gap-2">
      <Switch aria-label={`Send by ${label}`} isSelected={available && isSelected} onValueChange={onChange} isDisabled={isDisabled || !available} />
      <Icon aria-hidden className={cx("size-4", available ? "text-fg-muted" : "text-fg-subtle")} />
      <span className={cx("text-body", available ? "text-fg" : "text-fg-muted")}>{label}</span>
      {available ? null : <Chip tone="neutral">Not set up</Chip>}
    </div>
  );
}
