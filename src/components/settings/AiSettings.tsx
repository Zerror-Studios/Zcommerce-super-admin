/**
 * Settings › ZCOM AI settings (04 S-07g, PRD-021 FR-6.4): the master `ai_config` as five cards on one page —
 * Assistant, Spend, Limits, Night window, Model prices (anchors #assistant … #prices) — and one save bar.
 * Anyone with `platform:ai:read` sees it; changing it needs `platform:ai:manage` (and two-step for manage roles,
 * handled by the Apollo link). Only the fields that changed are sent; every service picks the change up within
 * 60 seconds.
 */
import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { UPDATE_AI_CONFIG } from "../../graphql/ai";
import { useAiConfig } from "../../hooks/use-platform-ai";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  AI_CONFIG_FORM_FIELDS,
  AI_CONFIG_PROPAGATION_COPY,
  aiConfigDraft,
  aiConfigPatch,
  aiFieldErrorsFromServer,
  aiKnownModels,
  type AiConfigDraft,
  type FieldErrors,
} from "../../lib/platform-ai.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformAiConfig } from "../../types/platform-api";
import { toasts } from "../../copy";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FieldGrid,
  FilterChip,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  cx,
  fieldSpanFull,
  toastError,
} from "../ui";
import { IconAdd, IconLock } from "../ui/icons";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

type TextField =
  | "globalDailySpendCapUsd"
  | "monthlyBudgetUsd"
  | "usdInrRate"
  | "nightCoolingStart"
  | "nightCoolingEnd"
  | "perQuestionTokenCeiling"
  | "rateLimitPerMinute"
  | "benchmarkMinStores";

/** Per-model prices: four in US dollars per million tokens, then the batch multiplier. */
const PRICE_COLUMNS = [
  { key: "inputPerMTok", label: "Input" },
  { key: "outputPerMTok", label: "Output" },
  { key: "cacheWritePerMTok", label: "Cache write" },
  { key: "cacheReadPerMTok", label: "Cache read" },
  { key: "batchDiscount", label: "Batch multiplier" },
] as const;

const MODEL_ROLES = [
  { field: "defaultModel", id: "ai-default-model", label: "Default model", description: "Answers most questions." },
  { field: "reasoningModel", id: "ai-reasoning-model", label: "Reasoning model", description: "Used for harder questions." },
] as const;

const MAX_ALERTS = 5;

/** "50, 80" ⇄ ["50", "80"]: the draft keeps the live comma text; the page shows chips. */
const alertList = (text: string) =>
  text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export function AiSettings() {
  const { can } = useAuth();
  const canRead = can(PLATFORM_PERMISSIONS.AI_READ);
  const canManage = can(PLATFORM_PERMISSIONS.AI_MANAGE);
  const api = useAiConfig();

  return (
    <div>
      <SettingsSectionHeader section="ai" />
      {!canRead ? (
        <Card>
          <EmptyState icon={IconLock} title="AI settings aren't available to your role" description="Ask a platform owner for AI access." />
        </Card>
      ) : api.error ? (
        <ErrorState title="Couldn't load the AI settings." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : api.loading || !api.data ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading AI settings">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        // A saved config (or another operator's save) remounts the form with it.
        <AiConfigForm key={JSON.stringify(api.data)} config={api.data} canManage={canManage} />
      )}
    </div>
  );
}

