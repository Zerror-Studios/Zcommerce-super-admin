/**
 * Store setup (backend PRD-031 FR-B1, FR-D1–D3)
 *
 * Pure helpers for the console's Setup card and the Add store "Business
 * details (optional)" section: a label and tone per setup check, the list
 * order (missing first), the `createTenant` business fields with only what
 * was filled in, and where a server field error lands. The server decides
 * every rule; these only shape what the operator sees and sends.
 */

import type { CreateTenantInput, PlatformStoreSetupCheck } from "../types/platform-api";
import {
  storeProfilePatch,
  storeProfileErrorsFromServer,
  validateStoreProfile,
  type StoreProfileDraft,
  type StoreProfileErrors,
} from "./store-profile.util";

// ─── Constants ────────────────────────────────────────────────────────────

export const STORE_SETUP_LABELS: Readonly<Record<string, string>> = {
  payment_app: "Payment app",
  email_sender: "Email sender",
  sms_sender: "SMS sender",
  shipping_app: "Shipping app",
  warehouse: "Stock location",
  store_profile: "Store profile",
  invoice_details: "Invoice details",
  notifications: "Shopper emails",
  domain: "Domain",
  catalog: "Catalog",
  owner_invite: "Owner sign-in",
};

/** Provisioning step keys as the console names them (PRD-005 FR-3.3, PRD-031 FR-C). */
export const PROVISIONING_STEP_LABELS: Readonly<Record<string, string>> = {
  database: "Store database",
  ownerAdmin: "Owner login",
  channels: "Default apps (Shiprocket, MSG91)",
  notifications: "Standard shopper emails",
  storeSettings: "Invoice settings",
  subscription: "Subscription",
};

const STATUS_ORDER: Readonly<Record<string, number>> = { MISSING: 0, WARNING: 1, OK: 2 };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const BUSINESS_NAME_MAX_LENGTH = 120;

// ─── Types ────────────────────────────────────────────────────────────────

/** The Add store business section; "" means not given. */
export interface BusinessDetailsDraft {
  billingContactEmail: string;
  gstin: string;
  businessName: string;
  profile: StoreProfileDraft;
}

export type BusinessDetailsField = "billingContactEmail" | "gstin" | "businessName";

export interface BusinessDetailsErrors {
  billingContactEmail?: string;
  gstin?: string;
  businessName?: string;
  profile: StoreProfileErrors;
}

export const EMPTY_PROFILE_DRAFT: StoreProfileDraft = {
  category: "",
  city: "",
  state: "",
  source: "",
  accountManagerId: "",
  tags: [],
  plannedLiveAt: "",
};

export const EMPTY_BUSINESS_DETAILS: BusinessDetailsDraft = {
  billingContactEmail: "",
  gstin: "",
  businessName: "",
  profile: EMPTY_PROFILE_DRAFT,
};

// ─── Setup checks ─────────────────────────────────────────────────────────

export function storeSetupLabel(key: string): string {
  return STORE_SETUP_LABELS[key] ?? key.replace(/_/g, " ");
}

export function storeSetupTone(status: string): "success" | "warning" | "neutral" {
  if (status === "OK") return "success";
  if (status === "MISSING") return "warning";
  return "neutral";
}

export function storeSetupStatusLabel(status: string): string {
  if (status === "OK") return "Done";
  if (status === "MISSING") return "Missing";
  return "Check";
}

/** Missing first, then warnings, then done; the server's order within each. */
export function sortStoreSetupChecks(checks: readonly PlatformStoreSetupCheck[]): PlatformStoreSetupCheck[] {
  return checks
    .map((check, index) => ({ check, index }))
    .sort((a, b) => (STATUS_ORDER[a.check.status] ?? 3) - (STATUS_ORDER[b.check.status] ?? 3) || a.index - b.index)
    .map(({ check }) => check);
}

export function storeSetupDoneCount(checks: readonly PlatformStoreSetupCheck[]): number {
  return checks.filter((check) => check.status === "OK").length;
}

export function provisioningStepLabel(key: string): string {
  return PROVISIONING_STEP_LABELS[key] ?? key;
}

// ─── Business details (FR-B1) ─────────────────────────────────────────────

/** The local checks; the server repeats them. */
export function validateBusinessDetails(draft: BusinessDetailsDraft): BusinessDetailsErrors {
  const errors: BusinessDetailsErrors = { profile: validateStoreProfile(draft.profile) };
  const email = draft.billingContactEmail.trim();
  if (email && !EMAIL_PATTERN.test(email)) errors.billingContactEmail = "Enter a valid email.";
  const gstin = draft.gstin.trim().toUpperCase();
  if (gstin && !GSTIN_PATTERN.test(gstin)) errors.gstin = "Enter a 15-character GSTIN, like 27ABCDE1234F1Z5.";
  if (draft.businessName.trim().length > BUSINESS_NAME_MAX_LENGTH) {
    errors.businessName = `Keep it under ${BUSINESS_NAME_MAX_LENGTH} characters.`;
  }
  return errors;
}

export function hasBusinessDetailsErrors(errors: BusinessDetailsErrors): boolean {
  return !!(errors.billingContactEmail || errors.gstin || errors.businessName || Object.values(errors.profile).some(Boolean));
}

/** Only the fields filled in, ready to spread into `CreateTenantInput`. */
export function businessDetailsInput(
  draft: BusinessDetailsDraft,
): Pick<CreateTenantInput, "billingContactEmail" | "gstin" | "businessName" | "profile"> {
  const input: Pick<CreateTenantInput, "billingContactEmail" | "gstin" | "businessName" | "profile"> = {};
  const email = draft.billingContactEmail.trim().toLowerCase();
  if (email) input.billingContactEmail = email;
  const gstin = draft.gstin.trim().toUpperCase();
  if (gstin) input.gstin = gstin;
  const businessName = draft.businessName.trim();
  if (businessName) input.businessName = businessName;
  const profile = storeProfilePatch(EMPTY_PROFILE_DRAFT, draft.profile);
  if (Object.keys(profile).length) input.profile = profile;
  return input;
}

/**
 * A `createTenant` field error for this section, or null when it belongs
 * elsewhere (the store and owner fields handle their own).
 */
export function businessDetailsErrorsFromServer(error: unknown): BusinessDetailsErrors | null {
  const first = (error as { graphQLErrors?: Array<{ message?: string; extensions?: Record<string, unknown> }> })
    ?.graphQLErrors?.[0];
  if (String(first?.extensions?.code ?? "") !== "BAD_USER_INPUT") return null;
  const field = String(first?.extensions?.field ?? "");
  if (field === "billingContactEmail" || field === "gstin" || field === "businessName") {
    return { [field]: first?.message || "Check this value.", profile: {} };
  }
  const profile = storeProfileErrorsFromServer(error);
  if (!profile || profile.form) return null;
  return { profile };
}
