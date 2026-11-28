/**
 * Console › Messaging › Rates (backend PRD-050 FR-1.11, FR-1.1): what each
 * message costs a store, per channel and purpose, typed in rupees and sent
 * as integer paise; a changed rate is a new version (shown). Also the
 * add_client API switch, which stays off until MSG91 confirms the API in
 * writing (FR-0.2). D21: the hourly email limit of Zerror's parent account
 * (the shared address; every store shares it) and marketing's share of
 * every account's hour. Backend PRD-051 FR-11 (D13 Q2): WhatsApp is charged
 * by the template's Meta category (Marketing ₹0.95, Utility ₹0.15,
 * Authentication ₹0.15, Service free by default); its old per-purpose row is
 * history and no longer shown. W3 (FR-11, Q6): the WhatsApp number's
 * monthly fee, passed through at cost from each store's message balance
 * (0 = not charged), and under it the month's number fees (charged or due).
 * Saving needs platform:messaging:manage.
 */
import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  Skeleton,
  Switch,
  formatCount,
  formatDateTime,
  toast,
  toastError,
} from "../ui";
import { IconWarning } from "../ui/icons";
import { WhatsAppNumberFeesCard } from "./WhatsAppNumberFeesCard";
import { toasts } from "../../copy";
import { PLATFORM_MESSAGING_SETTINGS, UPDATE_PLATFORM_MESSAGING_SETTINGS } from "../../graphql/messaging";
import {
  CHANNEL_LABEL,
  MESSAGING_CHANNELS,
  MESSAGING_PURPOSES,
  PURPOSE_LABEL,
  hourlyLimitError,
  marketingPerHour,
  marketingShareError,
  messagingFailureCopy,
  messagingFieldErrorsFromServer,
  numberFeeError,
  paiseToRupees,
  rateFieldKey,
  rupeesToPaise,
  ratesDraftOf,
  ratesInputOf,
  validateRatesDraft,
  validateWhatsAppRatesDraft,
  WHATSAPP_CATEGORIES,
  WHATSAPP_CATEGORY_LABEL,
  whatsAppRateFieldKey,
  whatsAppRatesDraftOf,
  whatsAppRatesInputOf,
  type WhatsAppRateCategory,
  type WhatsAppRatesDraft,
  type MessagingRateChannel,
  type MessagingRatePurpose,
  type MessagingSettings,
  type RatesDraft,
  type RatesErrors,
} from "../../lib/platform-messaging.util";

type SettingsData = { platformMessagingSettings: MessagingSettings };

export function MessagingRatesTab({ canManage }: { canManage: boolean }) {
  const { data, loading, error, refetch } = useQuery<SettingsData>(PLATFORM_MESSAGING_SETTINGS, {
    fetchPolicy: "cache-and-network",
  });
  const settings = data?.platformMessagingSettings;

  if (error && !settings) {
    return <ErrorState title="Couldn't load the messaging rates." description={toasts.genericError} onRetry={() => void refetch()} />;
  }
  if (loading && !settings) {
    return (
      <Card>
        <div role="status" aria-label="Loading the rates" className="space-y-3">
          <Skeleton className="h-5 w-1/3 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </Card>
    );
  }
  if (!settings) return null;
  // A save changes the version and remounts the form from the server's answer.
  return (
    <div className="space-y-4">
      <RatesForm
        key={`${settings.rates.version}-${settings.addClientApiEnabled}-${settings.parentHourlyEmailLimit}-${settings.marketingHourlySharePercent}-${settings.whatsappNumberMonthlyFeePaise}`}
        settings={settings}
        canManage={canManage}
      />
      <WhatsAppNumberFeesCard />
    </div>
  );
}

