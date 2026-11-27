import { describe, expect, it } from "vitest";
import { PLATFORM_PERMISSIONS, can } from "./permissions";
import {
  KYC_STATUS_LABEL,
  TASK_TYPE_HINT,
  TASK_TYPE_LABEL,
  hourlyLimitError,
  kycChangeError,
  marketingPerHour,
  marketingShareError,
  completeTaskDraftOf,
  completeTaskInputOf,
  connectDraftOf,
  connectInputOf,
  createChildInputOf,
  credentialSummary,
  domainSummary,
  emptyDnsRecord,
  fullDnsHost,
  messagingAbilities,
  messagingFailureCopy,
  messagingFieldErrorsFromServer,
  messagingTaskTypeEnum,
  paiseToRupees,
  ratesDraftOf,
  ratesInputOf,
  rupeesToPaise,
  shouldReloadMessagingAfter,
  taskQueueVariables,
  taskSlaChip,
  validateCompleteTask,
  validateConnectDraft,
  validateCreateChild,
  validateDnsRecords,
  validateRatesDraft,
  withoutSecrets,
  type MessagingAccount,
  type MessagingRates,
} from "./platform-messaging.util";

const RATES: MessagingRates = {
  version: 3,
  updatedAt: null,
  updatedBy: null,
  EMAIL: { MARKETING: 25, TRANSACTIONAL: 15, SERVICE: 0 },
  SMS: { MARKETING: 30, TRANSACTIONAL: 20, SERVICE: 20 },
  WHATSAPP: { MARKETING: 100, TRANSACTIONAL: 30, SERVICE: 0 },
};

function gqlError(code: string, reason: string, field?: string, message = "Server says no") {
  return Object.assign(new Error(message), {
    graphQLErrors: [{ message, extensions: { code, reason, ...(field ? { field } : {}) } }],
  });
}

describe("rupees ↔ paise", () => {
  it("turns rupees into whole paise without float drift", () => {
    expect(rupeesToPaise("0.25")).toBe(25);
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise("1.1")).toBe(110);
    expect(rupeesToPaise("12")).toBe(1200);
    expect(rupeesToPaise(" ₹0.05 ")).toBe(5);
    expect(rupeesToPaise("0")).toBe(0);
  });

  it("refuses negatives, three decimals and words", () => {
    expect(rupeesToPaise("-1")).toBeNull();
    expect(rupeesToPaise("0.255")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise("")).toBeNull();
  });

  it("shows paise as rupees with two decimals", () => {
    expect(paiseToRupees(25)).toBe("0.25");
    expect(paiseToRupees(100)).toBe("1.00");
    expect(paiseToRupees(0)).toBe("0.00");
  });
});

describe("rates form", () => {
  it("round-trips the stored rates", () => {
    const draft = ratesDraftOf(RATES);
    expect(draft.EMAIL.MARKETING).toBe("0.25");
    expect(validateRatesDraft(draft)).toEqual({});
    expect(ratesInputOf(draft, RATES)).toBeNull();
  });

  it("sends only the changed channels, in paise", () => {
    const draft = ratesDraftOf(RATES);
    draft.SMS.MARKETING = "0.35";
    expect(ratesInputOf(draft, RATES)).toEqual({ SMS: { MARKETING: 35, TRANSACTIONAL: 20, SERVICE: 20 } });
  });

  it("keys errors like the server's field", () => {
    const draft = ratesDraftOf(RATES);
    draft.WHATSAPP.SERVICE = "x";
    draft.EMAIL.MARKETING = "10000.01";
    expect(validateRatesDraft(draft)).toEqual({
      "rates.WHATSAPP.SERVICE": "Enter rupees, like 0.25",
      "rates.EMAIL.MARKETING": "At most ₹10,000 a message",
    });
  });
});

