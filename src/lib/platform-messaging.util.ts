/**
 * Console › Messaging helpers (backend PRD-050 FR-1.1, FR-1.2, FR-1.10,
 * FR-1.11, D19): labels and tones for tasks and accounts, the SLA chip,
 * rupees ↔ integer paise for the rate table, the DNS records form, the
 * connect form and the server's field errors; D21: MSG91's KYC per
 * sub-account and the hourly email limits. Pure: no React.
 *
 * The checks mirror the platform-admin service (`platform-messaging.service.ts`)
 * and core `messaging-rates.ts`, so most mistakes show before a round trip;
 * the server stays the judge.
 */

import { toasts } from "../copy";
import { errorCodeOf, errorReasonOf } from "./apollo-client";
import { mutationFailureCopy } from "./mutation-errors";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "./permissions";

// ─── Enums ────────────────────────────────────────────────────────────────

export const messagingTaskTypeEnum = {
  CREATE_CHILD: "CREATE_CHILD",
  CONNECT_CHILD: "CONNECT_CHILD",
  ADD_EMAIL_DOMAIN: "ADD_EMAIL_DOMAIN",
  VERIFY_EMAIL_DOMAIN: "VERIFY_EMAIL_DOMAIN",
  TOP_UP_WALLET: "TOP_UP_WALLET",
  /** D21: MSG91's KYC of the store's sub-account. */
  KYC: "KYC",
} as const;

export type MessagingTaskType =
  (typeof messagingTaskTypeEnum)[keyof typeof messagingTaskTypeEnum];

export const messagingTaskStatusEnum = {
  OPEN: "OPEN",
  DONE: "DONE",
  REJECTED: "REJECTED",
} as const;

export type MessagingTaskStatus =
  (typeof messagingTaskStatusEnum)[keyof typeof messagingTaskStatusEnum];

export const messagingAccountStateEnum = {
  NOT_STARTED: "NOT_STARTED",
  REQUESTED: "REQUESTED",
  ACTIVE: "ACTIVE",
  FAILED: "FAILED",
} as const;

export type MessagingAccountState =
  (typeof messagingAccountStateEnum)[keyof typeof messagingAccountStateEnum];