function RatesForm({ settings, canManage }: { settings: MessagingSettings; canManage: boolean }) {
  const [draft, setDraft] = useState<RatesDraft>(() => ratesDraftOf(settings.rates));
  const [waDraft, setWaDraft] = useState<WhatsAppRatesDraft>(() => whatsAppRatesDraftOf(settings.rates));
  const [addClient, setAddClient] = useState(settings.addClientApiEnabled);
  const [confirmOn, setConfirmOn] = useState(false);
  const [parentLimit, setParentLimit] = useState(String(settings.parentHourlyEmailLimit));
  const [share, setShare] = useState(String(settings.marketingHourlySharePercent));
  const [numberFee, setNumberFee] = useState(paiseToRupees(settings.whatsappNumberMonthlyFeePaise ?? 0));
  const [errors, setErrors] = useState<RatesErrors>({});
  const [save, { loading }] = useMutation<{ updatePlatformMessagingSettings: MessagingSettings }>(UPDATE_PLATFORM_MESSAGING_SETTINGS, {
    // The settings have no id, so the cache can't merge them by itself.
    update(cache, { data: answer }) {
      if (answer) {
        cache.writeQuery({ query: PLATFORM_MESSAGING_SETTINGS, data: { platformMessagingSettings: answer.updatePlatformMessagingSettings } });
      }
    },
  });

  const rates = ratesInputOf(draft, settings.rates);
  const waRates = whatsAppRatesInputOf(waDraft, settings.rates);
  const limitsChanged =
    parentLimit.trim() !== String(settings.parentHourlyEmailLimit) ||
    share.trim() !== String(settings.marketingHourlySharePercent);
  const numberFeePaise = rupeesToPaise(numberFee);
  const numberFeeChanged = numberFeePaise !== (settings.whatsappNumberMonthlyFeePaise ?? 0);
  const dirty =
    rates !== null || waRates !== null || addClient !== settings.addClientApiEnabled || limitsChanged || numberFeeChanged;

  const change = (channel: MessagingRateChannel, purpose: MessagingRatePurpose, value: string) => {
    setDraft((current) => ({ ...current, [channel]: { ...current[channel], [purpose]: value } }));
    setErrors((current) => ({ ...current, [rateFieldKey(channel, purpose)]: undefined, form: undefined }));
  };

  const submit = async () => {
    const found: RatesErrors = {
      ...validateRatesDraft(draft),
      ...validateWhatsAppRatesDraft(waDraft),
      parentHourlyEmailLimit: hourlyLimitError(parentLimit) ?? undefined,
      marketingHourlySharePercent: marketingShareError(share) ?? undefined,
      whatsappNumberMonthlyFeePaise: numberFeeError(numberFee) ?? undefined,
    };
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    const input: {
      rates?: ReturnType<typeof ratesInputOf> & { WHATSAPP_CATEGORY?: ReturnType<typeof whatsAppRatesInputOf> };
      addClientApiEnabled?: boolean;
      parentHourlyEmailLimit?: number;
      marketingHourlySharePercent?: number;
      whatsappNumberMonthlyFeePaise?: number;
    } = {};
    const changedRates = ratesInputOf(draft, settings.rates);
    const changedWhatsApp = whatsAppRatesInputOf(waDraft, settings.rates);
    if (changedRates || changedWhatsApp) {
      input.rates = { ...(changedRates ?? {}), ...(changedWhatsApp ? { WHATSAPP_CATEGORY: changedWhatsApp } : {}) };
    }
    if (addClient !== settings.addClientApiEnabled) input.addClientApiEnabled = addClient;
    if (parentLimit.trim() !== String(settings.parentHourlyEmailLimit)) input.parentHourlyEmailLimit = Number(parentLimit.trim());
    if (share.trim() !== String(settings.marketingHourlySharePercent)) input.marketingHourlySharePercent = Number(share.trim());
    if (numberFeeChanged && numberFeePaise !== null) input.whatsappNumberMonthlyFeePaise = numberFeePaise;
    if (!Object.keys(input).length) return;
    try {
      await save({ variables: { input } });
      toast.success(changedRates || changedWhatsApp ? "Rates saved as a new version" : "Messaging settings saved");
    } catch (failure) {
      const fields = messagingFieldErrorsFromServer(failure);
      if (fields) {
        setErrors(fields);
        return;
      }
      const message = messagingFailureCopy(failure);
      if (message) toastError(message);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Message rates"
        description={
          <>
            What a store pays per message, in rupees. Version {formatCount(settings.rates.version)}
            {settings.rates.updatedAt ? `, changed ${formatDateTime(settings.rates.updatedAt)}` : ""}
            {settings.rates.updatedBy ? ` by ${settings.rates.updatedBy}` : ""}.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-body">
            <caption className="sr-only">Rates per message in rupees, by channel and purpose</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-3 text-left text-label font-medium text-fg-muted">
                  Channel
                </th>
                {MESSAGING_PURPOSES.map((purpose) => (
                  <th key={purpose} scope="col" className="px-2 py-2 text-left text-label font-medium text-fg-muted">
                    {PURPOSE_LABEL[purpose]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* WhatsApp is charged by category (PRD-051), below */}
              {MESSAGING_CHANNELS.filter((channel) => channel !== "WHATSAPP").map((channel) => (
                <tr key={channel} className="border-t border-line-subtle">
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-fg">
                    {CHANNEL_LABEL[channel]}
                  </th>
                  {MESSAGING_PURPOSES.map((purpose) => {
                    const key = rateFieldKey(channel, purpose);
                    return (
                      <td key={purpose} className="px-2 py-3 align-top">
                        <Input
                          aria-label={`${CHANNEL_LABEL[channel]} ${PURPOSE_LABEL[purpose].toLowerCase()} rate in rupees`}
                          inputMode="decimal"
                          startContent={<span className="text-fg-muted">₹</span>}
                          value={draft[channel][purpose]}
                          onValueChange={(value) => change(channel, purpose, value)}
                          isReadOnly={!canManage}
                          isInvalid={!!errors[key]}
                          errorMessage={errors[key]}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="WhatsApp rates by Meta category"
        description="What a store pays per WhatsApp message, by its template's category. Service is a reply inside the 24-hour window (free from Meta)."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WHATSAPP_CATEGORIES.map((category: WhatsAppRateCategory) => {
            const key = whatsAppRateFieldKey(category);
            return (
              <Input
                key={category}
                label={WHATSAPP_CATEGORY_LABEL[category]}
                inputMode="decimal"
                startContent={<span className="text-fg-muted">₹</span>}
                value={waDraft[category]}
                onValueChange={(value) => {
                  setWaDraft((current) => ({ ...current, [category]: value }));
                  setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
                }}
                isReadOnly={!canManage}
                isInvalid={!!errors[key]}
                errorMessage={errors[key]}
              />
            );
          })}
        </div>
        <div className="mt-4 border-t border-line-subtle pt-4">
          <Input
            className="sm:max-w-xs"
            label="WhatsApp number fee per month (passed through at cost)"
            description="Debited once a month from the message balance of each store with a live number. 0 = not charged."
            inputMode="decimal"
            startContent={<span className="text-fg-muted">₹</span>}
            value={numberFee}
            onValueChange={(value) => {
              setNumberFee(value);
              setErrors((current) => ({ ...current, whatsappNumberMonthlyFeePaise: undefined, form: undefined }));
            }}
            isReadOnly={!canManage}
            isInvalid={!!errors.whatsappNumberMonthlyFeePaise}
            errorMessage={errors.whatsappNumberMonthlyFeePaise}
          />
        </div>
      </Card>

      <Card
        title="Hourly email limits"
        description="MSG91 starts every account at 500 emails an hour. Order and account email go first; marketing uses at most its share of each hour and the rest waits for the next hour."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Zerror's parent account, emails an hour"
            description="Mail from the shared address without a store's own account. Every store shares it."
            inputMode="numeric"
            value={parentLimit}
            onValueChange={(value) => {
              setParentLimit(value);
              setErrors((current) => ({ ...current, parentHourlyEmailLimit: undefined, form: undefined }));
            }}
            isReadOnly={!canManage}
            isInvalid={!!errors.parentHourlyEmailLimit}
            errorMessage={errors.parentHourlyEmailLimit}
          />
          <Input
            label="Marketing's share of each hour"
            description={
              marketingShareError(share)
                ? "Campaigns and automations; transactional email may use the whole hour."
                : `At 500 an hour: ${marketingPerHour(500, Number(share.trim()))} marketing emails an hour.`
            }
            inputMode="numeric"
            endContent={<span className="text-fg-muted">%</span>}
            value={share}
            onValueChange={(value) => {
              setShare(value);
              setErrors((current) => ({ ...current, marketingHourlySharePercent: undefined, form: undefined }));
            }}
            isReadOnly={!canManage}
            isInvalid={!!errors.marketingHourlySharePercent}
            errorMessage={errors.marketingHourlySharePercent}
          />
        </div>
      </Card>

      <Card title="Create accounts through MSG91's API" description="add_client.php creates a store's child account without ops.">
        <div className="flex flex-col gap-3">
          <Switch
            isSelected={addClient}
            isDisabled={!canManage}
            onValueChange={(value) => (value ? setConfirmOn(true) : setAddClient(false))}
          >
            {addClient ? "On" : "Off"}
          </Switch>
          <p className="flex gap-2 rounded-xl bg-tone-warning-soft px-3 py-2 text-label text-fg">
            <IconWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
            Keep this off until MSG91 confirms the add_client API in writing. While it is off, Create messaging account
            opens a task in the work queue instead.
          </p>
        </div>
      </Card>

      {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}

      {canManage ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            isDisabled={!dirty || loading}
            onPress={() => {
              setDraft(ratesDraftOf(settings.rates));
              setWaDraft(whatsAppRatesDraftOf(settings.rates));
              setAddClient(settings.addClientApiEnabled);
              setParentLimit(String(settings.parentHourlyEmailLimit));
              setShare(String(settings.marketingHourlySharePercent));
              setNumberFee(paiseToRupees(settings.whatsappNumberMonthlyFeePaise ?? 0));
              setErrors({});
            }}
          >
            Discard
          </Button>
          <Button variant="primary" isDisabled={!dirty} isLoading={loading} onPress={() => void submit()}>
            Save
          </Button>
        </div>
      ) : (
        <p className="text-label text-fg-muted">Changing rates needs messaging manage access.</p>
      )}

      <ConfirmDialog
        isOpen={confirmOn}
        onClose={() => setConfirmOn(false)}
        onConfirm={() => {
          setAddClient(true);
          setConfirmOn(false);
        }}
        title="Turn on the add_client API?"
        description="Only once MSG91 has confirmed in writing that add_client.php works for Zerror's account. Save to apply it."
        confirmLabel="Turn on"
        icon={<IconWarning aria-hidden />}
      />
    </div>
  );
}
