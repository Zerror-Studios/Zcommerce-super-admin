/**
 * Store profile rules for the console (PRD-025 FR-2, FR-6.1)
 *
 * Pure helpers behind the store page's Profile card: the draft the form
 * edits, the tag rules (a mirror of core `store-profile.ts`, so a bad tag
 * is refused before the round trip), the patch with only the changed
 * fields (`null` clears one), labels for the category and source
 * constants, and where a server `INVALID_*` answer lands. The server
 * decides every rule; these only shape what the operator sees and sends.
 */

import type { StoreProfile, StoreProfileInput } from "../types/platform-api";
import { getAppProviderLabel } from "./display-labels.util";

// ─── Constants ────────────────────────────────────────────────────────────

/** FR-2.3: tag rules, the same as core. */
export const MAX_STORE_TAGS = 20;

export const STORE_TAG_MAX_LENGTH = 30;

/** Longest city or state name the server keeps. */
export const STORE_PLACE_MAX_LENGTH = 120;

const STORE_TAG_PATTERN = /^[a-z0-9][a-z0-9 -]*$/;

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Constants whose humanised form needs a hand: the rest are title-cased. */
const PROFILE_OPTION_LABELS: Readonly<Record<string, string>> = {
  FOOD_BEVERAGE: "Food & beverage",
  HOME_DECOR: "Home décor",
  HEALTH_WELLNESS: "Health & wellness",
  BOOKS_STATIONERY: "Books & stationery",
  KIDS: "Kids",
  DISRPTVE: "Disrptve",
};

/** FR-2.4: which field a server reason belongs to. */
const PROFILE_REASON_FIELDS: Readonly<Record<string, StoreProfileField>> = {
  INVALID_CATEGORY: "category",
  INVALID_SOURCE: "source",
  INVALID_TAG: "tags",
  INVALID_ACCOUNT_MANAGER: "accountManagerId",
  INVALID_DATE: "plannedLiveAt",
};

export const TAG_RULE_COPY =
  "Tags are 1–30 letters, digits, spaces or hyphens.";

export const TOO_MANY_TAGS_COPY = `At most ${MAX_STORE_TAGS} tags.`;

// ─── Types ────────────────────────────────────────────────────────────────

/** What the form edits; "" means unset. `plannedLiveAt` is `YYYY-MM-DD`. */
export interface StoreProfileDraft {
  category: string;
  city: string;
  state: string;
  source: string;
  accountManagerId: string;
  tags: string[];
  plannedLiveAt: string;
}

export type StoreProfileField = keyof StoreProfileDraft;

export type StoreProfileErrors = Partial<
  Record<StoreProfileField | "form", string>
>;

const PROFILE_FIELDS: readonly StoreProfileField[] = [
  "category",
  "city",
  "state",
  "source",
  "accountManagerId",
  "tags",
  "plannedLiveAt",
];

// ─── Labels ───────────────────────────────────────────────────────────────

/** "FOOD_BEVERAGE" → "Food & beverage"; "MOVED_PLATFORM" → "Moved platform". */
export function humaniseConstant(value: string): string {
  const override = PROFILE_OPTION_LABELS[value];
  if (override) return override;
  const words = value.toLowerCase().split("_").filter(Boolean);
  if (words.length === 0) return value;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) +
    (words.length > 1 ? ` ${words.slice(1).join(" ")}` : "");
}

/** A category or source constant as the console shows it. */
export function storeProfileOptionLabel(value: string | null | undefined): string {
  return value ? humaniseConstant(value) : "—";
}

/** FR-1.1: the store's payment app name, or null when none is set. */
export function paymentProviderLabel(
  provider: string | null | undefined,
): string | null {
  return provider ? getAppProviderLabel(provider) : null;
}

/**
 * `billingStateReason` as the console shows it: a constant is humanised,
 * free text passes through.
 */
export function billingStateReasonLabel(
  reason: string | null | undefined,
): string | null {
  if (!reason) return null;
  return /^[A-Z0-9_]+$/.test(reason) ? humaniseConstant(reason) : reason;
}

// ─── Draft ────────────────────────────────────────────────────────────────

/** The ISO date's UTC day as `YYYY-MM-DD`, or "" (the console's UTC-day convention). */
export function isoDayOf(value: string | null | undefined): string {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? "" : new Date(time).toISOString().slice(0, 10);
}

export function storeProfileDraftOf(
  profile: StoreProfile | null | undefined,
): StoreProfileDraft {
  return {
    category: profile?.category ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    source: profile?.source ?? "",
    accountManagerId: profile?.accountManager?.id ?? "",
    tags: [...(profile?.tags ?? [])],
    plannedLiveAt: isoDayOf(profile?.plannedLiveAt),
  };
}

