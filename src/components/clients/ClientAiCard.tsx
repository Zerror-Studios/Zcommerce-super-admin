import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useRef, useState } from "react";
import { SET_TENANT_AI_OVERRIDE, SET_TENANT_AI_PAUSED } from "../../graphql/ai";
import { useAiTenantSetting, useAiTopQuestions, useAiUsageByTenant } from "../../hooks/use-platform-ai";
import { mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  AI_CONFIG_PROPAGATION_COPY,
  AI_NOTE_MAX_LENGTH,
  AI_OVERRIDE_FORM_FIELDS,
  aiFieldErrorsFromServer,
  aiOverrideDraft,
  aiOverrideInput,
  aiOverrideLabel,
  formatUsdInr,
  type AiOverrideDraft,
  type FieldErrors,
} from "../../lib/platform-ai.util";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import type { PlatformAiTenantSetting } from "../../types/platform-api";
import { GrantTopUpDialog } from "../ai/GrantTopUpDialog";
import { KeyValue, KeyValueGrid } from "./StoreDetailParts";
import {
  Button as UiButton,
  Card,
  Checkbox,
  Chip,
  ErrorState,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Textarea,
  cx,
  formatCount,
  formatDateTime,
  toastError,
  toneTextClasses,
} from "../ui";

export interface ClientAiCardProps {
  client: Client;
}

/**
 * Store detail › ZCOM AI (PRD-021 FR-6.4, 04 S-03g): the store's AI pause and its limit
 * overrides (empty = the plan's value), Grant questions, and the store's
 * most-asked questions. Reading the questions is audit-logged by the
 * server, so they load only when the operator asks. Changes need
 * `platform:ai:manage`.
 */
export function ClientAiCard({ client }: ClientAiCardProps) {
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.AI_MANAGE);
  const api = useAiTenantSetting(client.id);
  const setting = api.data;
  const [pausing, setPausing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [granting, setGranting] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Status and limits
            {setting ? setting.paused ? <Chip tone="warning">Paused</Chip> : <Chip tone="success">AI on</Chip> : null}
          </span>
        }
        description={
          setting?.paused && setting.pausedReason
            ? setting.pausedReason
            : "Ask ZCOM limits for this store. Empty limits use the plan's values."
        }
        actions={
          canManage && setting ? (
            <div className="flex flex-wrap gap-2">
              <UiButton size="sm" variant="secondary" onPress={() => setGranting(true)}>
                Grant questions
              </UiButton>
              <UiButton size="sm" variant="secondary" onPress={() => setEditing(true)}>
                Edit limits
              </UiButton>
              <UiButton size="sm" variant="secondary" onPress={() => setPausing(true)}>
                {setting.paused ? "Resume AI" : "Pause AI"}
              </UiButton>
            </div>
          ) : null
        }
      >
        {api.error ? (
          <ErrorState inline title="Couldn't load this store's AI setting." onRetry={() => void api.refetch()} />
        ) : api.loading || !setting ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : (
          <KeyValueGrid columns={3}>
            <KeyValue label="Questions per week">{aiOverrideLabel(setting.questionsPerWeek, "questions")}</KeyValue>
            <KeyValue label="Claude connector calls per week">
              {aiOverrideLabel(setting.connectorCallsPerWeek, "calls")}
            </KeyValue>
            <KeyValue label="Monthly token budget">{aiOverrideLabel(setting.monthlyTokenBudget, "tokens")}</KeyValue>
          </KeyValueGrid>
        )}
      </Card>

      <MonthUsage tenantId={client.id} />

      <Card
        title="Most-asked questions"
        description="Masked excerpts from the last 30 days. Viewing them is recorded in the audit log."
        actions={
          !showQuestions ? (
            <UiButton size="sm" variant="secondary" onPress={() => setShowQuestions(true)}>
              Show questions
            </UiButton>
          ) : undefined
        }
      >
        {showQuestions ? <TopQuestions tenantId={client.id} /> : null}
      </Card>

      {/* Mounted only while open, so each opening starts from the saved values. */}
      {setting && pausing ? (
        <PauseDialog onClose={() => setPausing(false)} storeName={client.storeName} setting={setting} />
      ) : null}
      {setting && editing ? (
        <OverrideDialog onClose={() => setEditing(false)} storeName={client.storeName} setting={setting} />
      ) : null}
      <GrantTopUpDialog
        store={granting ? { tenantId: client.id, name: client.storeName } : null}
        onClose={() => setGranting(false)}
      />
    </div>
  );
}

// ─── This month (PRD-024 FR-3.6) ──────────────────────────────────────────

/** This store's AI use this month, from its own `aiUsageByTenant` row. */
function MonthUsage({ tenantId }: { tenantId: string }) {
  const api = useAiUsageByTenant({ limit: 1, offset: 0, search: "", tenantId });
  const row = api.data?.items.find((item) => item.tenantId === tenantId) ?? null;
  return (
    <Card title="This month">
      {api.error ? (
        <ErrorState inline title="Couldn't load this store's AI usage." onRetry={() => void api.refetch()} />
      ) : api.loading ? (
        <Skeleton className="h-12 w-full rounded-lg" />
      ) : !row ? (
        <p className="text-body text-fg-muted">No AI usage recorded for this store.</p>
      ) : (
        <KeyValueGrid columns={3}>
          <KeyValue label="Questions">
            <span className="num">
              {formatCount(row.questionsThisMonth)} · {formatCount(row.questionsThisWeek)} this week
            </span>
          </KeyValue>
          <KeyValue label="Tokens">
            <span className="num">{formatCount(row.tokensThisMonth)} tokens</span>
          </KeyValue>
          <KeyValue label="Cost">
            <span className="num">{formatUsdInr(row.costUsdThisMonth, row.costInrThisMonth)}</span>
          </KeyValue>
        </KeyValueGrid>
      )}
    </Card>
  );
}

