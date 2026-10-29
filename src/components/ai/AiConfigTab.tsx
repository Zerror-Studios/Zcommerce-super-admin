import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useMemo, useRef, useState, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
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
  Chip,
  ErrorState,
  IconBilling,
  IconAi,
  IconPayments,
  IconSettings,
  IconTime,
  Input,
  PaneHeader,
  PaneList,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  TwoPaneCard,
  cx,
  toastError,
  toneTextClasses,
  type PaneGroup,
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

/** Per-model prices: four in US dollars per million tokens, then the batch multiplier. */
const PRICE_COLUMNS = [
  { key: "inputPerMTok", label: "Input" },
  { key: "outputPerMTok", label: "Output" },
  { key: "cacheWritePerMTok", label: "Cache write" },
  { key: "cacheReadPerMTok", label: "Cache read" },
  { key: "batchDiscount", label: "Batch multiplier" },
] as const;

/** The two model roles in Assistant › Model roles; each picks one allowed model. */
const MODEL_ROLES = [
  { field: "defaultModel", label: "Default model", description: "Answers most questions." },
  { field: "reasoningModel", label: "Reasoning model", description: "Used for harder questions." },
] as const;

// ─── Sections ────────────────────────────────────────────────────────────────

/** The form's sections, laid out like Settings (owner 2026-10-28); `?section=` in the URL. */
type AiSettingsSection = "assistant" | "spend" | "limits" | "night" | "prices";

const aiSections: Record<
  AiSettingsSection,
  { title: string; description: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; fields: string[] }
> = {
  assistant: {
    title: "Assistant",
    description: "Switch ZCOM AI off for every store, and pick the models it may use.",
    icon: IconAi,
    fields: ["enabled", "allowedModels", "defaultModel", "reasoningModel"],
  },
  spend: {
    title: "Spend",
    description: "Caps in US dollars; the rate converts them for reports in rupees.",
    icon: IconBilling,
    fields: ["globalDailySpendCapUsd", "monthlyBudgetUsd", "alertThresholds", "usdInrRate"],
  },
  limits: {
    title: "Limits",
    description: "Per question and per store, on top of each plan's weekly questions.",
    icon: IconSettings,
    fields: ["perQuestionTokenCeiling", "rateLimitPerMinute", "benchmarkMinStores"],
  },
  night: {
    title: "Night window",
    description: "No scheduled insights runs in this window, in each store's own time zone (24-hour).",
    icon: IconTime,
    fields: ["nightCoolingStart", "nightCoolingEnd"],
  },
  prices: {
    title: "Model prices",
    description: "US dollars per million tokens; the batch multiplier applies to daily summaries.",
    icon: IconPayments,
    fields: ["pricing"],
  },
};

const aiSectionGroups: { label: string; keys: AiSettingsSection[] }[] = [
  { label: "Assistant", keys: ["assistant"] },
  { label: "Budget", keys: ["spend", "limits", "night", "prices"] },
];