describe("task labels and SLA chip", () => {
  it("labels every task type", () => {
    for (const type of Object.values(messagingTaskTypeEnum)) expect(TASK_TYPE_LABEL[type]).toBeTruthy();
  });

  const now = new Date("2026-11-27T10:00:00Z");

  it("shows overdue in red", () => {
    expect(taskSlaChip({ status: "OPEN", dueAt: "2026-11-27T07:00:00Z", overdue: true }, now)).toEqual({
      label: "Overdue by 3 h",
      tone: "danger",
    });
  });

  it("trusts the server's overdue flag", () => {
    expect(taskSlaChip({ status: "OPEN", dueAt: "2026-11-27T11:00:00Z", overdue: true }, now)?.tone).toBe("danger");
  });

  it("shows due soon in amber and later in grey", () => {
    expect(taskSlaChip({ status: "OPEN", dueAt: "2026-11-27T12:00:00Z", overdue: false }, now)).toEqual({
      label: "Due in 2 h",
      tone: "warning",
    });
    expect(taskSlaChip({ status: "OPEN", dueAt: "2026-11-29T10:00:00Z", overdue: false }, now)).toEqual({
      label: "Due in 2 d",
      tone: "neutral",
    });
  });

  it("shows nothing for closed or undated tasks", () => {
    expect(taskSlaChip({ status: "DONE", dueAt: "2026-11-27T07:00:00Z", overdue: false }, now)).toBeNull();
    expect(taskSlaChip({ status: "OPEN", dueAt: null, overdue: false }, now)).toBeNull();
  });
});

describe("DNS records form", () => {
  const domain = "mail.example.com";

  it("makes relative hosts full like the server", () => {
    expect(fullDnsHost("k1._domainkey", domain)).toBe("k1._domainkey.mail.example.com");
    expect(fullDnsHost("@", domain)).toBe(domain);
    expect(fullDnsHost("MAIL.EXAMPLE.COM.", domain)).toBe(domain);
  });

  it("accepts a valid record set", () => {
    const records = [
      { ...emptyDnsRecord(), host: "k1._domainkey", value: "k=rsa; p=MIGf" },
      { ...emptyDnsRecord(), type: "MX" as const, purpose: "MX" as const, host: "@", value: "mx.msg91.com", priority: "10" },
    ];
    expect(validateDnsRecords(records, domain)).toEqual({});
  });

  it("needs at least one record", () => {
    expect(validateDnsRecords([], domain)).toEqual({ records: "Add the DNS records MSG91 shows" });
  });

  it("flags bad hosts, values and MX priorities per row", () => {
    const records = [
      { ...emptyDnsRecord(), host: "bad host!", value: "" },
      { ...emptyDnsRecord(), type: "MX" as const, host: "@", value: "a\nb", priority: "70000" },
    ];
    expect(validateDnsRecords(records, domain)).toEqual({
      "records.0.host": "That host name isn't valid",
      "records.0.value": "Copy the record's value exactly",
      "records.1.value": "Copy the record's value exactly",
      "records.1.priority": "Priority is 0–65535",
    });
  });
});

describe("complete task", () => {
  it("needs the child id for CREATE_CHILD", () => {
    const draft = completeTaskDraftOf();
    expect(validateCompleteTask({ type: "CREATE_CHILD", subject: "" }, draft)).toEqual({
      childId: "Enter the child account's MSG91 id",
    });
    expect(completeTaskInputOf({ type: "CREATE_CHILD" }, { ...draft, childId: " 123 ", note: " ok " })).toEqual({
      childId: "123",
      note: "ok",
    });
  });

  it("needs the confirmation for VERIFY_EMAIL_DOMAIN", () => {
    const draft = completeTaskDraftOf();
    expect(validateCompleteTask({ type: "VERIFY_EMAIL_DOMAIN", subject: "mail.a.com" }, draft).msg91Verified).toBeTruthy();
    expect(completeTaskInputOf({ type: "VERIFY_EMAIL_DOMAIN" }, { ...draft, msg91Verified: true })).toEqual({ msg91Verified: true });
  });

  it("sends records only for ADD_EMAIL_DOMAIN", () => {
    const draft = { ...completeTaskDraftOf(), records: [{ ...emptyDnsRecord(), host: "k1._domainkey", value: "v" }] };
    expect(completeTaskInputOf({ type: "ADD_EMAIL_DOMAIN" }, draft).records).toEqual([
      { type: "TXT", host: "k1._domainkey", value: "v", purpose: "DKIM", required: true, priority: null },
    ]);
    expect(completeTaskInputOf({ type: "TOP_UP_WALLET" }, draft)).toEqual({});
  });
});

