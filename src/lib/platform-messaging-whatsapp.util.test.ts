/**
 * Backend PRD-051 W1 (console): the WHATSAPP_ONBOARD task form, a store's
 * WhatsApp number (status chip, the edit's checks and changed-only input)
 * and WhatsApp rates per Meta category (D13 Q2 defaults).
 */
import { describe, expect, it } from "vitest";

import {
  TASK_TYPE_HINT,
  TASK_TYPE_LABEL,
  WHATSAPP_CATEGORY_DEFAULT_PAISE,
  completeTaskDraftOf,
  completeTaskInputOf,
  validateCompleteTask,
  validateWhatsAppEdit,
  validateWhatsAppRatesDraft,
  whatsAppEditDraftOf,
  whatsAppEditInputOf,
  whatsAppRatesDraftOf,
  whatsAppRatesInputOf,
  whatsAppStatusChip,
  type MessagingRates,
  type MessagingTask,
  type WhatsAppNumber,
} from "./platform-messaging.util";

const RATES = {
  version: 1,
  updatedAt: null,
  updatedBy: null,
  EMAIL: { MARKETING: 0, TRANSACTIONAL: 0, SERVICE: 0 },
  SMS: { MARKETING: 0, TRANSACTIONAL: 0, SERVICE: 0 },
  WHATSAPP: { MARKETING: 0, TRANSACTIONAL: 0, SERVICE: 0 },
  WHATSAPP_CATEGORY: { ...WHATSAPP_CATEGORY_DEFAULT_PAISE },
} as MessagingRates;

const NUMBER: WhatsAppNumber = {
  status: "IN_REVIEW",
  number: "919800000001",
  wabaId: "waba-1",
  displayName: "Nahara",
  displayNameStatus: "PENDING",
  businessVerification: "UNKNOWN",
  limitTier: "TIER_1K",
  qualityRating: "GREEN",
  requestedNumber: "919800000001",
  requestedDisplayName: "Nahara",
  requestedAt: null,
  connectedAt: null,
  healthCheckedAt: null,
  healthSource: "CONSOLE",
  healthError: null,
  statusNote: null,
};

describe("PRD-051 console WhatsApp helpers", () => {
  it("completes WHATSAPP_ONBOARD from the store's request with the number, WABA id and name", () => {
    expect(TASK_TYPE_LABEL.WHATSAPP_ONBOARD).toBe("Connect WhatsApp number");
    expect(TASK_TYPE_HINT.WHATSAPP_ONBOARD).toMatch(/Add Number/);
    const task = {
      type: "WHATSAPP_ONBOARD",
      subject: "",
      values: [
        { label: "Number", value: "+919800000001" },
        { label: "Display name", value: "Nahara" },
      ],
    } as unknown as MessagingTask;
    const draft = completeTaskDraftOf(task);
    expect(draft).toMatchObject({ whatsappNumber: "+919800000001", displayName: "Nahara", wabaId: "", displayNameApproved: false });
    expect(validateCompleteTask(task, draft)).toEqual({ wabaId: "Enter the WhatsApp Business Account id" });
    const ready = { ...draft, wabaId: " 1029384756 ", displayNameApproved: true };
    expect(validateCompleteTask(task, ready)).toEqual({});
    expect(completeTaskInputOf(task, ready)).toEqual({
      whatsappNumber: "919800000001",
      wabaId: "1029384756",
      displayName: "Nahara",
      displayNameApproved: true,
    });
    expect(completeTaskDraftOf({ values: [{ label: "Number", value: "Not given" }] } as any).whatsappNumber).toBe("");
  });

  it("edits a number: checks, and sends only what changed", () => {
    expect(whatsAppStatusChip("FLAGGED")).toEqual({ label: "Flagged", tone: "warning" });
    expect(whatsAppStatusChip("BOGUS")).toEqual({ label: "Not set up", tone: "neutral" });
    const draft = whatsAppEditDraftOf(NUMBER);
    expect(whatsAppEditInputOf(draft, NUMBER)).toBeNull();
    const changed = { ...draft, status: "ACTIVE" as const, qualityRating: "YELLOW", statusNote: "  Quality dipped " };
    expect(whatsAppEditInputOf(changed, NUMBER)).toEqual({ status: "ACTIVE", qualityRating: "YELLOW", statusNote: "Quality dipped" });
    expect(whatsAppEditInputOf({ ...draft, number: "+91 98000 00002" }, NUMBER)).toEqual({ number: "919800000002" });
    expect(validateWhatsAppEdit({ ...draft, number: "123" }).number).toBeTruthy();
    expect(validateWhatsAppEdit({ ...whatsAppEditDraftOf(null), status: "ACTIVE" }).number).toBe("A live number needs the number");
    expect(validateWhatsAppEdit({ ...draft, wabaId: "x" }).wabaId).toBeTruthy();
    expect(validateWhatsAppEdit(draft)).toEqual({});
  });

  it("drafts, checks and sends WhatsApp rates per category", () => {
    const draft = whatsAppRatesDraftOf(RATES);
    expect(draft).toEqual({ MARKETING: "0.95", UTILITY: "0.15", AUTHENTICATION: "0.15", SERVICE: "0.00" });
    expect(whatsAppRatesInputOf(draft, RATES)).toBeNull();
    expect(whatsAppRatesInputOf({ ...draft, UTILITY: "0.18" }, RATES)).toEqual({
      MARKETING: 95,
      UTILITY: 18,
      AUTHENTICATION: 15,
      SERVICE: 0,
    });
    expect(validateWhatsAppRatesDraft({ ...draft, MARKETING: "abc" })).toEqual({
      "rates.WHATSAPP_CATEGORY.MARKETING": "Enter rupees, like 0.95",
    });
    // A rates answer without categories reads the defaults
    const { WHATSAPP_CATEGORY: _omit, ...old } = RATES;
    expect(whatsAppRatesDraftOf(old as MessagingRates).MARKETING).toBe("0.95");
  });
});
