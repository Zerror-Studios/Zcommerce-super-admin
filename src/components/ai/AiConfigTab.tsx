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
import { PageHeader } from "../common/PageHeader";
import {
  Button as UiButton,
  Card,
  Checkbox,
  ErrorState,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  cx,
  toastError,
  toneTextClasses,
} from "../ui";

type TextField =
  | "globalDailySpendCapUsd"
  | "monthlyBudgetUsd"
  | "alertThresholds"
  | "usdInrRate"
  | "nightCoolingStart"
  | "nightCoolingEnd"
  | "perQuestionTokenCeiling"
  | "rateLimitPerMinute"
  | "benchmarkMinStores";

const PRICE_COLUMNS = [
  { key: "inputPerMTok", label: "Input $/M" },
  { key: "outputPerMTok", label: "Output $/M" },
  { key: "cacheWritePerMTok", label: "Cache write $/M" },
  { key: "cacheReadPerMTok", label: "Cache read $/M" },
  { key: "batchDiscount", label: "Batch ×" },
] as const;

/**
 * AI › Settings (PRD-021 FR-6.4): the master `ai_config` (models, prices,
 * spend caps, budget alerts, the night window, limits). Anyone with
 * `platform:ai:read` sees it; changing it needs `platform:ai:manage` (and
 * two-step for manage roles, handled by the Apollo link). Only the fields
 * that changed are sent; every service picks the change up within 60 s.
 */
