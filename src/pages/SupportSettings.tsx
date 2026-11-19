/**
 * Super Admin › Support › Settings (PRD-049 FR-A33): Zerror's support hours (time zone, the seven days, holidays),
 * the first-reply promise per priority, and when resolved tickets are reminded, auto-closed and may be reopened.
 * Anyone with `platform:support:read` sees it; saving needs `platform:support:manage` (two-step for manage roles,
 * handled by the Apollo link). Only the changed groups are sent, with `expectedVersion`; a save someone else made
 * first reloads their version. A plan's own first-reply hours (features.support) win over these.
 */
import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { SettingsCardsSkeleton } from "../components/settings/SettingsCardsSkeleton";
import { SettingsSaveBar } from "../components/settings/SettingsSaveBar";
import { supportAbilities } from "../components/support/support.util";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FieldGrid,
  FilterChip,
  Input,
  Switch,
  cx,
  fieldSpanFull,
  formatDate,
  formatDateTime,
  toastError,
} from "../components/ui";
import { IconAdd, IconLock } from "../components/ui/icons";
import { toasts } from "../copy";
import { PLATFORM_SUPPORT_SETTINGS, UPDATE_PLATFORM_SUPPORT_SETTINGS } from "../graphql/support";
import { mutationFailureCopy } from "../lib/mutation-errors";
import {
  REPLY_PRIORITIES,
  WEEKDAY_LABELS,
  addHoliday,
  isSupportSettingsConflict,
  rebaseSupportSettingsDraft,
  supportSettingsDraft,
  supportSettingsErrorsFromServer,
  supportSettingsPatch,
  type PlatformSupportSettings,
  type SupportSettingsDraft,
  type SupportSettingsErrors,
} from "../lib/support-settings.util";
import { useAuth } from "../providers/AuthProvider";

type SettingsData = { platformSupportSettings: PlatformSupportSettings };

const SKELETON_CARDS = [
  { title: "Support hours", description: "When the reply clock runs. Time outside these hours and on holidays doesn't count.", fields: 8 },
  { title: "Holidays", fields: 1 },
  { title: "First reply", description: "How soon support answers a new ticket, per priority.", fields: 4 },
  { title: "Resolved and closed tickets", fields: 4 },
];

