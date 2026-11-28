/**
 * Console › Messaging pop-ups (backend PRD-050 FR-1.1, FR-1.2, FR-1.10):
 * - Complete a task: the per-type form (CREATE_CHILD the child's MSG91 id,
 *   ADD_EMAIL_DOMAIN the DNS records MSG91 shows, VERIFY_EMAIL_DOMAIN a
 *   confirmation; every type an optional note).
 * - Reject a task, with the reason.
 * - Create messaging account: an explicit per-store confirmation (never
 *   automatic, D19), with the mobile when the add_client API is on.
 * - Connect / update credentials: the child's id, auth key and SMTP login.
 *   The key and password fields are password inputs, never prefilled and
 *   cleared after every submit; the API never returns them. Connecting runs
 *   MSG91's live check and never turns sending on.
 * - KYC and hourly limit (D21): MSG91's KYC state of the store's account
 *   (a refusal needs a note the store sees) and its hourly email limit.
 * - WhatsApp (backend PRD-051 FR-1): WHATSAPP_ONBOARD completion (the
 *   connected number, WABA id, display name, Meta's approval of it) and the
 *   WhatsApp number dialog (status, health, Zerror's note; "Refresh health"
 *   from MSG91). Every change is audited by the server.
 * All need platform:messaging:manage; the server checks again.
 */
import { useMutation } from "@apollo/client";
import { useState } from "react";
import {
  Button,
  Checkbox,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  PopupTitle,
  Select,
  SelectItem,
  Switch,
  Textarea,
  toast,
  toastError,
} from "../ui";
import { IconAdd, IconCheck, IconDelete, IconDuplicate, IconInfo, IconLock, IconMessages, IconWarning } from "../ui/icons";
import {
  COMPLETE_MESSAGING_TASK,
  CONNECT_MESSAGING_ACCOUNT,
  CREATE_MESSAGING_CHILD_ACCOUNT,
  REJECT_MESSAGING_TASK,
  REFRESH_MESSAGING_WHATSAPP_HEALTH,
  SET_MESSAGING_ACCOUNT_KYC,
  SET_MESSAGING_HOURLY_EMAIL_LIMIT,
  UPDATE_MESSAGING_WHATSAPP_NUMBER,
} from "../../graphql/messaging";
import {
  ACCOUNT_KIND_LABEL,
  ACCOUNT_STATE_LABEL,
  DNS_RECORDS_MAX,
  DNS_RECORD_PURPOSES,
  DNS_RECORD_TYPES,
  KYC_STATUS_LABEL,
  MESSAGING_NOTE_MAX_CHARS,
  SEND_MODE_LABEL,
  TASK_TYPE_HINT,
  TASK_TYPE_LABEL,
  completeTaskDraftOf,
  completeTaskInputOf,
  connectDraftOf,
  connectInputOf,
  createChildInputOf,
  emailSendModeEnum,
  emptyDnsRecord,
  hourlyLimitError,
  kycChangeError,
  messagingKycStatusEnum,
  messagingAccountKindEnum,
  messagingFailureCopy,
  messagingFieldErrorsFromServer,
  messagingTaskTypeEnum,
  shouldReloadMessagingAfter,
  validateCompleteTask,
  validateConnectDraft,
  validateCreateChild,
  validateWhatsAppEdit,
  whatsAppEditDraftOf,
  whatsAppEditInputOf,
  whatsAppStatusChip,
  WHATSAPP_LIMIT_LABEL,
  WHATSAPP_LIMIT_TIERS,
  WHATSAPP_NUMBER_STATUSES,
  WHATSAPP_QUALITIES,
  WHATSAPP_QUALITY_LABEL,
  WHATSAPP_REVIEW_STATES,
  WHATSAPP_STATUS_LABEL,
  WHATSAPP_VERIFICATIONS,
  withoutSecrets,
  type WhatsAppEditDraft,
  type CompleteTaskDraft,
  type ConnectDraft,
  type CreateChildDraft,
  type DnsRecordDraft,
  type DnsRecordPurpose,
  type DnsRecordType,
  type EmailSendMode,
  type MessagingAccount,
  type MessagingAccountKind,
  type MessagingKycStatus,
  type MessagingTask,
} from "../../lib/platform-messaging.util";

type Errors = Record<string, string | undefined>;

function fail(error: unknown) {
  const message = messagingFailureCopy(error);
  if (message) toastError(message);
}

function clearKeys(errors: Errors, keys: string[]): Errors {
  const next: Errors = { ...errors, form: undefined };
  for (const key of keys) next[key] = undefined;
  return next;
}

/** Each opening starts from `fresh()`; keeps the hook order fixed. */
function useResetOnOpen(isOpen: boolean, reset: () => void) {
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) reset();
  }
}

