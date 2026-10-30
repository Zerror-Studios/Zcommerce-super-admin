/**
 * Settings sections and searchable fields (04 S-00, S-07). Groups: Your account · Platform · Records; Sign out
 * is a menu action after a divider (Settings.tsx). Field ids are the DOM ids the sections give their inputs or
 * cards: the settings search opens `/settings/:section#id` and the shell focuses and flashes that field.
 */
import type { ComponentType } from "react";
import type { SettingsSearchEntry } from "../ui";
import { IconAi, IconLock, IconPayments, IconPercent, IconPlans, IconSettings, IconUser, IconCustomers } from "../ui/icons";
import { SETTINGS_SECTION_KEYS, type SettingsSectionKey } from "./settings-routes";

type SectionIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface SettingsSectionMeta {
  label: string;
  description: string;
  icon: SectionIcon;
  keywords?: string[];
}

export const SETTINGS_SECTIONS: Record<SettingsSectionKey, SettingsSectionMeta> = {
  profile: {
    label: "Profile & security",
    description: "Your account, password, two-step verification and signed-in devices.",
    icon: IconUser,
    keywords: ["account", "password", "sessions", "devices", "sign out everywhere"],
  },
  team: {
    label: "Team & roles",
    description: "Zerror staff who can sign in to this console, and what each role can do.",
    icon: IconCustomers,
    keywords: ["admins", "members", "invite", "permissions"],
  },
  general: {
    label: "General",
    description: "Small platform settings that don't need their own page.",
    icon: IconSettings,
    keywords: ["health", "thresholds", "keyboard", "shortcuts", "hotkeys"],
  },
  plans: {
    label: "Plans & pricing",
    description: "What stores can buy: every plan, its price and limits, and the stores on it.",
    icon: IconPlans,
    keywords: ["plan limits", "custom plans", "pricing"],
  },
  discounts: {
    label: "Discounts",
    description: "Discount codes stores can apply to their plan.",
    icon: IconPercent,
    keywords: ["coupons", "codes"],
  },
  billing: {
    label: "Payments & billing rules",
    description: "How stores pay Zcom, the grace period, renewal reminders and what happens when a store doesn't pay.",
    icon: IconPayments,
    keywords: ["payment gateway", "provider", "grace period", "reminders", "overdue", "jobs"],
  },
  ai: {
    label: "ZCOM AI settings",
    description: "Models, prices, spend caps and limits for every store's AI. Changes reach every service within 60 seconds.",
    icon: IconAi,
    keywords: ["ai", "models", "spend", "budget"],
  },
  audit: {
    label: "Audit log",
    description: "Every change made from this console, newest first.",
    icon: IconLock,
    keywords: ["history", "changes", "log"],
  },
};

/** Menu groups (04 S-00): micro labels in sentence case, shown uppercase. */
export const SETTINGS_GROUPS: { label: string; keys: SettingsSectionKey[] }[] = [
  { label: "Your account", keys: ["profile", "team"] },
  { label: "Platform", keys: ["general", "plans", "discounts", "billing", "ai"] },
  { label: "Records", keys: ["audit"] },
];

interface FieldEntry {
  id: string;
  label: string;
  keywords?: string[];
}

/** Searchable fields per section; each id exists in that section's DOM. */
export const SETTINGS_FIELDS: Partial<Record<SettingsSectionKey, FieldEntry[]>> = {
  profile: [
    { id: "account", label: "Your account", keywords: ["name", "email", "role"] },
    { id: "two-step", label: "Two-step verification", keywords: ["mfa", "authenticator"] },
    { id: "password-current", label: "Change password", keywords: ["current password", "new password"] },
    { id: "sessions", label: "Sessions", keywords: ["devices", "revoke"] },
    { id: "sign-out-everywhere", label: "Sign out everywhere", keywords: ["logout", "sessions"] },
  ],
  team: [
    { id: "members", label: "Members", keywords: ["admins", "invite", "two-step"] },
    { id: "roles", label: "Roles", keywords: ["permissions", "access"] },
  ],
  general: [
    { id: "health-renewal", label: "Flag a store at risk when its renewal is within", keywords: ["health", "threshold"] },
    { id: "health-inactive", label: "Flag a store inactive after", keywords: ["health", "threshold", "activity"] },
    { id: "shortcuts", label: "Keyboard shortcuts", keywords: ["hotkeys", "keys"] },
  ],
  plans: [
    { id: "plan-limits", label: "Plan limits", keywords: ["mode", "enforce", "log only"] },
    { id: "plans-on-sale", label: "Plans on sale", keywords: ["prices"] },
    { id: "custom-plans", label: "Custom plans" },
  ],
  billing: [
    { id: "provider", label: "Payment provider", keywords: ["gateway", "razorpay", "nimbbl", "manual"] },
    { id: "billing-support-contact", label: "Billing support contact" },
    { id: "billing-bank-instructions", label: "Bank transfer instructions", keywords: ["upi", "ifsc"] },
    { id: "grace-period", label: "Default grace period", keywords: ["days"] },
    { id: "reminders", label: "Renewal reminders", keywords: ["channels", "email", "sms", "whatsapp"] },
    { id: "reminder-text", label: "Reminder text", keywords: ["message", "template"] },
    { id: "sent-reminders", label: "Sent reminders", keywords: ["log"] },
    { id: "overdue", label: "Overdue payments", keywords: ["pause", "suspend", "dunning"] },
    { id: "dunning-pause", label: "Pause orders after" },
    { id: "dunning-suspend", label: "Suspend after" },
    { id: "dunning-trial", label: "Suspend an unpaid trial after" },
    { id: "billing-jobs", label: "Billing jobs", keywords: ["run now", "recent runs"] },
  ],
  ai: [
    { id: "assistant", label: "Assistant", keywords: ["models", "switch off"] },
    { id: "ai-default-model", label: "Default model" },
    { id: "ai-reasoning-model", label: "Reasoning model" },
    { id: "spend", label: "Spend", keywords: ["budget"] },
    { id: "ai-daily-cap", label: "Daily spend cap" },
    { id: "ai-monthly-budget", label: "Monthly budget" },
    { id: "ai-alerts", label: "Budget alerts" },
    { id: "ai-usd-inr", label: "USD to INR rate" },
    { id: "limits", label: "Limits" },
    { id: "ai-token-ceiling", label: "Tokens per question" },
    { id: "ai-rate-limit", label: "Questions per minute per store" },
    { id: "ai-benchmark-min", label: "Stores per benchmark" },
    { id: "night", label: "Night window", keywords: ["insights", "time"] },
    { id: "prices", label: "Model prices", keywords: ["tokens", "cache"] },
  ],
};

export const settingsHref = (key: SettingsSectionKey) => `/settings/${key}`;

/** Sections first, then their fields, for <SettingsSearch>. */
export function settingsSearchEntries(): SettingsSearchEntry[] {
  const entries: SettingsSearchEntry[] = [];
  for (const key of SETTINGS_SECTION_KEYS) {
    const meta = SETTINGS_SECTIONS[key];
    entries.push({ key, label: meta.label, href: settingsHref(key), keywords: meta.keywords });
    for (const field of SETTINGS_FIELDS[key] ?? []) {
      entries.push({
        key: `${key}:${field.id}`,
        label: field.label,
        section: meta.label,
        href: settingsHref(key),
        fieldId: field.id,
        keywords: field.keywords,
      });
    }
  }
  return entries;
}