function isAiSection(value: string | null): value is AiSettingsSection {
  return value != null && value in aiSections;
}

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
        type="page"
        icon={<IconSettings aria-hidden />}
        section="pink"
        title="ZCOM AI settings"
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
  const [params] = useSearchParams();
  const sectionParam = params.get("section");
  const active: AiSettingsSection = isAiSection(sectionParam) ? sectionParam : "assistant";

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

  // A section with an error shows a dot in the list, so a failed save is easy to find.
  const hasError = (key: AiSettingsSection) => aiSections[key].fields.some((field) => !!errors[field]);
  const paneGroups: PaneGroup[] = aiSectionGroups.map((group) => ({
    label: group.label,
    items: group.keys.map((key) => {
      const Icon = aiSections[key].icon;
      return {
        key,
        label: aiSections[key].title,
        icon: <Icon aria-hidden />,
        href: `?section=${key}`,
        meta: hasError(key) ? <span aria-label="Has errors" className={cx("text-caption", toneTextClasses.danger)}>●</span> : undefined,
      };
    }),
  }));
  const meta = aiSections[active];

  return (
    <TwoPaneCard
      showDetail={sectionParam != null}
      back={{ href: "?", label: "ZCOM AI settings" }}
      list={<PaneList aria-label="ZCOM AI settings sections" groups={paneGroups} activeKey={active} />}
    >
      <PaneHeader title={meta.title} description={meta.description} />
      <div className="space-y-4">
        {errors.form ? <p className={cx("text-body", toneTextClasses.danger)}>{errors.form}</p> : null}

        {/* Assistant (owner 2026-10-28 redesign): status row, one row per model, then the two model roles. */}
        {active === "assistant" ? (
          <>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-semibold text-fg">ZCOM AI for every store</p>
                    <Chip tone={draft.enabled ? "success" : "warning"}>{draft.enabled ? "On" : "Off"}</Chip>
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
            </Card>

            <Card title="Models" description="The models ZCOM AI may call. Switch one off to stop using it." padding="none">
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                {models.map((model) => {
                  const allowed = draft.allowedModels.includes(model);
                  return (
                    <li key={model} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={cx("truncate font-mono text-label", allowed ? "text-fg" : "text-fg-subtle")}>
                          {model}
                        </span>
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
              {errors.allowedModels ? (
                <p className={cx("px-5 pb-3 text-caption", toneTextClasses.danger)}>{errors.allowedModels}</p>
              ) : null}
            </Card>

            <Card title="Model roles" description="Which allowed model answers what." padding="none">
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                {MODEL_ROLES.map((role) => (
                  <li
                    key={role.field}
                    className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="text-body font-medium text-fg">{role.label}</p>
                      <p className="mt-0.5 text-label text-fg-muted">{role.description}</p>
                    </div>
                    <Select
                      aria-label={role.label}
                      size="sm"
                      className="w-full sm:w-64 sm:shrink-0"
                      classNames={{ value: "font-mono" }}
                      selectedKeys={draft[role.field] ? new Set([draft[role.field]]) : new Set()}
                      isDisabled={readOnly}
                      disallowEmptySelection
                      onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0];
                        if (typeof value === "string") {
                          setDraft((current) => ({ ...current, [role.field]: value }));
                          setErrors((current) => ({ ...current, [role.field]: undefined }));
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
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ) : (
          <Card padding={active === "prices" ? "none" : "md"}>
            {active === "spend" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {numberInput("globalDailySpendCapUsd", "Daily spend cap (USD)", "Past it, every store's assistant rests until tomorrow.")}
                {numberInput("monthlyBudgetUsd", "Monthly budget (USD)")}
                {numberInput("alertThresholds", "Budget alerts (%)", "Up to five, separated by commas, e.g. 50, 80, 100.")}
                {numberInput("usdInrRate", "USD to INR rate")}
              </div>
            ) : null}
            {active === "limits" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {numberInput("perQuestionTokenCeiling", "Tokens per question")}
                {numberInput("rateLimitPerMinute", "Questions per minute per store")}
                {numberInput("benchmarkMinStores", "Stores per benchmark", "A benchmark shows only with at least this many stores.")}
              </div>
            ) : null}
            {active === "night" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {numberInput("nightCoolingStart", "Starts at")}
                {numberInput("nightCoolingEnd", "Ends at")}
              </div>
            ) : null}
            {active === "prices" ? (
              // One row per model: its name, then the five prices as labelled fields (owner 2026-10-28).
              <>
                <ul className="divide-y divide-line-subtle">
                  {config.pricing.map((row) => (
                    <li key={row.model} className="px-5 py-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-label font-medium text-fg">{row.model}</span>
                        {draft.defaultModel === row.model ? <Chip tone="info">Default</Chip> : null}
                        {draft.reasoningModel === row.model ? <Chip tone="neutral">Reasoning</Chip> : null}
                        {!draft.allowedModels.includes(row.model) ? <Chip tone="neutral">Not allowed</Chip> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                        {PRICE_COLUMNS.map((column) => {
                          const isMultiplier = column.key === "batchDiscount";
                          return (
                            <Input
                              key={column.key}
                              label={column.label}
                              labelPlacement="outside"
                              size="sm"
                              inputMode="decimal"
                              placeholder="0"
                              startContent={isMultiplier ? null : <span className="text-label text-fg-subtle">$</span>}
                              endContent={<span className="text-label text-fg-subtle">{isMultiplier ? "×" : "/M"}</span>}
                              classNames={{ input: "num text-right" }}
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
                {errors.pricing ? (
                  <p className={cx("border-t border-line-subtle px-5 py-3 text-caption", toneTextClasses.danger)}>
                    {errors.pricing}
                  </p>
                ) : null}
              </>
            ) : null}
          </Card>
        )}

        {/* One save for every section: the draft keeps changes made in other sections. */}
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
    </TwoPaneCard>
  );
}