// ─── Tags (FR-2.3) ────────────────────────────────────────────────────────

/** One tag lower-cased and trimmed (inner spaces collapsed), or null when it breaks a rule. */
export function normaliseStoreTag(value: string): string | null {
  const tag = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (tag.length === 0 || tag.length > STORE_TAG_MAX_LENGTH) return null;
  return STORE_TAG_PATTERN.test(tag) ? tag : null;
}

/**
 * Adds one typed tag: a duplicate is ignored, a bad tag or the 21st one
 * answers an error and leaves the list as it was.
 */
export function addStoreTag(
  tags: readonly string[],
  input: string,
): { tags: string[]; error?: string } {
  const tag = normaliseStoreTag(input);
  if (tag === null) return { tags: [...tags], error: TAG_RULE_COPY };
  if (tags.includes(tag)) return { tags: [...tags] };
  if (tags.length >= MAX_STORE_TAGS) {
    return { tags: [...tags], error: TOO_MANY_TAGS_COPY };
  }
  return { tags: [...tags, tag] };
}

export function removeStoreTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((current) => current !== tag);
}

// ─── Validation and patch ─────────────────────────────────────────────────

/** The local checks before a save; the server repeats them. */
export function validateStoreProfile(draft: StoreProfileDraft): StoreProfileErrors {
  const errors: StoreProfileErrors = {};
  if (draft.city.trim().length > STORE_PLACE_MAX_LENGTH) {
    errors.city = `Keep it under ${STORE_PLACE_MAX_LENGTH} characters.`;
  }
  if (draft.state.trim().length > STORE_PLACE_MAX_LENGTH) {
    errors.state = `Keep it under ${STORE_PLACE_MAX_LENGTH} characters.`;
  }
  if (draft.tags.length > MAX_STORE_TAGS) errors.tags = TOO_MANY_TAGS_COPY;
  if (draft.tags.some((tag) => normaliseStoreTag(tag) !== tag)) {
    errors.tags = TAG_RULE_COPY;
  }
  if (draft.plannedLiveAt) {
    const valid =
      ISO_DAY_PATTERN.test(draft.plannedLiveAt) &&
      !Number.isNaN(Date.parse(`${draft.plannedLiveAt}T00:00:00Z`));
    if (!valid) errors.plannedLiveAt = "Enter a valid date.";
  }
  return errors;
}

function textPatch(initial: string, draft: string): string | null | undefined {
  const next = draft.trim();
  if (next === initial.trim()) return undefined;
  return next || null;
}

/**
 * FR-2.4: only the fields that changed; a field cleared in the form is
 * sent as `null`. An empty result means nothing to save.
 */
export function storeProfilePatch(
  initial: StoreProfileDraft,
  draft: StoreProfileDraft,
): StoreProfileInput {
  const patch: StoreProfileInput = {};
  const category = textPatch(initial.category, draft.category);
  if (category !== undefined) patch.category = category;
  const source = textPatch(initial.source, draft.source);
  if (source !== undefined) patch.source = source;
  const city = textPatch(initial.city, draft.city);
  if (city !== undefined) patch.city = city;
  const state = textPatch(initial.state, draft.state);
  if (state !== undefined) patch.state = state;
  const manager = textPatch(initial.accountManagerId, draft.accountManagerId);
  if (manager !== undefined) patch.accountManagerId = manager;
  if (initial.tags.join("\u0000") !== draft.tags.join("\u0000")) {
    patch.tags = draft.tags.length > 0 ? [...draft.tags] : null;
  }
  const plannedLiveAt = textPatch(initial.plannedLiveAt, draft.plannedLiveAt);
  if (plannedLiveAt !== undefined) patch.plannedLiveAt = plannedLiveAt;
  return patch;
}

// ─── Server errors ────────────────────────────────────────────────────────

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

function firstError(error: unknown): GraphQLErrorLike | undefined {
  return (error as { graphQLErrors?: GraphQLErrorLike[] })?.graphQLErrors?.[0];
}

/**
 * FR-2.4: a `BAD_USER_INPUT` lands on its field, found from
 * `extensions.field` or the `INVALID_*` reason; anything else is null so
 * the caller toasts it.
 */
export function storeProfileErrorsFromServer(error: unknown): StoreProfileErrors | null {
  const first = firstError(error);
  const code = String(first?.extensions?.code ?? "");
  if (code !== "BAD_USER_INPUT") return null;
  const field = String(first?.extensions?.field ?? "");
  const reason = String(first?.extensions?.reason ?? "");
  const key: StoreProfileField | "form" = PROFILE_FIELDS.includes(field as StoreProfileField)
    ? (field as StoreProfileField)
    : (PROFILE_REASON_FIELDS[reason] ?? "form");
  return { [key]: first?.message || "Check this value." };
}