export function SupportSettings() {
  const { can } = useAuth();
  const abilities = supportAbilities(can);
  const { data, loading, error, refetch } = useQuery<SettingsData>(PLATFORM_SUPPORT_SETTINGS, {
    skip: !abilities.read,
    fetchPolicy: "cache-and-network",
  });
  const settings = data?.platformSupportSettings;
  // A save that lost to someone else's: the edits to put back on top of their version.
  const carried = useRef<CarriedEdits | null>(null);
  // The remounted form has taken them by now (effects run after its first render).
  useEffect(() => {
    if (carried.current && carried.current.opened.version !== settings?.version) carried.current = null;
  }, [settings?.version]);

  return (
    <>
      <PageHeader title="Settings" eyebrow="Support" description="Support hours, reply promises and when tickets close" />
      {!abilities.read ? (
        <Card>
          <EmptyState icon={IconLock} title="Support settings aren't available to your role" description="Ask a platform owner for support access." />
        </Card>
      ) : error && !settings ? (
        <ErrorState title="Couldn't load the support settings." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : loading && !settings ? (
        <SettingsCardsSkeleton label="Loading support settings" cards={SKELETON_CARDS} />
      ) : settings ? (
        // A save (ours or someone else's) changes the version and remounts the form with it.
        <SupportSettingsForm
          key={settings.version}
          settings={settings}
          canManage={abilities.manage}
          carried={carried.current}
          onConflict={(edits) => {
            carried.current = edits;
            void refetch();
          }}
        />
      ) : null}
    </>
  );
}

interface CarriedEdits {
  opened: PlatformSupportSettings;
  draft: SupportSettingsDraft;
}

function SupportSettingsForm({
  settings,
  canManage,
  carried,
  onConflict,
}: {
  settings: PlatformSupportSettings;
  canManage: boolean;
  carried: CarriedEdits | null;
  onConflict: (edits: CarriedEdits) => void;
}) {
  const [draft, setDraft] = useState<SupportSettingsDraft>(() =>
    carried && carried.opened.version !== settings.version
      ? rebaseSupportSettingsDraft(carried.opened, carried.draft, settings)
      : supportSettingsDraft(settings),
  );
  const [errors, setErrors] = useState<SupportSettingsErrors>({});
  const [newHoliday, setNewHoliday] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [update] = useMutation<{ updatePlatformSupportSettings: PlatformSupportSettings }>(UPDATE_PLATFORM_SUPPORT_SETTINGS, {
    // The settings have no id, so the cache can't merge them by itself.
    update(cache, { data: answer }) {
      if (answer) cache.writeQuery({ query: PLATFORM_SUPPORT_SETTINGS, data: { platformSupportSettings: answer.updatePlatformSupportSettings } });
    },
  });

  const pending = supportSettingsPatch(settings, draft);
  // An emptied or broken field counts too, so the bar shows its error count.
  const isDirty = pending.changes > 0 || Object.keys(pending.errors).length > 0;
  const errorCount = Object.entries(errors).filter(([key, value]) => key !== "form" && !!value).length;
  const readOnly = !canManage || busy;

  const clearError = (...fields: string[]) =>
    setErrors((current) => {
      const next: SupportSettingsErrors = { ...current, form: undefined };
      for (const field of fields) next[field] = undefined;
      return next;
    });

  const setField = <K extends keyof SupportSettingsDraft>(field: K, value: SupportSettingsDraft[K], errorKey: string = field) => {
    setDraft((current) => ({ ...current, [field]: value }));
    clearError(errorKey);
  };

  const setDay = (index: number, patch: Partial<SupportSettingsDraft["days"][number]>) => {
    setDraft((current) => ({ ...current, days: current.days.map((day, at) => (at === index ? { ...day, ...patch } : day)) }));
    clearError(`calendar.weekly.${index}`);
  };

  const addDay = () => {
    if (!newHoliday) return;
    setField("holidays", addHoliday(draft.holidays, newHoliday), "calendar.holidays");
    setNewHoliday("");
  };

  const discard = () => {
    setDraft(supportSettingsDraft(settings));
    setErrors({});
    setNewHoliday("");
  };

  const save = async () => {
    const result = supportSettingsPatch(settings, draft);
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }
    if (!result.changes || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await update({ variables: { input: result.input } });
      addToast({ title: "Support settings saved. New promises apply to tickets raised from now on." });
    } catch (error) {
      const fields = supportSettingsErrorsFromServer(error);
      if (isSupportSettingsConflict(error)) {
        if (fields?.form) toastError(fields.form);
        // Load the version someone else saved, keeping this person's edits on top.
        onConflict({ opened: settings, draft });
      } else if (fields?.form && !Object.keys(fields).some((key) => key !== "form")) {
        toastError(fields.form);
      } else if (fields) setErrors(fields);
      else {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const numberInput = (
    field: "reopenReplyHours" | "autoCloseDays" | "reopenDays" | "waitingReminderWorkingDays",
    label: string,
    suffix: string,
    description: string,
  ) => (
    <Input
      id={`support-${field}`}
      label={label}
      type="number"
      inputMode={field === "reopenReplyHours" ? "decimal" : "numeric"}
      min={field === "reopenReplyHours" ? 0 : 1}
      step={field === "reopenReplyHours" ? "any" : "1"}
      value={draft[field]}
      onValueChange={(value) => setField(field, value)}
      description={description}
      endContent={<span className="text-label text-fg-subtle">{suffix}</span>}
      classNames={{ input: "num" }}
      isReadOnly={readOnly}
      isInvalid={!!errors[field]}
      errorMessage={errors[field]}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {!canManage ? <p className="text-label text-fg-muted">Changing support settings needs the support manage permission.</p> : null}
      {settings.updatedAt ? <p className="text-label text-fg-muted">Last saved {formatDateTime(settings.updatedAt)}</p> : null}

      <Card id="hours" title="Support hours" description="When the reply clock runs. Time outside these hours and on holidays doesn't count.">
        <div className="flex flex-col gap-4">
          <FieldGrid>
            <Input
              id="support-timezone"
              label="Time zone"
              value={draft.timezone}
              onValueChange={(value) => setField("timezone", value, "calendar.timezone")}
              description="An IANA name, such as Asia/Kolkata."
              isReadOnly={readOnly}
              isInvalid={!!errors["calendar.timezone"]}
              errorMessage={errors["calendar.timezone"]}
            />
          </FieldGrid>
          <ul className="divide-y divide-line-subtle rounded-xl border border-line">
            {WEEKDAY_LABELS.map((label, index) => {
              const day = draft.days[index];
              const dayError = errors[`calendar.weekly.${index}`];
              return (
                <li key={label} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
                  <div className="flex min-w-40 items-center gap-3">
                    <Switch
                      aria-label={`Open on ${label}`}
                      isSelected={day.isOpen}
                      isReadOnly={readOnly}
                      onValueChange={(on) => setDay(index, { isOpen: on })}
                    />
                    <span className={cx("text-body", day.isOpen ? "text-fg" : "text-fg-muted")}>{label}</span>
                  </div>
                  {day.isOpen ? (
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`${label} opens at`}
                        size="sm"
                        type="time"
                        step={60}
                        className="w-32"
                        classNames={{ input: "num" }}
                        value={day.open}
                        onValueChange={(value) => setDay(index, { open: value })}
                        isReadOnly={readOnly}
                        isInvalid={!!dayError}
                      />
                      <span className="text-label text-fg-muted">to</span>
                      <Input
                        aria-label={`${label} closes at`}
                        size="sm"
                        type="time"
                        step={60}
                        className="w-32"
                        classNames={{ input: "num" }}
                        value={day.close}
                        onValueChange={(value) => setDay(index, { close: value })}
                        isReadOnly={readOnly}
                        isInvalid={!!dayError}
                      />
                    </div>
                  ) : (
                    <span className="text-label text-fg-muted">Closed</span>
                  )}
                  {dayError ? <p className="w-full text-caption text-tone-danger-text">{dayError}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <Card id="holidays" title="Holidays" description="Days the reply clock doesn't run, except for urgent tickets.">
        <div className="flex flex-col gap-3">
          {draft.holidays.length ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Holidays">
              {draft.holidays.map((day) => (
                <FilterChip
                  key={day}
                  removeLabel={`Remove the holiday on ${formatDate(day)}`}
                  onRemove={() => {
                    if (!readOnly) setField("holidays", draft.holidays.filter((entry) => entry !== day), "calendar.holidays");
                  }}
                >
                  {formatDate(day)}
                </FilterChip>
              ))}
            </div>
          ) : (
            <p className="text-label text-fg-muted">No holidays yet.</p>
          )}
          {!readOnly ? (
            <div className="flex items-center gap-2">
              <Input
                id="support-new-holiday"
                aria-label="New holiday"
                size="sm"
                type="date"
                className="w-48"
                value={newHoliday}
                onValueChange={setNewHoliday}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDay();
                  }
                }}
              />
              <Button variant="ghost" size="sm" startIcon={<IconAdd aria-hidden />} onPress={addDay} isDisabled={!newHoliday}>
                Add holiday
              </Button>
            </div>
          ) : null}
          {errors["calendar.holidays"] ? <p className="text-caption text-tone-danger-text">{errors["calendar.holidays"]}</p> : null}
        </div>
      </Card>

      <Card id="first-reply" title="First reply" description="How soon support answers a new ticket, per priority. A plan's own promise wins over these.">
        <FieldGrid>
          {REPLY_PRIORITIES.map((priority) => {
            const key = `firstReplyHours.${priority.key}`;
            return (
              <Input
                key={priority.key}
                id={`support-first-reply-${priority.key.toLowerCase()}`}
                label={priority.label}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={draft.firstReplyHours[priority.key]}
                onValueChange={(value) => {
                  setDraft((current) => ({ ...current, firstReplyHours: { ...current.firstReplyHours, [priority.key]: value } }));
                  clearError(key);
                }}
                description={priority.description}
                endContent={<span className="text-label text-fg-subtle">h</span>}
                classNames={{ input: "num" }}
                isReadOnly={readOnly}
                isInvalid={!!errors[key]}
                errorMessage={errors[key]}
              />
            );
          })}
          {numberInput("reopenReplyHours", "After a reopen", "h", "Working hours to answer a ticket the store reopened.")}
        </FieldGrid>
      </Card>

      <Card id="closing" title="Resolved and closed tickets" description="The store confirms a fix, or the ticket closes by itself.">
        <FieldGrid>
          {numberInput("autoCloseDays", "Close automatically after", "days", "Days after Resolve with no answer from the store.")}
          <Input
            id="support-reminderDays"
            label="Remind the store on days"
            value={draft.reminderDays}
            onValueChange={(value) => setField("reminderDays", value)}
            description="Days after Resolve, separated by commas, before the auto-close day."
            classNames={{ input: "num" }}
            isReadOnly={readOnly}
            isInvalid={!!errors.reminderDays}
            errorMessage={errors.reminderDays}
          />
          {numberInput("reopenDays", "Reopen window", "days", "After this the store raises a follow-up instead.")}
          {numberInput(
            "waitingReminderWorkingDays",
            "Remind a store that owes a reply after",
            "working days",
            "While a ticket waits on the store.",
          )}
          <p className={cx(fieldSpanFull, "text-caption text-fg-muted")}>Every change is recorded in the audit log.</p>
        </FieldGrid>
      </Card>

      {canManage ? (
        <SettingsSaveBar
          isDirty={isDirty}
          onDiscard={discard}
          onSave={() => void save()}
          isSaving={busy}
          dirtyCount={pending.changes || undefined}
          errorCount={errorCount}
        />
      ) : null}
    </div>
  );
}