// ─── Copy value ───────────────────────────────────────────────────────────

/** A value to copy into MSG91's panel: label, the value in mono, a copy button. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => toastError("Couldn't copy. Select the text instead."));
  };
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-label text-fg-muted">{label}</p>
        <p className="break-all font-mono text-body text-fg">{value}</p>
      </div>
      <IconButton aria-label={copied ? `${label} copied` : `Copy ${label}`} size="sm" variant="ghost" onPress={copy}>
        {copied ? <IconCheck aria-hidden className="size-4" /> : <IconDuplicate aria-hidden className="size-4" />}
      </IconButton>
    </div>
  );
}

// ─── Complete task ────────────────────────────────────────────────────────

export interface CompleteTaskDialogProps {
  task: MessagingTask;
  isOpen: boolean;
  onClose: () => void;
  refetchQueries: string[];
}

export function CompleteTaskDialog({ task, isOpen, onClose, refetchQueries }: CompleteTaskDialogProps) {
  const [draft, setDraft] = useState<CompleteTaskDraft>(completeTaskDraftOf);
  const [errors, setErrors] = useState<Errors>({});
  const [complete, { loading }] = useMutation(COMPLETE_MESSAGING_TASK, { refetchQueries });
  useResetOnOpen(isOpen, () => {
    setDraft(completeTaskDraftOf(task));
    setErrors({});
  });

  const change = (patch: Partial<CompleteTaskDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => clearKeys(current, Object.keys(patch)));
  };

  const changeRecord = (index: number, patch: Partial<DnsRecordDraft>) => {
    setDraft((current) => ({
      ...current,
      records: current.records.map((record, at) => (at === index ? { ...record, ...patch } : record)),
    }));
    setErrors((current) => clearKeys(current, ["records", ...Object.keys(patch).map((key) => `records.${index}.${key}`)]));
  };

  const removeRecord = (index: number) => {
    setDraft((current) => ({ ...current, records: current.records.filter((_, at) => at !== index) }));
    // Row numbers move, so old row errors no longer point at the right row.
    setErrors({});
  };

  const submit = async () => {
    const found = validateCompleteTask(task, draft);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    try {
      await complete({ variables: { id: task.id, input: completeTaskInputOf(task, draft) } });
      toast.success(`${TASK_TYPE_LABEL[task.type]} marked done for ${task.storeName || task.slug}`);
      onClose();
    } catch (error) {
      const fields = messagingFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(error);
      if (shouldReloadMessagingAfter(error)) onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={task.type === messagingTaskTypeEnum.ADD_EMAIL_DOMAIN ? "lg" : "md"}>
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconCheck aria-hidden />}>Mark done: {TASK_TYPE_LABEL[task.type]}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-label text-fg-muted">
              {task.storeName || task.slug}
              {task.subject ? ` · ${task.subject}` : ""} · {TASK_TYPE_HINT[task.type]}
            </p>

            {task.type === messagingTaskTypeEnum.CREATE_CHILD ? (
              <Input
                label="Child account's MSG91 id"
                isRequired
                value={draft.childId}
                onValueChange={(childId) => change({ childId })}
                isInvalid={!!errors.childId}
                errorMessage={errors.childId}
                description="Opens the Connect step next."
              />
            ) : null}

            {task.type === messagingTaskTypeEnum.ADD_EMAIL_DOMAIN ? (
              <DnsRecordsForm records={draft.records} errors={errors} onChange={changeRecord} onRemove={removeRecord}
                onAdd={() => change({ records: [...draft.records, emptyDnsRecord()] })} domain={task.subject} />
            ) : null}

            {task.type === messagingTaskTypeEnum.VERIFY_EMAIL_DOMAIN ? (
              <div>
                <Checkbox isSelected={draft.msg91Verified} onValueChange={(msg91Verified) => change({ msg91Verified })}>
                  MSG91 shows {task.subject || "the domain"} as verified
                </Checkbox>
                {errors.msg91Verified ? <p className="mt-1 text-label text-tone-danger-text">{errors.msg91Verified}</p> : null}
              </div>
            ) : null}

            {task.type === messagingTaskTypeEnum.WHATSAPP_ONBOARD ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Connected number"
                    description="With the country code, as MSG91 shows it"
                    isRequired
                    inputMode="tel"
                    value={draft.whatsappNumber}
                    onValueChange={(whatsappNumber) => change({ whatsappNumber })}
                    isInvalid={!!errors.whatsappNumber}
                    errorMessage={errors.whatsappNumber}
                  />
                  <Input
                    label="WhatsApp Business Account id"
                    isRequired
                    value={draft.wabaId}
                    onValueChange={(wabaId) => change({ wabaId })}
                    isInvalid={!!errors.wabaId}
                    errorMessage={errors.wabaId}
                  />
                </div>
                <Input
                  label="Display name"
                  isRequired
                  value={draft.displayName}
                  onValueChange={(displayName) => change({ displayName })}
                  isInvalid={!!errors.displayName}
                  errorMessage={errors.displayName}
                />
                <Checkbox isSelected={draft.displayNameApproved} onValueChange={(displayNameApproved) => change({ displayNameApproved })}>
                  Meta already approved the display name (the number goes live now; else it waits in Meta review)
                </Checkbox>
              </div>
            ) : null}

            <Textarea
              label="Note (optional)"
              minRows={2}
              maxLength={MESSAGING_NOTE_MAX_CHARS}
              value={draft.note}
              onValueChange={(note) => change({ note })}
              isInvalid={!!errors.note}
              errorMessage={errors.note}
            />
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

interface DnsRecordsFormProps {
  records: DnsRecordDraft[];
  errors: Errors;
  domain: string;
  onChange: (index: number, patch: Partial<DnsRecordDraft>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

/** One block per record MSG91 shows; hosts may be relative to the domain. */
function DnsRecordsForm({ records, errors, domain, onChange, onRemove, onAdd }: DnsRecordsFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-fg-muted">
        Copy each record exactly as MSG91 shows it. A host like <span className="font-mono">k1._domainkey</span> is read
        under {domain || "the domain"}.
      </p>
      {records.map((record, index) => (
        <fieldset key={index} className="rounded-xl border border-line p-3">
          <legend className="px-1 text-label text-fg-muted">Record {index + 1}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Select
              className="sm:col-span-2"
              label="Type"
              selectedKeys={new Set([record.type])}
              disallowEmptySelection
              onSelectionChange={(keys) => onChange(index, { type: String(Array.from(keys)[0]) as DnsRecordType })}
              isInvalid={!!errors[`records.${index}.type`]}
              errorMessage={errors[`records.${index}.type`]}
            >
              {DNS_RECORD_TYPES.map((type) => (
                <SelectItem key={type}>{type}</SelectItem>
              ))}
            </Select>
            <Select
              className="sm:col-span-2"
              label="Purpose"
              selectedKeys={new Set([record.purpose])}
              disallowEmptySelection
              onSelectionChange={(keys) => onChange(index, { purpose: String(Array.from(keys)[0]) as DnsRecordPurpose })}
            >
              {DNS_RECORD_PURPOSES.map((purpose) => (
                <SelectItem key={purpose}>{purpose.replace("_", " ")}</SelectItem>
              ))}
            </Select>
            {record.type === "MX" ? (
              <Input
                className="sm:col-span-2"
                label="Priority"
                inputMode="numeric"
                value={record.priority}
                onValueChange={(priority) => onChange(index, { priority })}
                isInvalid={!!errors[`records.${index}.priority`]}
                errorMessage={errors[`records.${index}.priority`]}
              />
            ) : (
              <div className="flex items-center sm:col-span-2">
                <Switch isSelected={record.required} onValueChange={(required) => onChange(index, { required })}>
                  Required
                </Switch>
              </div>
            )}
            <Input
              className="sm:col-span-6"
              label="Host"
              isRequired
              value={record.host}
              onValueChange={(host) => onChange(index, { host })}
              isInvalid={!!errors[`records.${index}.host`]}
              errorMessage={errors[`records.${index}.host`]}
            />
            <Textarea
              className="sm:col-span-6"
              label="Value"
              isRequired
              minRows={2}
              classNames={{ input: "font-mono" }}
              value={record.value}
              onValueChange={(value) => onChange(index, { value })}
              isInvalid={!!errors[`records.${index}.value`]}
              errorMessage={errors[`records.${index}.value`]}
            />
          </div>
          {records.length > 1 ? (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" startIcon={<IconDelete aria-hidden className="size-4" />} onPress={() => onRemove(index)}>
                Remove record {index + 1}
              </Button>
            </div>
          ) : null}
        </fieldset>
      ))}
      {errors.records ? <p className="text-label text-tone-danger-text">{errors.records}</p> : null}
      <div>
        <Button
          variant="secondary"
          size="sm"
          startIcon={<IconAdd aria-hidden className="size-4" />}
          onPress={onAdd}
          isDisabled={records.length >= DNS_RECORDS_MAX}
        >
          Add record
        </Button>
      </div>
    </div>
  );
}