function AiConfigForm({ config, canManage }: { config: PlatformAiConfig; canManage: boolean }) {
  const [draft, setDraft] = useState<AiConfigDraft>(() => aiConfigDraft(config));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [newAlert, setNewAlert] = useState("");
  const inFlight = useRef(false);
  const [update] = useMutation<{ updateAiConfig: PlatformAiConfig }>(UPDATE_AI_CONFIG);
  const models = useMemo(() => aiKnownModels(config), [config]);

  const pending = aiConfigPatch(config, draft);
  const dirtyCount = Object.keys(pending.input).length;
  const isDirty = dirtyCount > 0 || Object.keys(pending.errors).length > 0;
  const errorCount = Object.entries(errors).filter(([key, value]) => key !== "form" && !!value).length;
  const readOnly = !canManage || busy;

  const clearError = (...fields: string[]) =>
    setErrors((current) => {
      const next: FieldErrors = { ...current, form: undefined };
      for (const field of fields) next[field] = undefined;
      return next;
    });

  const setText = (field: TextField) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    clearError(field);
  };

  const setAlerts = (list: string[]) => {
    setDraft((current) => ({ ...current, alertThresholds: list.join(", ") }));
    clearError("alertThresholds");
  };
  const alerts = alertList(draft.alertThresholds);
  const addAlert = () => {
    const value = newAlert.trim();
    if (!value || alerts.includes(value)) return;
    setAlerts([...alerts, value].sort((a, b) => Number(a) - Number(b)));
    setNewAlert("");
  };

  const toggleModel = (model: string, on: boolean) => {
    setDraft((current) => ({
      ...current,
      allowedModels: on ? [...current.allowedModels, model] : current.allowedModels.filter((entry) => entry !== model),
    }));
    clearError("allowedModels", "defaultModel", "reasoningModel");
  };

  const setPrice = (model: string, field: (typeof PRICE_COLUMNS)[number]["key"], value: string) => {
    setDraft((current) => ({
      ...current,
      pricing: { ...current.pricing, [model]: { ...current.pricing[model], [field]: value } },
    }));
    clearError("pricing");
  };

  const discard = () => {
    setDraft(aiConfigDraft(config));
    setErrors({});
    setNewAlert("");
  };

  const save = async () => {
    const result = aiConfigPatch(config, draft);
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }
    if (Object.keys(result.input).length === 0 || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      // The cache's PlatformAiConfig entry is replaced by the response, which remounts this form.
      await update({ variables: { input: result.input } });
      addToast({ title: AI_CONFIG_PROPAGATION_COPY });
    } catch (error) {
      const fields = aiFieldErrorsFromServer(error, ["INVALID_AI_CONFIG"], AI_CONFIG_FORM_FIELDS);
      if (fields) setErrors(fields);
      else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const numberInput = (field: TextField, id: string, label: string, options: { description?: string; prefix?: string; step?: string } = {}) => (
    <Input
      id={id}
      label={label}
      type="number"
      inputMode="decimal"
      min={0}
      step={options.step ?? "any"}
      value={draft[field]}
      onValueChange={setText(field)}
      description={options.description}
      startContent={options.prefix ? <span className="text-label text-fg-subtle">{options.prefix}</span> : undefined}
      classNames={{ input: "num" }}
      isReadOnly={readOnly}
      isInvalid={!!errors[field]}
      errorMessage={errors[field]}
    />
  );

  const timeInput = (field: "nightCoolingStart" | "nightCoolingEnd", id: string, label: string) => (
    <Input
      id={id}
      label={label}
      type="time"
      step={60}
      value={draft[field]}
      onValueChange={setText(field)}
      classNames={{ input: "num" }}
      isReadOnly={readOnly}
      isInvalid={!!errors[field]}
      errorMessage={errors[field]}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {errors.form ? <p className="text-body text-tone-danger-text" role="alert">{errors.form}</p> : null}
      {!canManage ? <p className="text-label text-fg-muted">Changing AI settings needs the AI manage permission.</p> : null}

      <Card id="assistant" data-settings-field title="Assistant" description="Switch ZCOM AI off for every store, and pick the models it may use.">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-fg">ZCOM AI for every store</p>
                <Chip tone={draft.enabled ? "success" : "neutral"}>{draft.enabled ? "AI on" : "AI off"}</Chip>
              </div>
              <p className="mt-0.5 text-label text-fg-muted">
                {draft.enabled
                  ? "Stores can ask questions and get their daily summary, within their plan's limits."
                  : 'Merchants see "The AI assistant is temporarily switched off". Plans and store overrides are kept.'}
              </p>
            </div>
            <Switch
              aria-label="ZCOM AI for every store"
              isSelected={draft.enabled}
              isReadOnly={readOnly}
              onValueChange={(on) => setDraft((current) => ({ ...current, enabled: on }))}
            />
          </div>

          <div>
            <p className="mb-2 text-label font-medium text-fg">Models</p>
            <ul className="divide-y divide-line-subtle rounded-xl border border-line">
              {models.map((model) => {
                const allowed = draft.allowedModels.includes(model);
                return (
                  <li key={model} className="flex min-h-13 items-center justify-between gap-4 px-4 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={cx("truncate font-mono text-label", allowed ? "text-fg" : "text-fg-subtle")}>{model}</span>
                      {draft.defaultModel === model ? <Chip tone="info">Default</Chip> : null}
                      {draft.reasoningModel === model ? <Chip tone="neutral">Reasoning</Chip> : null}
                    </div>
                    <Switch
                      aria-label={`Allow ${model}`}
                      isSelected={allowed}
                      isReadOnly={readOnly}
                      onValueChange={(on) => toggleModel(model, on)}
                    />
                  </li>
                );
              })}
            </ul>
            {errors.allowedModels ? <p className="mt-1.5 text-caption text-tone-danger-text">{errors.allowedModels}</p> : null}
          </div>

          <FieldGrid>
            {MODEL_ROLES.map((role) => (
              <Select
                key={role.field}
                id={role.id}
                label={role.label}
                description={role.description}
                classNames={{ value: "font-mono" }}
                selectedKeys={draft[role.field] ? new Set([draft[role.field]]) : new Set()}
                isDisabled={readOnly}
                disallowEmptySelection
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") {
                    setDraft((current) => ({ ...current, [role.field]: value }));
                    clearError(role.field);
                  }
                }}
                isInvalid={!!errors[role.field]}
                errorMessage={errors[role.field]}
              >
                {draft.allowedModels.map((model) => (
                  <SelectItem key={model} classNames={{ title: "font-mono" }}>
                    {model}
                  </SelectItem>
                ))}
              </Select>
            ))}
          </FieldGrid>
        </div>
      </Card>

      <Card id="spend" data-settings-field title="Spend" description="Caps in US dollars; the rate converts them for reports in rupees.">
        <FieldGrid>
          {numberInput("globalDailySpendCapUsd", "ai-daily-cap", "Daily spend cap", {
            prefix: "$",
            description: "Past it, every store's assistant rests until tomorrow.",
          })}
          {numberInput("monthlyBudgetUsd", "ai-monthly-budget", "Monthly budget", { prefix: "$" })}
          <div data-settings-field>
            <p id="ai-alerts-label" className="mb-1.5 text-label font-medium text-fg">
              Budget alerts
            </p>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="ai-alerts-label">
              {alerts.map((alert) => (
                <FilterChip
                  key={alert}
                  removeLabel={`Remove the ${alert}% alert`}
                  onRemove={() => {
                    if (!readOnly) setAlerts(alerts.filter((entry) => entry !== alert));
                  }}
                >
                  {alert}%
                </FilterChip>
              ))}
              {alerts.length < MAX_ALERTS && !readOnly ? (
                <span className="flex items-center gap-1">
                  <Input
                    id="ai-alerts"
                    aria-label="New budget alert"
                    size="sm"
                    type="number"
                    min={1}
                    max={100}
                    placeholder="90"
                    value={newAlert}
                    onValueChange={setNewAlert}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addAlert();
                      }
                    }}
                    endContent={<span className="text-label text-fg-subtle">%</span>}
                    className="w-24"
                    classNames={{ input: "num" }}
                  />
                  <Button variant="tertiary" size="sm" startIcon={<IconAdd aria-hidden />} onPress={addAlert} isDisabled={!newAlert.trim()}>
                    Add
                  </Button>
                </span>
              ) : null}
            </div>
            <p className={cx("mt-1.5 text-caption", errors.alertThresholds ? "text-tone-danger-text" : "text-fg-muted")}>
              {errors.alertThresholds ?? "Up to five, as a share of the monthly budget."}
            </p>
          </div>
          {numberInput("usdInrRate", "ai-usd-inr", "USD to INR rate", { prefix: "₹" })}
        </FieldGrid>
      </Card>

      <Card id="limits" data-settings-field title="Limits" description="Per question and per store, on top of each plan's weekly questions.">
        <FieldGrid>
          {numberInput("perQuestionTokenCeiling", "ai-token-ceiling", "Tokens per question", { step: "1" })}
          {numberInput("rateLimitPerMinute", "ai-rate-limit", "Questions per minute per store", { step: "1" })}
          {numberInput("benchmarkMinStores", "ai-benchmark-min", "Stores per benchmark", {
            step: "1",
            description: "A benchmark shows only with at least this many stores.",
          })}
        </FieldGrid>
      </Card>

      <Card id="night" data-settings-field title="Night window">
        <FieldGrid>
          {timeInput("nightCoolingStart", "ai-night-start", "Starts at")}
          {timeInput("nightCoolingEnd", "ai-night-end", "Ends at")}
          <p className={cx(fieldSpanFull, "text-caption text-fg-muted")}>
            No scheduled insights runs in this window, in each store's own time zone.
          </p>
        </FieldGrid>
      </Card>

      <Card
        id="prices"
        data-settings-field
        title="Model prices"
        description="US dollars per million tokens; the batch multiplier applies to daily summaries."
        padding="none"
      >
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {config.pricing.map((row) => (
            <li key={row.model} className="px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-label font-medium text-fg">{row.model}</span>
                {draft.defaultModel === row.model ? <Chip tone="info">Default</Chip> : null}
                {draft.reasoningModel === row.model ? <Chip tone="neutral">Reasoning</Chip> : null}
                {!draft.allowedModels.includes(row.model) ? <Chip tone="neutral">Not allowed</Chip> : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
                {PRICE_COLUMNS.map((column) => {
                  const isMultiplier = column.key === "batchDiscount";
                  return (
                    <Input
                      key={column.key}
                      label={column.label}
                      size="sm"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder="0"
                      startContent={isMultiplier ? null : <span className="text-label text-fg-subtle">$</span>}
                      endContent={<span className="text-label text-fg-subtle">{isMultiplier ? "×" : "/M"}</span>}
                      classNames={{ input: "num" }}
                      value={draft.pricing[row.model]?.[column.key] ?? ""}
                      onValueChange={(value) => setPrice(row.model, column.key, value)}
                      isReadOnly={readOnly}
                    />
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        {errors.pricing ? <p className="border-t border-line-subtle px-5 py-3 text-caption text-tone-danger-text">{errors.pricing}</p> : null}
      </Card>

      {canManage ? (
        <SettingsSaveBar
          isDirty={isDirty}
          onDiscard={discard}
          onSave={() => void save()}
          isSaving={busy}
          dirtyCount={dirtyCount || undefined}
          errorCount={errorCount}
        />
      ) : null}
    </div>
  );
}