// ─── Top questions ────────────────────────────────────────────────────────

function TopQuestions({ tenantId }: { tenantId: string }) {
  const api = useAiTopQuestions(tenantId, true);
  if (api.error) {
    return <ErrorState inline title="Couldn't load the questions." onRetry={() => void api.refetch()} />;
  }
  if (api.loading) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (api.data.length === 0) {
    return <p className="text-body text-fg-muted">No questions asked in the last 30 days.</p>;
  }
  return (
    <ol className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle">
      {api.data.map((row, index) => (
        <li key={`${index}:${row.excerpt}`} className="flex items-start justify-between gap-3 py-2.5">
          <span className="min-w-0 wrap-break-word text-body text-fg">{row.excerpt}</span>
          <span className="shrink-0 text-label text-fg-muted num">
            {formatCount(row.count)}× · {formatDateTime(row.lastAskedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ─── Pause ────────────────────────────────────────────────────────────────

interface SettingDialogProps {
  onClose: () => void;
  storeName: string;
  setting: PlatformAiTenantSetting;
}

function PauseDialog({ onClose, storeName, setting }: SettingDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [setPaused] = useMutation(SET_TENANT_AI_PAUSED);
  const pausing = !setting.paused;

  const run = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await setPaused({
        variables: {
          tenantId: setting.tenantId,
          paused: pausing,
          reason: pausing ? reason.trim() || null : null,
        },
      });
      addToast({
        title: pausing ? `AI paused for ${storeName}.` : `AI resumed for ${storeName}.`,
        description: AI_CONFIG_PROPAGATION_COPY,
      });
      onClose();
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} width="sm">
      <ModalContent>
        <ModalHeader>{pausing ? `Pause AI for ${storeName}?` : `Resume AI for ${storeName}?`}</ModalHeader>
        <ModalBody>
          {pausing ? (
            <>
              <p className="text-body text-fg-muted">
                The store's staff see "AI is paused for this store. Contact support" until you resume it. The
                Business Insights tab keeps working.
              </p>
              <Textarea
                label="Reason"
                description="Optional. Kept on the store and in the audit log."
                maxLength={AI_NOTE_MAX_LENGTH}
                value={reason}
                onValueChange={setReason}
              />
            </>
          ) : (
            <p className="text-body text-fg-muted">Ask ZCOM works again for the store, within its plan's limits.</p>
          )}
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton variant={pausing ? "destructive" : "primary"} onPress={() => void run()} isLoading={busy}>
            {pausing ? "Pause AI" : "Resume AI"}
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Overrides ────────────────────────────────────────────────────────────

function OverrideDialog({ onClose, storeName, setting }: SettingDialogProps) {
  const [draft, setDraft] = useState<AiOverrideDraft>(() => aiOverrideDraft(setting));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [setOverride] = useMutation(SET_TENANT_AI_OVERRIDE);

  const update = (field: keyof AiOverrideDraft, value: string | boolean) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const run = async () => {
    const result = aiOverrideInput(draft);
    if (!result.input) {
      setErrors(result.errors);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      // All three fields, always: the server treats an omitted one as "plan value".
      await setOverride({ variables: { tenantId: setting.tenantId, input: result.input } });
      addToast({ title: `AI limits saved for ${storeName}.`, description: AI_CONFIG_PROPAGATION_COPY });
      onClose();
    } catch (error) {
      const fields = aiFieldErrorsFromServer(error, ["INVALID_OVERRIDE"], AI_OVERRIDE_FORM_FIELDS);
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

  return (
    <Modal isOpen onClose={onClose} width="md">
      <ModalContent>
        <ModalHeader>AI limits for {storeName}</ModalHeader>
        <ModalBody>
          <p className="text-body text-fg-muted">Leave a field empty to use the store's plan value.</p>
          {errors.form ? <p className={cx("text-body", toneTextClasses.danger)}>{errors.form}</p> : null}
          <div className="flex flex-col gap-3">
            <Input
              label="Questions per week"
              inputMode="numeric"
              placeholder="Plan value"
              value={draft.questionsPerWeek}
              onValueChange={(value) => update("questionsPerWeek", value)}
              isInvalid={!!errors.questionsPerWeek}
              errorMessage={errors.questionsPerWeek}
            />
            <div className="flex flex-col gap-2">
              <Input
                label="Claude connector calls per week"
                inputMode="numeric"
                placeholder="Plan value"
                value={draft.connectorCallsPerWeek}
                onValueChange={(value) => update("connectorCallsPerWeek", value)}
                isDisabled={draft.connectorFairUse}
                isInvalid={!!errors.connectorCallsPerWeek}
                errorMessage={errors.connectorCallsPerWeek}
              />
              <Checkbox isSelected={draft.connectorFairUse} onValueChange={(on) => update("connectorFairUse", on)}>
                Fair use (no weekly cap)
              </Checkbox>
            </div>
            <Input
              label="Monthly token budget"
              inputMode="numeric"
              placeholder="Plan value"
              value={draft.monthlyTokenBudget}
              onValueChange={(value) => update("monthlyTokenBudget", value)}
              isInvalid={!!errors.monthlyTokenBudget}
              errorMessage={errors.monthlyTokenBudget}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <UiButton variant="secondary" onPress={onClose} isDisabled={busy}>
            Cancel
          </UiButton>
          <UiButton onPress={() => void run()} isLoading={busy}>
            Save limits
          </UiButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