// ─── Reject task ──────────────────────────────────────────────────────────

export function RejectTaskDialog({ task, isOpen, onClose, refetchQueries }: CompleteTaskDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [reject, { loading }] = useMutation(REJECT_MESSAGING_TASK, { refetchQueries });
  useResetOnOpen(isOpen, () => {
    setReason("");
    setError(undefined);
  });

  const submit = async () => {
    const why = reason.trim();
    if (!why) {
      setError("Say why the step was rejected");
      return;
    }
    if (why.length > MESSAGING_NOTE_MAX_CHARS) {
      setError(`Keep the reason under ${MESSAGING_NOTE_MAX_CHARS} characters`);
      return;
    }
    try {
      await reject({ variables: { id: task.id, reason: why } });
      toast.success("Step rejected");
      onClose();
    } catch (failure) {
      const fields = messagingFieldErrorsFromServer(failure);
      if (fields) {
        setError(fields.reason ?? fields.form);
        return;
      }
      fail(failure);
      if (shouldReloadMessagingAfter(failure)) onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconWarning aria-hidden />}>Reject: {TASK_TYPE_LABEL[task.type]}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <p className="text-label text-fg-muted">{task.storeName || task.slug}</p>
            <Textarea
              label="Reason"
              isRequired
              minRows={3}
              maxLength={MESSAGING_NOTE_MAX_CHARS}
              value={reason}
              onValueChange={(value) => {
                setReason(value);
                setError(undefined);
              }}
              isInvalid={!!error}
              errorMessage={error}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="danger" isLoading={loading} onPress={() => void submit()}>
            Reject
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Store picker ─────────────────────────────────────────────────────────

export interface StoreOption {
  id: string;
  name: string;
}

function StorePicker({
  stores,
  value,
  onChange,
  error,
}: {
  stores: StoreOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  return (
    <Select
      label="Store"
      isRequired
      placeholder="Pick a store"
      selectedKeys={value ? new Set([value]) : new Set<string>()}
      onSelectionChange={(keys) => onChange(String(Array.from(keys)[0] ?? ""))}
      isInvalid={!!error}
      errorMessage={error}
    >
      {stores.map((store) => (
        <SelectItem key={store.id}>{store.name}</SelectItem>
      ))}
    </Select>
  );
}

// ─── Create messaging account ─────────────────────────────────────────────

export interface CreateAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** A fixed store (from its row), else the picker shows `stores`. */
  store: StoreOption | null;
  stores: StoreOption[];
  addClientApiEnabled: boolean;
  refetchQueries: string[];
}

export function CreateAccountDialog({ isOpen, onClose, store, stores, addClientApiEnabled, refetchQueries }: CreateAccountDialogProps) {
  const [tenantId, setTenantId] = useState(store?.id ?? "");
  const [draft, setDraft] = useState<CreateChildDraft>({ mobile: "", companyName: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [create, { loading }] = useMutation(CREATE_MESSAGING_CHILD_ACCOUNT, { refetchQueries });
  useResetOnOpen(isOpen, () => {
    setTenantId(store?.id ?? "");
    setDraft({ mobile: "", companyName: "" });
    setConfirmed(false);
    setErrors({});
  });
  const storeName = store?.name ?? stores.find((one) => one.id === tenantId)?.name ?? "";

  const submit = async () => {
    const found: Errors = { ...validateCreateChild(draft, addClientApiEnabled) };
    if (!tenantId) found.tenantId = "Pick a store";
    if (!confirmed) found.confirmed = "Confirm this store's owner said yes";
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    try {
      await create({ variables: { tenantId, input: createChildInputOf(draft) } });
      toast.success(
        addClientApiEnabled
          ? `MSG91 account created for ${storeName}. Connect it next.`
          : `Account requested for ${storeName}. A Create task is in the queue.`,
      );
      onClose();
    } catch (error) {
      const fields = messagingFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconMessages aria-hidden />}>Create messaging account</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {store ? (
              <p className="text-body font-medium text-fg">{store.name}</p>
            ) : (
              <StorePicker
                stores={stores}
                value={tenantId}
                onChange={(id) => {
                  setTenantId(id);
                  setErrors((current) => clearKeys(current, ["tenantId"]));
                }}
                error={errors.tenantId}
              />
            )}
            <p className="flex gap-2 rounded-xl bg-tone-info-soft px-3 py-2 text-label text-fg">
              <IconInfo aria-hidden className="mt-0.5 size-4 shrink-0" />
              {addClientApiEnabled
                ? "ZCOM creates the child account in MSG91 now, through the add_client API."
                : "This opens a Create task in the work queue with every value to copy into MSG91. Nothing is created in MSG91 by itself."}
            </p>
            {addClientApiEnabled ? (
              <>
                <Input
                  label="Mobile, with country code"
                  isRequired
                  type="tel"
                  placeholder="+91…"
                  value={draft.mobile}
                  onValueChange={(mobile) => {
                    setDraft((current) => ({ ...current, mobile }));
                    setErrors((current) => clearKeys(current, ["mobile"]));
                  }}
                  isInvalid={!!errors.mobile}
                  errorMessage={errors.mobile}
                />
                <Input
                  label="Company name (optional)"
                  description="Defaults to the store's name."
                  value={draft.companyName}
                  onValueChange={(companyName) => setDraft((current) => ({ ...current, companyName }))}
                />
              </>
            ) : null}
            <div>
              <Checkbox
                isSelected={confirmed}
                onValueChange={(value) => {
                  setConfirmed(value);
                  setErrors((current) => clearKeys(current, ["confirmed"]));
                }}
              >
                The owner said yes to an MSG91 account for {storeName || "this store"}
              </Checkbox>
              {errors.confirmed ? <p className="mt-1 text-label text-tone-danger-text">{errors.confirmed}</p> : null}
            </div>
            {/* The add_client switch may have changed since this page loaded. */}
            {!addClientApiEnabled && errors.mobile ? <p className="text-label text-tone-danger-text">{errors.mobile}</p> : null}
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            Create account
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Connect / update credentials ─────────────────────────────────────────

export interface ConnectAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The stored account (prefills everything but the secrets), or null for a new one. */
  account: MessagingAccount | null;
  /** A fixed store (from a row or task), else the picker shows `stores`. */
  store: StoreOption | null;
  stores: StoreOption[];
  refetchQueries: string[];
}

export function ConnectAccountDialog({ isOpen, onClose, account, store, stores, refetchQueries }: ConnectAccountDialogProps) {
  const [tenantId, setTenantId] = useState(store?.id ?? "");
  const [draft, setDraft] = useState<ConnectDraft>(() => connectDraftOf(account));
  const [errors, setErrors] = useState<Errors>({});
  const [connect, { loading }] = useMutation(CONNECT_MESSAGING_ACCOUNT, { refetchQueries });
  useResetOnOpen(isOpen, () => {
    setTenantId(store?.id ?? "");
    setDraft(connectDraftOf(account));
    setErrors({});
  });

  const change = (patch: Partial<ConnectDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => clearKeys(current, Object.keys(patch)));
  };

  const close = () => {
    // Never keep a typed secret in memory once the pop-up closes.
    setDraft((current) => withoutSecrets(current));
    onClose();
  };

  const submit = async () => {
    const found: Errors = { ...validateConnectDraft(draft) };
    if (!tenantId) found.tenantId = "Pick a store";
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    const input = connectInputOf(draft);
    // The secrets leave the form with this submit, whatever MSG91 answers.
    setDraft((current) => withoutSecrets(current));
    try {
      const { data } = await connect({ variables: { tenantId, input } });
      const result = data?.connectMessagingAccount as MessagingAccount | null | undefined;
      if (result?.state === "ACTIVE") {
        toast.success(`${result.storeName || "The store"}'s MSG91 account passed its check. Sending stays off.`);
        onClose();
      } else {
        setErrors({ form: `MSG91's check failed: ${result?.failureReason || result?.lastTestMessage || "no answer"}. Saved; fix it and connect again.` });
      }
    } catch (error) {
      const fields = messagingFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconLock aria-hidden />}>{account ? "Update MSG91 credentials" : "Connect MSG91 account"}</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {store ? (
              <p className="text-body font-medium text-fg">
                {store.name}
                {account ? <span className="text-label text-fg-muted"> · {ACCOUNT_STATE_LABEL[account.state]}</span> : null}
              </p>
            ) : (
              <StorePicker
                stores={stores}
                value={tenantId}
                onChange={(id) => {
                  setTenantId(id);
                  setErrors((current) => clearKeys(current, ["tenantId"]));
                }}
                error={errors.tenantId}
              />
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Account kind"
                selectedKeys={new Set([draft.kind])}
                disallowEmptySelection
                onSelectionChange={(keys) => change({ kind: String(Array.from(keys)[0]) as MessagingAccountKind })}
                isInvalid={!!errors.kind}
                errorMessage={errors.kind}
              >
                {Object.values(messagingAccountKindEnum).map((kind) => (
                  <SelectItem key={kind}>{ACCOUNT_KIND_LABEL[kind]}</SelectItem>
                ))}
              </Select>
              <Input
                label="MSG91 child id"
                value={draft.childId}
                onValueChange={(childId) => change({ childId })}
                isInvalid={!!errors.childId}
                errorMessage={errors.childId}
              />
              <Input
                className="sm:col-span-2"
                label="Auth key"
                type="password"
                autoComplete="off"
                placeholder={account?.hasAuthKey ? "Saved. Type a new one to replace it" : "From the child's MSG91 panel"}
                value={draft.authKey}
                onValueChange={(authKey) => change({ authKey })}
                isInvalid={!!errors.authKey}
                errorMessage={errors.authKey}
              />
              <Select
                label="Send email by"
                selectedKeys={new Set([draft.sendMode])}
                disallowEmptySelection
                onSelectionChange={(keys) => change({ sendMode: String(Array.from(keys)[0]) as EmailSendMode })}
                isInvalid={!!errors.sendMode}
                errorMessage={errors.sendMode}
              >
                {Object.values(emailSendModeEnum).map((mode) => (
                  <SelectItem key={mode}>{SEND_MODE_LABEL[mode]}</SelectItem>
                ))}
              </Select>
              {draft.sendMode === emailSendModeEnum.HTTP_API ? (
                <Input
                  label="MSG91 template id"
                  description="The template whose body is {{body}}."
                  value={draft.httpTemplateId}
                  onValueChange={(httpTemplateId) => change({ httpTemplateId })}
                  isInvalid={!!errors.httpTemplateId}
                  errorMessage={errors.httpTemplateId}
                />
              ) : (
                <div className="hidden sm:block" />
              )}
              {draft.sendMode === emailSendModeEnum.SMTP ? (
                <>
                  <Input
                    label="SMTP host"
                    placeholder="smtp.mailer91.com"
                    value={draft.smtpHost}
                    onValueChange={(smtpHost) => change({ smtpHost })}
                    isInvalid={!!errors.smtpHost}
                    errorMessage={errors.smtpHost}
                  />
                  <Input
                    label="SMTP port"
                    inputMode="numeric"
                    placeholder="587"
                    value={draft.smtpPort}
                    onValueChange={(smtpPort) => change({ smtpPort })}
                    isInvalid={!!errors.smtpPort}
                    errorMessage={errors.smtpPort}
                  />
                  <Input
                    label="SMTP username"
                    autoComplete="off"
                    placeholder={account?.hasSmtpLogin ? "Saved. Type a new login to replace it" : undefined}
                    value={draft.smtpUsername}
                    onValueChange={(smtpUsername) => change({ smtpUsername })}
                    isInvalid={!!errors.smtpUsername}
                    errorMessage={errors.smtpUsername}
                  />
                  <Input
                    label="SMTP password"
                    type="password"
                    autoComplete="new-password"
                    value={draft.smtpPassword}
                    onValueChange={(smtpPassword) => change({ smtpPassword })}
                    isInvalid={!!errors.smtpPassword}
                    errorMessage={errors.smtpPassword}
                  />
                </>
              ) : null}
            </div>
            <Checkbox isSelected={draft.sharedDomainVerified} onValueChange={(sharedDomainVerified) => change({ sharedDomainVerified })}>
              mail.zerrorstudios.com is verified in this account
            </Checkbox>
            <p className="flex gap-2 rounded-xl bg-tone-info-soft px-3 py-2 text-label text-fg">
              <IconInfo aria-hidden className="mt-0.5 size-4 shrink-0" />
              The key and password are sealed as soon as they arrive and are never shown again. Blank fields keep what is
              saved. Connecting runs MSG91's check; it never turns sending on.
            </p>
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={close}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void submit()}>
            {account ? "Save and check" : "Connect and check"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── KYC and hourly limit (D21) ───────────────────────────────────────────

export interface AccountKycDialogProps {
  account: MessagingAccount;
  isOpen: boolean;
  onClose: () => void;
  refetchQueries: string[];
}

/**
 * D21: MSG91's KYC of the store's sub-account (APPROVED closes the KYC task
 * and lets sending be switched on; SUBMITTED / REJECTED keep it open) and
 * the account's hourly email limit (500 until MSG91 raises it). Each is its
 * own audited mutation, sent only when it changed.
 */
export function AccountKycDialog({ account, isOpen, onClose, refetchQueries }: AccountKycDialogProps) {
  const [status, setStatus] = useState<MessagingKycStatus>(account.kycStatus);
  const [note, setNote] = useState(account.kycNote ?? "");
  const [limit, setLimit] = useState(String(account.hourlyEmailLimit));
  const [errors, setErrors] = useState<Errors>({});
  const [setKyc, kycState] = useMutation(SET_MESSAGING_ACCOUNT_KYC, { refetchQueries });
  const [setLimitMutation, limitState] = useMutation(SET_MESSAGING_HOURLY_EMAIL_LIMIT, { refetchQueries });
  useResetOnOpen(isOpen, () => {
    setStatus(account.kycStatus);
    setNote(account.kycNote ?? "");
    setLimit(String(account.hourlyEmailLimit));
    setErrors({});
  });

  const kycChanged = status !== account.kycStatus || note.trim() !== (account.kycNote ?? "");
  const limitChanged = limit.trim() !== String(account.hourlyEmailLimit);

  const submit = async () => {
    const found: Errors = {
      note: kycChanged ? (kycChangeError(status, note) ?? undefined) : undefined,
      hourlyEmailLimit: limitChanged ? (hourlyLimitError(limit) ?? undefined) : undefined,
    };
    if (note.length > MESSAGING_NOTE_MAX_CHARS) found.note = `Keep the note under ${MESSAGING_NOTE_MAX_CHARS} characters`;
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    try {
      if (kycChanged) {
        await setKyc({ variables: { tenantId: account.tenantId, status, note: note.trim() || null } });
      }
      if (limitChanged) {
        await setLimitMutation({ variables: { tenantId: account.tenantId, hourlyEmailLimit: Number(limit.trim()) } });
      }
      if (kycChanged || limitChanged) toast.success("Account saved");
      onClose();
    } catch (failure) {
      const fields = messagingFieldErrorsFromServer(failure);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(failure);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconLock aria-hidden />}>KYC and hourly limit</PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-label text-fg-muted">{account.storeName || account.slug}</p>
            <Select
              label="MSG91 KYC"
              selectedKeys={new Set([status])}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                setStatus(String(Array.from(keys)[0]) as MessagingKycStatus);
                setErrors(clearKeys(errors, ["note", "status"]));
              }}
              isInvalid={!!errors.status}
              errorMessage={errors.status}
            >
              {Object.values(messagingKycStatusEnum).map((value) => (
                <SelectItem key={value}>{KYC_STATUS_LABEL[value]}</SelectItem>
              ))}
            </Select>
            <Textarea
              label={status === messagingKycStatusEnum.REJECTED ? "What MSG91 refused (the store sees it)" : "Note"}
              isRequired={status === messagingKycStatusEnum.REJECTED}
              minRows={2}
              maxLength={MESSAGING_NOTE_MAX_CHARS}
              value={note}
              onValueChange={(value) => {
                setNote(value);
                setErrors(clearKeys(errors, ["note"]));
              }}
              isInvalid={!!errors.note}
              errorMessage={errors.note}
            />
            <Input
              label="Emails an hour"
              description="MSG91 starts every account at 500 an hour. Raise it only when MSG91 has."
              inputMode="numeric"
              value={limit}
              onValueChange={(value) => {
                setLimit(value);
                setErrors(clearKeys(errors, ["hourlyEmailLimit"]));
              }}
              isInvalid={!!errors.hourlyEmailLimit}
              errorMessage={errors.hourlyEmailLimit}
            />
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!kycChanged && !limitChanged}
            isLoading={kycState.loading || limitState.loading}
            onPress={() => void submit()}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── WhatsApp number (PRD-051 FR-1) ───────────────────────────────────────

export interface WhatsAppNumberDialogProps {
  account: MessagingAccount;
  isOpen: boolean;
  onClose: () => void;
  refetchQueries: string[];
}

function EnumSelect({
  label,
  values,
  value,
  labels,
  onChange,
}: {
  label: string;
  values: readonly string[];
  value: string;
  labels?: Readonly<Record<string, string>>;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      label={label}
      selectedKeys={new Set([value])}
      disallowEmptySelection
      onSelectionChange={(keys) => onChange(String(Array.from(keys)[0]))}
    >
      {values.map((item) => (
        <SelectItem key={item}>{labels?.[item] ?? item.replace(/_/g, " ").toLowerCase()}</SelectItem>
      ))}
    </Select>
  );
}

/**
 * A store's WhatsApp number: its status (CONNECTING once the guided session
 * is booked), the number, WABA id, display name and Meta's review, business
 * verification, limit tier, quality and a note the store sees. "Refresh
 * health" reads MSG91 now; a drop alerts the store and the console.
 */
export function WhatsAppNumberDialog({ account, isOpen, onClose, refetchQueries }: WhatsAppNumberDialogProps) {
  const [draft, setDraft] = useState<WhatsAppEditDraft>(() => whatsAppEditDraftOf(account.whatsapp));
  const [errors, setErrors] = useState<Errors>({});
  const [update, { loading }] = useMutation(UPDATE_MESSAGING_WHATSAPP_NUMBER, { refetchQueries });
  const [refresh, { loading: refreshing }] = useMutation(REFRESH_MESSAGING_WHATSAPP_HEALTH, { refetchQueries });
  useResetOnOpen(isOpen, () => {
    setDraft(whatsAppEditDraftOf(account.whatsapp));
    setErrors({});
  });

  const change = (patch: Partial<WhatsAppEditDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => clearKeys(current, Object.keys(patch)));
  };

  const save = async () => {
    const found = validateWhatsAppEdit(draft);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    const input = whatsAppEditInputOf(draft, account.whatsapp);
    if (!input) {
      onClose();
      return;
    }
    try {
      await update({ variables: { tenantId: account.tenantId, input } });
      toast.success(`WhatsApp number saved for ${account.storeName || account.slug}`);
      onClose();
    } catch (error) {
      const fields = messagingFieldErrorsFromServer(error);
      if (fields) {
        setErrors(fields);
        return;
      }
      fail(error);
    }
  };

  const runRefresh = async () => {
    try {
      const { data } = await refresh({ variables: { tenantId: account.tenantId } });
      const next = data?.refreshMessagingWhatsAppHealth?.whatsapp;
      if (next?.healthError) toastError(`MSG91: ${next.healthError}`);
      else toast.success("Health read from MSG91");
      if (next) setDraft(whatsAppEditDraftOf(next));
    } catch (error) {
      fail(error);
    }
  };

  const chip = whatsAppStatusChip(account.whatsapp?.status);
  const wa = account.whatsapp;
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>
          <PopupTitle icon={<IconMessages aria-hidden />} description={`${account.storeName || account.slug} · ${chip.label}`}>
            WhatsApp number
          </PopupTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {wa?.requestedNumber || wa?.requestedDisplayName ? (
              <p className="text-label text-fg-muted">
                The store asked for {wa.requestedNumber ? `+${wa.requestedNumber}` : "a number"}
                {wa.requestedDisplayName ? ` as "${wa.requestedDisplayName}"` : ""}.
              </p>
            ) : null}
            {wa?.healthError ? (
              <p className="flex items-start gap-2 text-label text-tone-warning">
                <IconWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
                Last refresh: {wa.healthError}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EnumSelect
                label="Status"
                values={WHATSAPP_NUMBER_STATUSES}
                value={draft.status}
                labels={WHATSAPP_STATUS_LABEL}
                onChange={(status) => change({ status: status as WhatsAppEditDraft["status"] })}
              />
              <Input
                label="Number"
                inputMode="tel"
                value={draft.number}
                onValueChange={(number) => change({ number })}
                isInvalid={!!errors.number}
                errorMessage={errors.number}
              />
              <Input
                label="WABA id"
                value={draft.wabaId}
                onValueChange={(wabaId) => change({ wabaId })}
                isInvalid={!!errors.wabaId}
                errorMessage={errors.wabaId}
              />
              <Input
                label="Display name"
                value={draft.displayName}
                onValueChange={(displayName) => change({ displayName })}
                isInvalid={!!errors.displayName}
                errorMessage={errors.displayName}
              />
              <EnumSelect
                label="Display name review"
                values={WHATSAPP_REVIEW_STATES}
                value={draft.displayNameStatus}
                onChange={(displayNameStatus) => change({ displayNameStatus })}
              />
              <EnumSelect
                label="Meta business verification"
                values={WHATSAPP_VERIFICATIONS}
                value={draft.businessVerification}
                onChange={(businessVerification) => change({ businessVerification })}
              />
              <EnumSelect
                label="Messaging limit"
                values={WHATSAPP_LIMIT_TIERS}
                value={draft.limitTier}
                labels={WHATSAPP_LIMIT_LABEL}
                onChange={(limitTier) => change({ limitTier })}
              />
              <EnumSelect
                label="Quality"
                values={WHATSAPP_QUALITIES}
                value={draft.qualityRating}
                labels={WHATSAPP_QUALITY_LABEL}
                onChange={(qualityRating) => change({ qualityRating })}
              />
            </div>
            <Textarea
              label="Note the store sees (optional)"
              minRows={2}
              maxLength={MESSAGING_NOTE_MAX_CHARS}
              value={draft.statusNote}
              onValueChange={(statusNote) => change({ statusNote })}
              isInvalid={!!errors.statusNote}
              errorMessage={errors.statusNote}
            />
            <p className="flex items-start gap-2 text-label text-fg-muted">
              <IconInfo aria-hidden className="mt-0.5 size-4 shrink-0" />
              A lower quality or limit, or Flagged / Restricted / Disconnected, alerts the store and the console.
            </p>
            {errors.form ? <p className="text-label text-tone-danger-text">{errors.form}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="zc-modal__footer-start">
            <Button
              variant="ghost"
              size="sm"
              isLoading={refreshing}
              isDisabled={!wa?.number || !account.hasAuthKey}
              onPress={() => void runRefresh()}
            >
              Refresh health
            </Button>
          </div>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={loading} onPress={() => void save()}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