export function AiConfigTab() {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.AI_MANAGE);
  const api = useAiConfig();

  return (
    <div>
      <PageHeader
        title="AI settings"
        description="Models, prices, spend caps and limits for every store's AI. Changes reach every service within 60 seconds."
      />
      {api.error ? (
        <ErrorState title="Couldn't load the AI settings." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : api.loading || !api.data ? (
        <Card>
          <Skeleton className="h-64 w-full rounded-lg" />
        </Card>
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
  const inFlight = useRef(false);
  const [update] = useMutation<{ updateAiConfig: PlatformAiConfig }>(UPDATE_AI_CONFIG);
  const models = useMemo(() => aiKnownModels(config), [config]);

  const pending = aiConfigPatch(config, draft);
  const dirty = Object.keys(pending.input).length > 0 || Object.keys(pending.errors).length > 0;
  const readOnly = !canManage || busy;

  const setText = (field: TextField) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const toggleModel = (model: string, on: boolean) => {
    setDraft((current) => ({
      ...current,
      allowedModels: on
        ? [...current.allowedModels, model]
        : current.allowedModels.filter((entry) => entry !== model),
    }));
    setErrors((current) => ({ ...current, allowedModels: undefined, defaultModel: undefined, reasoningModel: undefined }));
  };

  const setPrice = (model: string, field: (typeof PRICE_COLUMNS)[number]["key"], value: string) => {
    setDraft((current) => ({
      ...current,
      pricing: { ...current.pricing, [model]: { ...current.pricing[model], [field]: value } },
    }));
    setErrors((current) => ({ ...current, pricing: undefined }));
  };

  const save = async () => {
    const result = aiConfigPatch(config, draft);
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }
    if (Object.keys(result.input).length === 0) {
      addToast({ title: "Nothing to save." });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      // The cache's PlatformAiConfig entry is replaced by the response.
      await update({ variables: { input: result.input } });
      addToast({ title: AI_CONFIG_PROPAGATION_COPY });
    } catch (error) {
      const fields = aiFieldErrorsFromServer(error, ["INVALID_AI_CONFIG"], AI_CONFIG_FORM_FIELDS);
      if (fields) {
        setErrors(fields);
      } else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const numberInput = (field: TextField, label: string, description?: string) => (
    <Input
      label={label}
      inputMode="decimal"
      value={draft[field]}
      onValueChange={setText(field)}
      description={description}
      isReadOnly={readOnly}
      isInvalid={!!errors[field]}
      errorMessage={errors[field]}
    />
  );

  return (
    <div className="space-y-4">
      {errors.form ? <p className={cx("text-body", toneTextClasses.danger)}>{errors.form}</p> : null}

      <Card title="Assistant" description="Switch AI off for every store, and pick the models it may use.">
        <div className="flex flex-col gap-4">
          <Switch
            isSelected={draft.enabled}
            isReadOnly={readOnly}
            onValueChange={(on) => setDraft((current) => ({ ...current, enabled: on }))}
          >
            AI is on for every store
          </Switch>
          {!draft.enabled ? (
            <p className={cx("text-caption", toneTextClasses.warning)}>
              Merchants see "The AI assistant is temporarily switched off".
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-label text-fg-muted">Allowed models</legend>
            <div className="flex flex-wrap gap-4">
              {models.map((model) => (
                <Checkbox
                  key={model}
                  isSelected={draft.allowedModels.includes(model)}
                  isReadOnly={readOnly}
                  onValueChange={(on) => toggleModel(model, on)}
                >
                  {model}
                </Checkbox>
              ))}
            </div>
            {errors.allowedModels ? (
              <p className={cx("mt-1 text-caption", toneTextClasses.danger)}>{errors.allowedModels}</p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {(["defaultModel", "reasoningModel"] as const).map((field) => (
              <Select
                key={field}
                label={field === "defaultModel" ? "Default model" : "Reasoning model"}
                description={field === "defaultModel" ? "Answers most questions." : "Used for harder questions."}
                selectedKeys={draft[field] ? new Set([draft[field]]) : new Set()}
                isDisabled={readOnly}
                disallowEmptySelection
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") {
                    setDraft((current) => ({ ...current, [field]: value }));
                    setErrors((current) => ({ ...current, [field]: undefined }));
                  }
                }}
                isInvalid={!!errors[field]}
                errorMessage={errors[field]}
              >
                {draft.allowedModels.map((model) => (
                  <SelectItem key={model}>{model}</SelectItem>
                ))}
              </Select>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Spend" description="Caps in US dollars; the rate converts them for reports in rupees.">
        <div className="grid gap-4 sm:grid-cols-2">
          {numberInput("globalDailySpendCapUsd", "Daily spend cap (USD)", "Past it, every store's assistant rests until tomorrow.")}
          {numberInput("monthlyBudgetUsd", "Monthly budget (USD)")}
          {numberInput("alertThresholds", "Budget alerts (%)", "Up to five, separated by commas, e.g. 50, 80, 100.")}
          {numberInput("usdInrRate", "USD to INR rate")}
        </div>
      </Card>

      <Card title="Limits" description="Per question and per store, on top of each plan's weekly questions.">
        <div className="grid gap-4 sm:grid-cols-3">
          {numberInput("perQuestionTokenCeiling", "Tokens per question")}
          {numberInput("rateLimitPerMinute", "Questions per minute per store")}
          {numberInput("benchmarkMinStores", "Stores per benchmark", "A benchmark shows only with at least this many stores.")}
        </div>
      </Card>

      <Card title="Night window" description="No scheduled insights runs in this window, in each store's own time zone (24-hour).">
        <div className="grid gap-4 sm:grid-cols-2">
          {numberInput("nightCoolingStart", "Starts at")}
          {numberInput("nightCoolingEnd", "Ends at")}
        </div>
      </Card>

      <Card title="Model prices" description="US dollars per million tokens; the batch multiplier applies to daily summaries.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-body">
            <thead>
              <tr className="text-left text-label text-fg-muted">
                <th className="py-2 pr-3 font-medium">Model</th>
                {PRICE_COLUMNS.map((column) => (
                  <th key={column.key} className="py-2 pr-3 font-medium">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.pricing.map((row) => (
                <tr key={row.model} className="border-t border-line-subtle">
                  <td className="py-2 pr-3 font-medium text-fg">{row.model}</td>
                  {PRICE_COLUMNS.map((column) => (
                    <td key={column.key} className="py-2 pr-3">
                      <Input
                        aria-label={`${row.model} ${column.label}`}
                        size="sm"
                        inputMode="decimal"
                        value={draft.pricing[row.model]?.[column.key] ?? ""}
                        onValueChange={(value) => setPrice(row.model, column.key, value)}
                        isReadOnly={readOnly}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.pricing ? <p className={cx("mt-2 text-caption", toneTextClasses.danger)}>{errors.pricing}</p> : null}
      </Card>

      {canManage ? (
        <div className="flex justify-end gap-2">
          <UiButton
            variant="ghost"
            isDisabled={!dirty || busy}
            onPress={() => {
              setDraft(aiConfigDraft(config));
              setErrors({});
            }}
          >
            Discard changes
          </UiButton>
          <UiButton isDisabled={!dirty} isLoading={busy} onPress={() => void save()}>
            Save AI settings
          </UiButton>
        </div>
      ) : (
        <p className="text-caption text-fg-muted">Changing AI settings needs the AI manage permission.</p>
      )}
    </div>
  );
}