describe("connect form", () => {
  const account = {
    kind: "SHARED_COMPANY",
    childId: "77",
    smtpHost: "smtp.mailer91.com",
    sendMode: "SMTP",
    sharedDomainVerified: true,
  } as MessagingAccount;

  it("prefills stored values but never secrets", () => {
    const draft = connectDraftOf(account);
    expect(draft).toMatchObject({ kind: "SHARED_COMPANY", childId: "77", authKey: "", smtpPassword: "" });
  });

  it("leaves blank fields out so stored ones stay", () => {
    const input = connectInputOf(connectDraftOf(account));
    expect(input).toEqual({
      kind: "SHARED_COMPANY",
      sendMode: "SMTP",
      sharedDomainVerified: true,
      childId: "77",
      smtpHost: "smtp.mailer91.com",
    });
  });

  it("sends typed secrets and the port as a number", () => {
    const input = connectInputOf({ ...connectDraftOf(null), authKey: "k", smtpPort: "587", smtpUsername: "u", smtpPassword: "p" });
    expect(input).toMatchObject({ authKey: "k", smtpPort: 587, smtpUsername: "u", smtpPassword: "p" });
  });

  it("clears the secrets after a submit", () => {
    const draft = withoutSecrets({ ...connectDraftOf(null), authKey: "k", smtpPassword: "p", childId: "1" });
    expect(draft.authKey).toBe("");
    expect(draft.smtpPassword).toBe("");
    expect(draft.childId).toBe("1");
  });

  it("checks the port, host and the username/password pair", () => {
    expect(validateConnectDraft({ ...connectDraftOf(null), smtpPort: "0", smtpHost: "not a host", smtpPassword: "p" })).toEqual({
      smtpPort: "SMTP port is 1–65535",
      smtpHost: "That SMTP host isn't valid",
      smtpUsername: "Enter the SMTP username with the password",
    });
  });
});

describe("create child account", () => {
  it("needs the mobile only while the add_client API is on", () => {
    expect(validateCreateChild({ mobile: "", companyName: "" }, false)).toEqual({});
    expect(validateCreateChild({ mobile: "12", companyName: "" }, true).mobile).toBeTruthy();
    expect(validateCreateChild({ mobile: "+91 98765-43210", companyName: "" }, true)).toEqual({});
    expect(createChildInputOf({ mobile: "+91 98765-43210", companyName: " Acme " })).toEqual({
      mobile: "+919876543210",
      companyName: "Acme",
    });
  });
});

describe("accounts", () => {
  it("summarises credential presence without values", () => {
    expect(credentialSummary({ hasAuthKey: true, hasSmtpLogin: false, sendMode: "SMTP" })).toBe("Auth key saved · No SMTP login");
    expect(credentialSummary({ hasAuthKey: false, hasSmtpLogin: false, sendMode: "HTTP_API" })).toBe("No auth key");
  });

  it("summarises the domain", () => {
    expect(domainSummary({ domain: "mail.a.com", msg91Verified: true, sharedDomainVerified: false }).tone).toBe("success");
    expect(domainSummary({ domain: "mail.a.com", msg91Verified: false, sharedDomainVerified: false }).tone).toBe("warning");
    expect(domainSummary({ domain: null, msg91Verified: false, sharedDomainVerified: false }).label).toBe("No domain yet");
  });
});