/** D21: MSG91's KYC of a store's sub-account. */
export const messagingKycStatusEnum = {
  NOT_STARTED: "NOT_STARTED",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type MessagingKycStatus =
  (typeof messagingKycStatusEnum)[keyof typeof messagingKycStatusEnum];

export const messagingAccountKindEnum = {
  MANAGED_CHILD: "MANAGED_CHILD",
  SHARED_COMPANY: "SHARED_COMPANY",
} as const;

export type MessagingAccountKind =
  (typeof messagingAccountKindEnum)[keyof typeof messagingAccountKindEnum];

export const emailSendModeEnum = {
  SMTP: "SMTP",
  HTTP_API: "HTTP_API",
} as const;

export type EmailSendMode =
  (typeof emailSendModeEnum)[keyof typeof emailSendModeEnum];

export const MESSAGING_CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;
export type MessagingRateChannel = (typeof MESSAGING_CHANNELS)[number];

export const MESSAGING_PURPOSES = [
  "MARKETING",
  "TRANSACTIONAL",
  "SERVICE",
] as const;
export type MessagingRatePurpose = (typeof MESSAGING_PURPOSES)[number];

export const DNS_RECORD_TYPES = ["TXT", "CNAME", "MX"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export const DNS_RECORD_PURPOSES = [
  "DKIM",
  "SPF",
  "RETURN_PATH",
  "MX",
  "DMARC",
  "VERIFICATION",
  "OTHER",
] as const;
export type DnsRecordPurpose = (typeof DNS_RECORD_PURPOSES)[number];

// ─── Constants ────────────────────────────────────────────────────────────

/** Core `MESSAGING_RATE_MAX_PAISE` (₹10,000 a message). */
export const MESSAGING_RATE_MAX_PAISE = 1_000_000;

/** The service's `DNS_RECORDS_MAX`, `DNS_VALUE_MAX` and `NOTE_MAX`. */
export const DNS_RECORDS_MAX = 12;
export const DNS_VALUE_MAX_CHARS = 2048;
export const MESSAGING_NOTE_MAX_CHARS = 500;

/** A task due within this is shown amber ("Due soon"). */
export const TASK_DUE_SOON_MS = 4 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The service's `HOST_PATTERN` and `MOBILE_PATTERN`. */
const HOST_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/i;
const MOBILE_PATTERN = /^\+?\d{10,15}$/;

/** Rupees with at most two decimals (paise are whole). */
const RUPEES_PATTERN = /^\d+(?:\.\d{1,2})?$/;

// ─── Types ────────────────────────────────────────────────────────────────

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface MessagingTaskValue {
  label: string;
  value: string;
}

export interface MessagingTask {
  id: string;
  tenantId: string;
  slug: string;
  storeName: string;
  type: MessagingTaskType;
  subject: string;
  status: MessagingTaskStatus;
  values: MessagingTaskValue[];
  source: string;
  dueAt: string | null;
  overdue: boolean;
  note: string | null;
  rejectReason: string | null;
  completedAt: string | null;
  completedBy: string | null;
  reopenedCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MessagingDnsRecord {
  type: string;
  host: string;
  value: string;
  purpose: string;
  required: boolean;
  priority: number | null;
}

export interface MessagingAccount {
  tenantId: string;
  slug: string;
  storeName: string;
  kind: MessagingAccountKind;
  state: MessagingAccountState;
  childId: string | null;
  childUsername: string | null;
  hasAuthKey: boolean;
  hasSmtpLogin: boolean;
  smtpHost: string | null;
  sendMode: EmailSendMode;
  sendingEnabled: boolean;
  sendingEnabledAt: string | null;
  domain: string | null;
  domainRecords: MessagingDnsRecord[];
  msg91Verified: boolean;
  sharedDomainVerified: boolean;
  /** D21: emails an hour MSG91 allows the account (500 to start). */
  hourlyEmailLimit: number;
  /** D21: sending can't be switched on until APPROVED. */
  kycStatus: MessagingKycStatus;
  kycNote: string | null;
  kycUpdatedAt: string | null;
  kycUpdatedBy: string | null;
  lastTestOk: boolean | null;
  lastTestAt: string | null;
  lastTestMessage: string | null;
  failureReason: string | null;
  requestedAt: string | null;
  connectedAt: string | null;
  version: number;
  updatedAt: string | null;
}

export type MessagingRateTable = Record<MessagingRatePurpose, number>;

export interface MessagingRates
  extends Record<MessagingRateChannel, MessagingRateTable> {
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MessagingSettings {
  rates: MessagingRates;
  addClientApiEnabled: boolean;
  /** D21: emails an hour through Zerror's parent account (every store shares it). */
  parentHourlyEmailLimit: number;
  /** D21: marketing's share of every account's hour, percent. */
  marketingHourlySharePercent: number;
}

export interface MessagingAbilities {
  read: boolean;
  manage: boolean;
}

// ─── Labels ───────────────────────────────────────────────────────────────

export const TASK_TYPE_LABEL: Readonly<Record<MessagingTaskType, string>> = {
  CREATE_CHILD: "Create MSG91 account",
  CONNECT_CHILD: "Connect MSG91 account",
  ADD_EMAIL_DOMAIN: "Add email domain",
  VERIFY_EMAIL_DOMAIN: "Verify email domain",
  TOP_UP_WALLET: "Top up wallet",
  KYC: "MSG91 KYC",
};

/** What the step asks of ops, one line under the title. */
export const TASK_TYPE_HINT: Readonly<Record<MessagingTaskType, string>> = {
  CREATE_CHILD:
    "Create the child account in MSG91 with these values, then enter its id.",
  CONNECT_CHILD:
    "Log in as the child, create the auth key and copy the SMTP login, then connect it here.",
  ADD_EMAIL_DOMAIN:
    "Add the domain in the child's MSG91 email settings, then copy every DNS record MSG91 shows.",
  VERIFY_EMAIL_DOMAIN:
    "Press Verify in MSG91 and confirm here once it shows the domain verified.",
  TOP_UP_WALLET: "Top up the child's MSG91 wallet, then mark the step done.",
  KYC:
    "Submit the store's business documents in the sub-account's KYC page. Done records MSG91's approval; Reject records its refusal.",
};

export const KYC_STATUS_LABEL: Readonly<Record<MessagingKycStatus, string>> = {
  NOT_STARTED: "KYC not started",
  SUBMITTED: "KYC with MSG91",
  APPROVED: "KYC approved",
  REJECTED: "KYC rejected",
};

export const KYC_STATUS_TONE: Readonly<Record<MessagingKycStatus, Tone>> = {
  NOT_STARTED: "warning",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

/** D21: MSG91's starting limit, and the console's bounds. */
export const EMAIL_HOURLY_LIMIT_DEFAULT = 500;
export const EMAIL_HOURLY_LIMIT_MAX = 1_000_000;
export const MARKETING_SHARE_MIN_PERCENT = 10;
export const MARKETING_SHARE_MAX_PERCENT = 100;

/** A typed hourly limit: a whole number 1–1,000,000, else an error line. */
export function hourlyLimitError(text: string): string | null {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isInteger(value) || value < 1 || value > EMAIL_HOURLY_LIMIT_MAX) {
    return "Enter a whole number of emails an hour (MSG91 starts accounts at 500)";
  }
  return null;
}

/** A typed marketing share: a whole percent 10–100, else an error line. */
export function marketingShareError(text: string): string | null {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isInteger(value) || value < MARKETING_SHARE_MIN_PERCENT || value > MARKETING_SHARE_MAX_PERCENT) {
    return `Enter a whole percent from ${MARKETING_SHARE_MIN_PERCENT} to ${MARKETING_SHARE_MAX_PERCENT}`;
  }
  return null;
}

/** Marketing emails an hour at a limit and share (as the backend computes it). */
export function marketingPerHour(limit: number, sharePercent: number): number {
  return Math.max(1, Math.floor((limit * sharePercent) / 100));
}

/** A KYC change: a refusal needs a note (the store sees it). */
export function kycChangeError(status: MessagingKycStatus, note: string): string | null {
  return status === messagingKycStatusEnum.REJECTED && !note.trim()
    ? "Say what MSG91 refused; the store sees it"
    : null;
}

export const TASK_STATUS_LABEL: Readonly<Record<MessagingTaskStatus, string>> =
  { OPEN: "Open", DONE: "Done", REJECTED: "Rejected" };

export const TASK_STATUS_TONE: Readonly<Record<MessagingTaskStatus, Tone>> = {
  OPEN: "info",
  DONE: "success",
  REJECTED: "neutral",
};

export const ACCOUNT_STATE_LABEL: Readonly<
  Record<MessagingAccountState, string>
> = {
  NOT_STARTED: "Not created",
  REQUESTED: "Creating",
  ACTIVE: "Connected",
  FAILED: "Problem",
};

export const ACCOUNT_STATE_TONE: Readonly<Record<MessagingAccountState, Tone>> =
  { NOT_STARTED: "neutral", REQUESTED: "info", ACTIVE: "success", FAILED: "danger" };

export const ACCOUNT_KIND_LABEL: Readonly<
  Record<MessagingAccountKind, string>
> = {
  MANAGED_CHILD: "Child of Zerror's account",
  SHARED_COMPANY: "Store's own company",
};

export const SEND_MODE_LABEL: Readonly<Record<EmailSendMode, string>> = {
  SMTP: "SMTP",
  HTTP_API: "HTTP API",
};

export const CHANNEL_LABEL: Readonly<Record<MessagingRateChannel, string>> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

export const PURPOSE_LABEL: Readonly<Record<MessagingRatePurpose, string>> = {
  MARKETING: "Marketing",
  TRANSACTIONAL: "Transactional",
  SERVICE: "Service",
};

/** Where a task came from, in words (unknown sources show as they are). */
export function taskSourceLabel(source: string): string {
  switch (source) {
    case "CONSOLE":
      return "Opened in the console";
    case "CREATE_CHILD_DONE":
      return "After the account was created";
    case "ADD_CLIENT_API":
      return "Created through MSG91's API";
    case "messaging.account.requested":
      return "The store turned email on";
    case "messaging.email_domain.requested":
      return "The store added a sending domain";
    case "messaging.email_domain.dns_ready":
      return "The store's DNS records are in place";
    default:
      return source;
  }
}

// ─── Abilities ────────────────────────────────────────────────────────────

export function messagingAbilities(
  can: (permission: PlatformPermission) => boolean,
): MessagingAbilities {
  return {
    read: can(PLATFORM_PERMISSIONS.MESSAGING_READ),
    manage: can(PLATFORM_PERMISSIONS.MESSAGING_MANAGE),
  };
}

// ─── SLA chip ─────────────────────────────────────────────────────────────

export interface SlaChip {
  label: string;
  tone: Tone;
}

function spanLabel(ms: number): string {
  if (ms < HOUR_MS) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)} h`;
  return `${Math.round(ms / DAY_MS)} d`;
}

/**
 * The task's SLA chip: overdue (red, also when the server says so), due
 * within 4 hours (amber), else when it is due. Closed tasks and tasks
 * without a due date get none.
 */
export function taskSlaChip(
  task: Pick<MessagingTask, "status" | "dueAt" | "overdue">,
  now: Date = new Date(),
): SlaChip | null {
  if (task.status !== messagingTaskStatusEnum.OPEN || !task.dueAt) return null;
  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const left = due - now.getTime();
  if (task.overdue || left <= 0) {
    return { label: `Overdue by ${spanLabel(Math.abs(left))}`, tone: "danger" };
  }
  if (left <= TASK_DUE_SOON_MS) {
    return { label: `Due in ${spanLabel(left)}`, tone: "warning" };
  }
  return { label: `Due in ${spanLabel(left)}`, tone: "neutral" };
}

// ─── Rupees ↔ paise ───────────────────────────────────────────────────────

/** Integer paise as rupees with two decimals ("0.25"). */
export function paiseToRupees(paise: number): string {
  if (!Number.isFinite(paise)) return "";
  return (paise / 100).toFixed(2);
}

/**
 * Typed rupees as whole paise, or null when it isn't a non-negative amount
 * with at most two decimals. String arithmetic, so 0.29 is 29, never 28.
 */
export function rupeesToPaise(text: string): number | null {
  const value = text.trim().replace(/^₹\s*/, "");
  if (!RUPEES_PATTERN.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export type RatesDraft = Record<
  MessagingRateChannel,
  Record<MessagingRatePurpose, string>
>;

/** Field keys match the server's `field` (`rates.EMAIL.MARKETING`). */
export type RatesErrors = Record<string, string | undefined>;

export function rateFieldKey(
  channel: MessagingRateChannel,
  purpose: MessagingRatePurpose,
): string {
  return `rates.${channel}.${purpose}`;
}

export function ratesDraftOf(rates: MessagingRates): RatesDraft {
  const draft = {} as RatesDraft;
  for (const channel of MESSAGING_CHANNELS) {
    draft[channel] = {} as Record<MessagingRatePurpose, string>;
    for (const purpose of MESSAGING_PURPOSES) {
      draft[channel][purpose] = paiseToRupees(rates[channel]?.[purpose] ?? 0);
    }
  }
  return draft;
}

export function validateRatesDraft(draft: RatesDraft): RatesErrors {
  const errors: RatesErrors = {};
  for (const channel of MESSAGING_CHANNELS) {
    for (const purpose of MESSAGING_PURPOSES) {
      const paise = rupeesToPaise(draft[channel][purpose]);
      const key = rateFieldKey(channel, purpose);
      if (paise === null) {
        errors[key] = "Enter rupees, like 0.25";
      } else if (paise > MESSAGING_RATE_MAX_PAISE) {
        errors[key] = "At most ₹10,000 a message";
      }
    }
  }
  return errors;
}

/**
 * The `rates` input: only the channels whose paise changed (a rate change
 * is a new version), or null when nothing changed. Call after validating.
 */
export function ratesInputOf(
  draft: RatesDraft,
  rates: MessagingRates,
): Partial<Record<MessagingRateChannel, MessagingRateTable>> | null {
  const input: Partial<Record<MessagingRateChannel, MessagingRateTable>> = {};
  for (const channel of MESSAGING_CHANNELS) {
    const table = {} as MessagingRateTable;
    let changed = false;
    for (const purpose of MESSAGING_PURPOSES) {
      const paise = rupeesToPaise(draft[channel][purpose]) ?? 0;
      table[purpose] = paise;
      if (paise !== (rates[channel]?.[purpose] ?? 0)) changed = true;
    }
    if (changed) input[channel] = table;
  }
  return Object.keys(input).length ? input : null;
}

// ─── DNS records form (ADD_EMAIL_DOMAIN) ──────────────────────────────────

export interface DnsRecordDraft {
  type: DnsRecordType;
  host: string;
  value: string;
  purpose: DnsRecordPurpose;
  required: boolean;
  /** MX only; typed digits. */
  priority: string;
}

export type DnsRecordErrors = Record<string, string | undefined>;

export function emptyDnsRecord(): DnsRecordDraft {
  return {
    type: "TXT",
    host: "",
    value: "",
    purpose: "DKIM",
    required: true,
    priority: "",
  };
}

/** The server's host rule: "@" or "" is the domain, a relative host is under it. */
export function fullDnsHost(host: string, domain: string): string {
  const raw = host.trim().toLowerCase().replace(/\.$/, "");
  const base = domain.trim().toLowerCase().replace(/\.$/, "");
  if (raw === "@" || raw === "") return base;
  return raw.endsWith(base) ? raw : `${raw}.${base}`;
}

/** Errors keyed like the server's `field` (`records.0.host`, `records`). */
export function validateDnsRecords(
  records: DnsRecordDraft[],
  domain: string,
): DnsRecordErrors {
  const errors: DnsRecordErrors = {};
  if (records.length === 0) {
    errors.records = "Add the DNS records MSG91 shows";
    return errors;
  }
  if (records.length > DNS_RECORDS_MAX) {
    errors.records = `At most ${DNS_RECORDS_MAX} records`;
  }
  records.forEach((record, index) => {
    if (!(DNS_RECORD_TYPES as readonly string[]).includes(record.type)) {
      errors[`records.${index}.type`] = "A record type is TXT, CNAME or MX";
    }
    if (!HOST_PATTERN.test(fullDnsHost(record.host, domain))) {
      errors[`records.${index}.host`] = "That host name isn't valid";
    }
    const value = record.value.trim();
    if (!value || value.length > DNS_VALUE_MAX_CHARS || /[\r\n]/.test(value)) {
      errors[`records.${index}.value`] = "Copy the record's value exactly";
    }
    if (record.type === "MX" && record.priority.trim()) {
      const priority = Number(record.priority.trim());
      if (!Number.isInteger(priority) || priority < 0 || priority > 65535) {
        errors[`records.${index}.priority`] = "Priority is 0–65535";
      }
    }
  });
  return errors;
}

/** The `records` input (hosts as typed; the server makes them full). */
export function dnsRecordsInputOf(records: DnsRecordDraft[]) {
  return records.map((record) => ({
    type: record.type,
    host: record.host.trim(),
    value: record.value.trim(),
    purpose: record.purpose,
    required: record.required,
    priority:
      record.type === "MX" && record.priority.trim()
        ? Number(record.priority.trim())
        : null,
  }));
}

// ─── Complete task ────────────────────────────────────────────────────────

export interface CompleteTaskDraft {
  note: string;
  childId: string;
  records: DnsRecordDraft[];
  msg91Verified: boolean;
}

export type CompleteTaskErrors = Record<string, string | undefined>;

export function completeTaskDraftOf(): CompleteTaskDraft {
  return { note: "", childId: "", records: [emptyDnsRecord()], msg91Verified: false };
}

export function validateCompleteTask(
  task: Pick<MessagingTask, "type" | "subject">,
  draft: CompleteTaskDraft,
): CompleteTaskErrors {
  const errors: CompleteTaskErrors = {};
  if (draft.note.length > MESSAGING_NOTE_MAX_CHARS) {
    errors.note = `Keep the note under ${MESSAGING_NOTE_MAX_CHARS} characters`;
  }
  switch (task.type) {
    case messagingTaskTypeEnum.CREATE_CHILD:
      if (!draft.childId.trim()) errors.childId = "Enter the child account's MSG91 id";
      break;
    case messagingTaskTypeEnum.ADD_EMAIL_DOMAIN:
      Object.assign(errors, validateDnsRecords(draft.records, task.subject));
      break;
    case messagingTaskTypeEnum.VERIFY_EMAIL_DOMAIN:
      if (!draft.msg91Verified) {
        errors.msg91Verified = "Confirm that MSG91 shows the domain verified";
      }
      break;
    default:
      break;
  }
  return errors;
}

/** The `input` for `completeMessagingTask`: only what the type takes. */
export function completeTaskInputOf(
  task: Pick<MessagingTask, "type">,
  draft: CompleteTaskDraft,
) {
  const input: {
    note?: string;
    childId?: string;
    records?: ReturnType<typeof dnsRecordsInputOf>;
    msg91Verified?: boolean;
  } = {};
  if (draft.note.trim()) input.note = draft.note.trim();
  if (task.type === messagingTaskTypeEnum.CREATE_CHILD) {
    input.childId = draft.childId.trim();
  } else if (task.type === messagingTaskTypeEnum.ADD_EMAIL_DOMAIN) {
    input.records = dnsRecordsInputOf(draft.records);
  } else if (task.type === messagingTaskTypeEnum.VERIFY_EMAIL_DOMAIN) {
    input.msg91Verified = draft.msg91Verified;
  }
  return input;
}

// ─── Connect form (FR-1.2) ────────────────────────────────────────────────

export interface ConnectDraft {
  kind: MessagingAccountKind;
  childId: string;
  /** Secret: never prefilled, cleared after every submit. */
  authKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  /** Secret: never prefilled, cleared after every submit. */
  smtpPassword: string;
  sendMode: EmailSendMode;
  httpTemplateId: string;
  sharedDomainVerified: boolean;
}

export type ConnectErrors = Record<string, string | undefined>;

/** A draft from the stored account (never a secret: those start empty). */
export function connectDraftOf(account: MessagingAccount | null): ConnectDraft {
  return {
    kind: account?.kind ?? messagingAccountKindEnum.MANAGED_CHILD,
    childId: account?.childId ?? "",
    authKey: "",
    smtpHost: account?.smtpHost ?? "",
    smtpPort: "",
    smtpUsername: "",
    smtpPassword: "",
    sendMode: account?.sendMode ?? emailSendModeEnum.SMTP,
    httpTemplateId: "",
    sharedDomainVerified: account?.sharedDomainVerified ?? false,
  };
}

export function validateConnectDraft(draft: ConnectDraft): ConnectErrors {
  const errors: ConnectErrors = {};
  const port = draft.smtpPort.trim();
  if (port) {
    const value = Number(port);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      errors.smtpPort = "SMTP port is 1–65535";
    }
  }
  const host = draft.smtpHost.trim();
  if (host && !HOST_PATTERN.test(host)) errors.smtpHost = "That SMTP host isn't valid";
  // A password without a username (or the reverse) can't log in.
  if (draft.smtpPassword && !draft.smtpUsername.trim()) {
    errors.smtpUsername = "Enter the SMTP username with the password";
  }
  if (draft.smtpUsername.trim() && !draft.smtpPassword) {
    errors.smtpPassword = "Enter the SMTP password with the username";
  }
  return errors;
}

/**
 * The connect `input`: blank fields are left out, so what is stored stays
 * (a key or password is only replaced when typed again).
 */
export function connectInputOf(draft: ConnectDraft) {
  const input: Record<string, string | number | boolean> = {
    kind: draft.kind,
    sendMode: draft.sendMode,
    sharedDomainVerified: draft.sharedDomainVerified,
  };
  const set = (key: string, value: string) => {
    if (value.trim()) input[key] = value.trim();
  };
  set("childId", draft.childId);
  if (draft.authKey.trim()) input.authKey = draft.authKey.trim();
  set("smtpHost", draft.smtpHost);
  if (draft.smtpPort.trim()) input.smtpPort = Number(draft.smtpPort.trim());
  set("smtpUsername", draft.smtpUsername);
  if (draft.smtpPassword) input.smtpPassword = draft.smtpPassword;
  if (draft.sendMode === emailSendModeEnum.HTTP_API) {
    set("httpTemplateId", draft.httpTemplateId);
  }
  return input;
}

/** The secrets cleared from a draft after a submit, whatever the answer. */
export function withoutSecrets(draft: ConnectDraft): ConnectDraft {
  return { ...draft, authKey: "", smtpPassword: "" };
}

// ─── Create child account (FR-1.1) ────────────────────────────────────────

export interface CreateChildDraft {
  mobile: string;
  companyName: string;
}

/** The mobile is needed only while the add_client API is on. */
export function validateCreateChild(
  draft: CreateChildDraft,
  addClientApiEnabled: boolean,
): Record<string, string | undefined> {
  if (!addClientApiEnabled) return {};
  const mobile = draft.mobile.trim().replace(/[\s-]/g, "");
  return MOBILE_PATTERN.test(mobile)
    ? {}
    : { mobile: "Enter a mobile number with its country code" };
}

export function createChildInputOf(draft: CreateChildDraft) {
  const input: { mobile?: string; companyName?: string } = {};
  const mobile = draft.mobile.trim().replace(/[\s-]/g, "");
  if (mobile) input.mobile = mobile;
  if (draft.companyName.trim()) input.companyName = draft.companyName.trim();
  return input;
}

// ─── Accounts ─────────────────────────────────────────────────────────────

/** "Key ✓ · SMTP ✗" in words, for the accounts table. */
export function credentialSummary(
  account: Pick<MessagingAccount, "hasAuthKey" | "hasSmtpLogin" | "sendMode">,
): string {
  const key = account.hasAuthKey ? "Auth key saved" : "No auth key";
  if (account.sendMode === emailSendModeEnum.HTTP_API) return key;
  return `${key} · ${account.hasSmtpLogin ? "SMTP login saved" : "No SMTP login"}`;
}

/** The sending domain and its state, in words. */
export function domainSummary(
  account: Pick<MessagingAccount, "domain" | "msg91Verified" | "sharedDomainVerified">,
): { label: string; tone: Tone } {
  if (account.domain) {
    return account.msg91Verified
      ? { label: "Verified in MSG91", tone: "success" }
      : { label: "Waiting for MSG91 verification", tone: "warning" };
  }
  return account.sharedDomainVerified
    ? { label: "Shared address ready", tone: "info" }
    : { label: "No domain yet", tone: "neutral" };
}

// ─── Server errors ────────────────────────────────────────────────────────

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

/** Console copy for the messaging `extensions.reason` values. */
export const MESSAGING_REASON_COPY: Readonly<Record<string, string>> = {
  SAMPLE_STORE: "Sample stores are never connected to MSG91.",
  ALREADY_CONNECTED: "This store's MSG91 account is already connected.",
  MESSAGING_ACCOUNT_NOT_READY:
    "The account isn't ready for this step yet. Connect it (its check must pass) or add the domain first.",
  TASK_CLOSED: "This task is already closed. The queue is reloaded.",
  KYC_NOT_APPROVED: "MSG91's KYC of this account isn't approved yet, so sending can't be switched on.",
};

/** Reasons after which the queue and accounts should be read again. */
const RELOAD_REASONS = new Set(["TASK_CLOSED", "ALREADY_CONNECTED"]);

const FIELD_REASONS = new Set([
  "INVALID_INPUT",
  "INVALID_DNS_RECORD",
  "INVALID_RATE",
  "REASON_REQUIRED",
]);

/** The toast text for a failed messaging mutation (null: nothing more to show). */
export function messagingFailureCopy(error: unknown): string | null {
  const reason = errorReasonOf(error);
  if (reason && MESSAGING_REASON_COPY[reason]) return MESSAGING_REASON_COPY[reason];
  // MSG91_REFUSED carries MSG91's own code in the server's message.
  if (reason === "MSG91_REFUSED") {
    return (error as Error)?.message || toasts.genericError;
  }
  return mutationFailureCopy(error);
}

export function shouldReloadMessagingAfter(error: unknown): boolean {
  return RELOAD_REASONS.has(errorReasonOf(error) ?? "");
}

/**
 * A BAD_USER_INPUT answer as field errors keyed by the server's `field`
 * (`childId`, `records.0.host`, `rates.SMS.MARKETING`), else null.
 */
export function messagingFieldErrorsFromServer(
  error: unknown,
): Record<string, string> | null {
  if (errorCodeOf(error) !== "BAD_USER_INPUT") return null;
  const first = (error as { graphQLErrors?: GraphQLErrorLike[] })
    ?.graphQLErrors?.[0];
  const reason = String(first?.extensions?.reason ?? "");
  if (!FIELD_REASONS.has(reason)) return null;
  const field = String(first?.extensions?.field ?? "");
  const message = first?.message || "Check this value.";
  return field ? { [field]: message } : { form: message };
}

// ─── Queue state ──────────────────────────────────────────────────────────

export type TaskStatusTab = MessagingTaskStatus | "ALL";

export const TASK_STATUS_TABS: ReadonlyArray<{
  value: TaskStatusTab;
  label: string;
}> = [
  { value: "OPEN", label: "Open" },
  { value: "DONE", label: "Done" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export function isTaskStatusTab(value: unknown): value is TaskStatusTab {
  return TASK_STATUS_TABS.some((tab) => tab.value === value);
}

export function isTaskType(value: unknown): value is MessagingTaskType {
  return (
    typeof value === "string" &&
    (Object.values(messagingTaskTypeEnum) as string[]).includes(value)
  );
}

export function taskQueueVariables(
  status: TaskStatusTab,
  type: MessagingTaskType | null,
  limit: number,
  offset: number,
) {
  return {
    status: status === "ALL" ? null : status,
    type,
    limit,
    offset,
  };
}