describe("abilities and errors", () => {
  it("reads and manages by permission", () => {
    expect(messagingAbilities((permission) => can("READ_ONLY", permission))).toEqual({ read: true, manage: false });
    expect(messagingAbilities((permission) => can("PLATFORM_ADMIN", permission))).toEqual({ read: true, manage: true });
    expect(messagingAbilities((permission) => can("SUPPORT_AGENT", permission))).toEqual({ read: false, manage: false });
    expect(can("PLATFORM_OWNER", PLATFORM_PERMISSIONS.MESSAGING_MANAGE)).toBe(true);
  });

  it("maps field errors by the server's field", () => {
    expect(messagingFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "INVALID_DNS_RECORD", "records.1.host", "Bad host"))).toEqual({
      "records.1.host": "Bad host",
    });
    expect(messagingFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "INVALID_RATE", "rates.SMS.SERVICE"))).toEqual({
      "rates.SMS.SERVICE": "Server says no",
    });
    expect(messagingFieldErrorsFromServer(gqlError("CONFLICT", "TASK_CLOSED"))).toBeNull();
  });

  it("uses console copy for known reasons and reloads after TASK_CLOSED", () => {
    expect(messagingFailureCopy(gqlError("CONFLICT", "SAMPLE_STORE"))).toMatch(/Sample stores/);
    expect(messagingFailureCopy(gqlError("CONFLICT", "MSG91_REFUSED", undefined, "MSG91 didn't create the account: 418"))).toBe(
      "MSG91 didn't create the account: 418",
    );
    expect(shouldReloadMessagingAfter(gqlError("CONFLICT", "TASK_CLOSED"))).toBe(true);
    expect(shouldReloadMessagingAfter(gqlError("CONFLICT", "SAMPLE_STORE"))).toBe(false);
  });

  it("builds the queue variables", () => {
    expect(taskQueueVariables("ALL", null, 20, 40)).toEqual({ status: null, type: null, limit: 20, offset: 40 });
    expect(taskQueueVariables("OPEN", "CREATE_CHILD", 20, 0)).toMatchObject({ status: "OPEN", type: "CREATE_CHILD" });
  });
});

describe("D21: KYC and the hourly email limits", () => {
  it("labels the KYC task and states", () => {
    expect(TASK_TYPE_LABEL.KYC).toBe("MSG91 KYC");
    expect(TASK_TYPE_HINT.KYC).toMatch(/business documents/);
    expect(KYC_STATUS_LABEL.SUBMITTED).toBe("KYC with MSG91");
  });

  it("needs a note for a refused KYC", () => {
    expect(kycChangeError("REJECTED", " ")).toMatch(/refused/);
    expect(kycChangeError("REJECTED", "Address proof unreadable")).toBeNull();
    expect(kycChangeError("APPROVED", "")).toBeNull();
  });

  it("checks the limits and computes marketing's hour like the backend", () => {
    expect(hourlyLimitError("500")).toBeNull();
    expect(hourlyLimitError("0")).toMatch(/whole number/);
    expect(hourlyLimitError("12.5")).toMatch(/whole number/);
    expect(hourlyLimitError("")).toMatch(/whole number/);
    expect(marketingShareError("80")).toBeNull();
    expect(marketingShareError("5")).toMatch(/10 to 100/);
    expect(marketingShareError("101")).toMatch(/10 to 100/);
    expect(marketingPerHour(500, 80)).toBe(400);
    expect(marketingPerHour(3, 10)).toBe(1);
  });

  it("explains KYC_NOT_APPROVED", () => {
    const error = { graphQLErrors: [{ message: "x", extensions: { code: "CONFLICT", reason: "KYC_NOT_APPROVED" } }] };
    expect(messagingFailureCopy(error)).toMatch(/KYC/);
  });
});
