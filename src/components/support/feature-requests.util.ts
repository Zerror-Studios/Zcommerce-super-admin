/**
 * Support › Feature requests (backend PRD-049 step A3, FR-A29, D13): the
 * board's labels and tones, the status tabs, the list's URL state, what the
 * caller may do, the status / edit / reply checks that mirror the server's,
 * the server error mapping and the up-voters' plan value.
 *
 * Pure: no React. The page, the drawer and the dialogs read it.
 */

import type { Tone } from "../ui";
import { formatMoney } from "../ui/money";
import {
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from "../../lib/permissions";
import { errorCodeOf, errorReasonOf } from "../../lib/apollo-client";
import { mutationFailureCopy } from "../../lib/mutation-errors";

// ─── Types ────────────────────────────────────────────────────────────────

export type FeatureStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "PLANNED"
  | "IN_PROGRESS"
  | "RELEASED"
  | "NOT_PLANNED"
  | "MERGED";
export type FeatureType = "FEATURE" | "IMPROVEMENT";
export type FeatureVote = "UP" | "DOWN";
export type FeatureSort = "TOP" | "NEW" | "UPDATED";
/** ALL = every status except MERGED (the server's default list). */
export type FeatureTab = "ALL" | FeatureStatus;

export interface FeatureRequest {
  id: string;
  ref: string;
  title: string;
  type: FeatureType;
  typeLabel: string;
  area: string;
  areaLabel: string;
  problem: string;
  status: FeatureStatus;
  statusLabel: string;
  statusNote: string;
  releaseUrl?: string | null;
  statusChangedAt?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
  createdByName?: string | null;
  upVotes: number;
  downVotes: number;
  score: number;
  commentCount: number;
  hidden: boolean;
  mergedIntoId?: string | null;
  lastActivityAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureVoteRow {
  storeId: string;
  storeName: string;
  storeSlug?: string | null;
  planName?: string | null;
  vote: FeatureVote;
  reason?: string | null;
  votedByName?: string | null;
  votedAt: string;
}

export interface FeatureVotesByPlan {
  plan: string;
  up: number;
  down: number;
}

export interface FeatureComment {
  id: string;
  body: string;
  authorName: string;
  fromZerror: boolean;
  storeName?: string | null;
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
}

export interface FeatureRequestDetail extends FeatureRequest {
  votes: FeatureVoteRow[];
  votesByPlan: FeatureVotesByPlan[];
  upVoterMonthlyValue: number;
  currency: string;
  comments: FeatureComment[];
}

export interface FeatureStatusCount {
  status: FeatureStatus;
  label: string;
  count: number;
}

// ─── Labels and tones ─────────────────────────────────────────────────────

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  RELEASED: "Released",
  NOT_PLANNED: "Not planned",
  MERGED: "Merged",
};

export const FEATURE_STATUS_TONE: Record<FeatureStatus, Tone> = {
  OPEN: "neutral",
  UNDER_REVIEW: "info",
  PLANNED: "info",
  IN_PROGRESS: "warning",
  RELEASED: "success",
  NOT_PLANNED: "neutral",
  MERGED: "neutral",
};

/** FR-A29: what the console may set (MERGED only through Merge into…). */
export const FEATURE_SETTABLE_STATUSES: FeatureStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
  "PLANNED",
  "IN_PROGRESS",
  "RELEASED",
  "NOT_PLANNED",
];

/** FR-A29: moving to one of these tells every store that posted or voted. */
const NOTIFYING_STATUSES: FeatureStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "RELEASED",
  "NOT_PLANNED",
];

export function statusNotifiesStores(status: FeatureStatus): boolean {
  return NOTIFYING_STATUSES.includes(status);
}

/** Mirror of core `SUPPORT_TOPICS` (the request's area). */
export const FEATURE_AREA_OPTIONS: { value: string; label: string }[] = [
  { value: "ORDERS", label: "Orders" },
  { value: "PAYMENTS", label: "Payments" },
  { value: "PRODUCTS", label: "Products" },
  { value: "SHIPPING", label: "Shipping" },
  { value: "MARKETING", label: "Marketing" },
  { value: "STORE_DESIGN", label: "Store design" },
  { value: "SETTINGS", label: "Settings" },
  { value: "BILLING", label: "Billing" },
  { value: "OTHER", label: "Something else" },
];

export const FEATURE_TYPE_OPTIONS: { value: FeatureType; label: string }[] = [
  { value: "FEATURE", label: "New feature" },
  { value: "IMPROVEMENT", label: "Improvement" },
];

export const FEATURE_SORT_OPTIONS: { key: FeatureSort; label: string }[] = [
  { key: "TOP", label: "Most votes" },
  { key: "NEW", label: "Newest" },
  { key: "UPDATED", label: "Recently updated" },
];

/** "+3", "−2", "0" (typographic minus). */
export function scoreLabel(score: number): string {
  if (score > 0) return `+${score}`;
  if (score < 0) return `−${Math.abs(score)}`;
  return "0";
}

export function scoreTone(score: number): Tone {
  if (score > 0) return "success";
  if (score < 0) return "danger";
  return "neutral";
}

/** FR-A29: the up-voting stores' monthly plan value, "₹12,500 a month". */
export function upVoterValueLabel(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "No paid plans";
  return `${formatMoney(value, { currency: currency || "INR" })} a month`;
}

/** The row's "last activity": the server's, else the last update. */
export function lastActivityOf(
  row: Pick<FeatureRequest, "lastActivityAt" | "updatedAt">,
): string {
  return row.lastActivityAt || row.updatedAt;
}

// ─── Tabs and URL state ───────────────────────────────────────────────────

export const FEATURE_TABS: { value: FeatureTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RELEASED", label: "Released" },
  { value: "NOT_PLANNED", label: "Not planned" },
  { value: "MERGED", label: "Merged" },
];

/** A tab's count from the server's per-status counts (ALL leaves MERGED out). */
export function featureTabCount(
  counts: FeatureStatusCount[] | null | undefined,
  tab: FeatureTab,
): number | undefined {
  if (!counts) return undefined;
  if (tab === "ALL") {
    return counts
      .filter((row) => row.status !== "MERGED")
      .reduce((sum, row) => sum + row.count, 0);
  }
  return counts.find((row) => row.status === tab)?.count ?? 0;
}

export interface FeatureBoardState {
  tab: FeatureTab;
  sort: FeatureSort;
  area: string | null;
  type: FeatureType | null;
  includeHidden: boolean;
}

/** URL params the board owns (`q`, `page`, `size` belong to the table). */
export const FEATURE_PARAMS = {
  status: "status",
  sort: "order",
  area: "area",
  type: "type",
  hidden: "hidden",
  request: "request",
} as const;

const isTab = (value: string): value is FeatureTab =>
  FEATURE_TABS.some((tab) => tab.value === value);

/** The board's state from the URL filters; anything unknown falls back. */
export function featureBoardStateOf(
  filters: Record<string, string | undefined>,
): FeatureBoardState {
  const status = (filters[FEATURE_PARAMS.status] ?? "").toUpperCase();
  const sort = (filters[FEATURE_PARAMS.sort] ?? "").toUpperCase();
  const area = (filters[FEATURE_PARAMS.area] ?? "").toUpperCase();
  const type = (filters[FEATURE_PARAMS.type] ?? "").toUpperCase();
  return {
    tab: isTab(status) ? status : "ALL",
    sort: FEATURE_SORT_OPTIONS.some((option) => option.key === sort)
      ? (sort as FeatureSort)
      : "TOP",
    area: FEATURE_AREA_OPTIONS.some((option) => option.value === area)
      ? area
      : null,
    type: FEATURE_TYPE_OPTIONS.some((option) => option.value === type)
      ? (type as FeatureType)
      : null,
    includeHidden: filters[FEATURE_PARAMS.hidden] === "1",
  };
}

/** URL changes for a new state (defaults are left out of the URL). */
export function featureBoardParams(
  state: FeatureBoardState,
): Record<string, string | undefined> {
  return {
    [FEATURE_PARAMS.status]: state.tab === "ALL" ? undefined : state.tab,
    [FEATURE_PARAMS.sort]: state.sort === "TOP" ? undefined : state.sort,
    [FEATURE_PARAMS.area]: state.area ?? undefined,
    [FEATURE_PARAMS.type]: state.type ?? undefined,
    [FEATURE_PARAMS.hidden]: state.includeHidden ? "1" : undefined,
  };
}

/** `platformFeatureRequests` variables for the board. */
export function featureBoardVariables(
  state: FeatureBoardState,
  search: string,
  limit: number,
  offset: number,
) {
  const text = search.trim();
  return {
    sort: state.sort,
    status: state.tab === "ALL" ? null : state.tab,
    area: state.area,
    type: state.type,
    search: text || null,
    includeHidden: state.includeHidden,
    limit,
    offset,
  };
}

/** How many drawer filters are on (area, type); the hidden toggle is its own. */
export function featureFilterCount(state: FeatureBoardState): number {
  return (state.area ? 1 : 0) + (state.type ? 1 : 0);
}

// ─── Permissions ──────────────────────────────────────────────────────────

export interface FeatureAbilities {
  /** Open the board and a request. */
  read: boolean;
  /** Status, merge, edit, hide, reply, pin, hide comments. */
  manage: boolean;
}

/** PRD-049 A3: reads with support:read or feedback:manage; the server decides. */
export function featureAbilities(
  can: (permission: PlatformPermission) => boolean,
): FeatureAbilities {
  const manage = can(PLATFORM_PERMISSIONS.FEEDBACK_MANAGE);
  return { read: manage || can(PLATFORM_PERMISSIONS.SUPPORT_READ), manage };
}

// ─── Status dialog ────────────────────────────────────────────────────────

/** Core `FEATURE_STATUS_NOTE_MAX`. */
export const FEATURE_STATUS_NOTE_MAX_CHARS = 1000;
const URL_MAX_CHARS = 1000;

export interface FeatureStatusDraft {
  status: FeatureStatus;
  note: string;
  releaseUrl: string;
}

export type FeatureStatusErrors = Partial<
  Record<"status" | "note" | "releaseUrl" | "form", string>
>;

export function statusDraftOf(
  row: Pick<FeatureRequest, "status" | "statusNote" | "releaseUrl">,
): FeatureStatusDraft {
  return {
    status: row.status === "MERGED" ? "OPEN" : row.status,
    note: row.statusNote ?? "",
    releaseUrl: row.releaseUrl ?? "",
  };
}

/** A full https link (the release article). */
export function isHttpsUrl(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > URL_MAX_CHARS || /\s/.test(text)) return false;
  try {
    return new URL(text).protocol === "https:";
  } catch {
    return false;
  }
}

/** The server's checks, before sending (empty = fine). */
export function validateStatusDraft(
  draft: FeatureStatusDraft,
): FeatureStatusErrors {
  const errors: FeatureStatusErrors = {};
  if (!FEATURE_SETTABLE_STATUSES.includes(draft.status)) {
    errors.status = "Pick a status. Merging is done with Merge into.";
  }
  const note = draft.note.trim();
  if (note.length > FEATURE_STATUS_NOTE_MAX_CHARS) {
    errors.note = `Keep the note under ${FEATURE_STATUS_NOTE_MAX_CHARS} characters.`;
  } else if (draft.status === "NOT_PLANNED" && !note) {
    errors.note = "Say why it isn't planned. Every store that voted sees it.";
  }
  const url = draft.releaseUrl.trim();
  if (draft.status === "RELEASED" && url && !isHttpsUrl(url)) {
    errors.releaseUrl = "Enter a full link starting with https://";
  }
  return errors;
}

/** The mutation input; the link is sent only for RELEASED. */
export function statusInputOf(draft: FeatureStatusDraft) {
  const url = draft.releaseUrl.trim();
  return {
    status: draft.status,
    note: draft.note.trim(),
    releaseUrl: draft.status === "RELEASED" && url ? url : null,
  };
}

/** False when saving would change nothing (the server answers a no-op). */
export function statusDraftChanged(
  draft: FeatureStatusDraft,
  row: Pick<FeatureRequest, "status" | "statusNote" | "releaseUrl">,
): boolean {
  const input = statusInputOf(draft);
  return (
    input.status !== row.status ||
    input.note !== (row.statusNote ?? "").trim() ||
    (input.releaseUrl ?? "") !== (row.releaseUrl ?? "")
  );
}

// ─── Edit and reply ───────────────────────────────────────────────────────

/** Core `FEATURE_TITLE_MAX` / `FEATURE_PROBLEM_MAX` / `FEATURE_COMMENT_MAX`. */
export const FEATURE_TITLE_MIN_CHARS = 5;
export const FEATURE_TITLE_MAX_CHARS = 140;
export const FEATURE_PROBLEM_MIN_CHARS = 10;
export const FEATURE_PROBLEM_MAX_CHARS = 4000;
export const FEATURE_COMMENT_MAX_CHARS = 2000;

export interface FeatureEditDraft {
  title: string;
  type: FeatureType;
  area: string;
  problem: string;
}

export type FeatureEditErrors = Partial<
  Record<keyof FeatureEditDraft | "form", string>
>;

export function editDraftOf(row: FeatureRequest): FeatureEditDraft {
  return {
    title: row.title,
    type: row.type,
    area: row.area,
    problem: row.problem,
  };
}

export function validateEditDraft(draft: FeatureEditDraft): FeatureEditErrors {
  const errors: FeatureEditErrors = {};
  const title = draft.title.trim();
  if (title.length < FEATURE_TITLE_MIN_CHARS) {
    errors.title = `Use at least ${FEATURE_TITLE_MIN_CHARS} characters.`;
  } else if (title.length > FEATURE_TITLE_MAX_CHARS) {
    errors.title = `Keep it under ${FEATURE_TITLE_MAX_CHARS} characters.`;
  }
  const problem = draft.problem.trim();
  if (problem.length < FEATURE_PROBLEM_MIN_CHARS) {
    errors.problem = `Use at least ${FEATURE_PROBLEM_MIN_CHARS} characters.`;
  } else if (problem.length > FEATURE_PROBLEM_MAX_CHARS) {
    errors.problem = `Keep it under ${FEATURE_PROBLEM_MAX_CHARS} characters.`;
  }
  if (!FEATURE_TYPE_OPTIONS.some((option) => option.value === draft.type)) {
    errors.type = "Pick a type.";
  }
  if (!FEATURE_AREA_OPTIONS.some((option) => option.value === draft.area)) {
    errors.area = "Pick an area.";
  }
  return errors;
}

/** Only the changed fields (null when nothing changed). */
export function editInputOf(
  draft: FeatureEditDraft,
  row: FeatureRequest,
): Partial<FeatureEditDraft> | null {
  const input: Partial<FeatureEditDraft> = {};
  if (draft.title.trim() !== row.title) input.title = draft.title.trim();
  if (draft.problem.trim() !== row.problem) input.problem = draft.problem.trim();
  if (draft.type !== row.type) input.type = draft.type;
  if (draft.area !== row.area) input.area = draft.area;
  return Object.keys(input).length ? input : null;
}

/** A reply's text, or the reason it can't be sent. */
export function replyError(body: string): string | null {
  const text = body.trim();
  if (!text) return "Write a reply.";
  if (text.length > FEATURE_COMMENT_MAX_CHARS) {
    return `Keep the reply under ${FEATURE_COMMENT_MAX_CHARS} characters.`;
  }
  return null;
}

// ─── Merge ────────────────────────────────────────────────────────────────

/** Requests a source can merge into: not itself, not already merged. */
export function mergeCandidates<
  T extends Pick<FeatureRequest, "id" | "status">,
>(items: T[], sourceId: string): T[] {
  return items.filter(
    (item) => item.id !== sourceId && item.status !== "MERGED",
  );
}

// ─── Server errors ────────────────────────────────────────────────────────

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

/** Console copy for the board's `extensions.reason` values. */
export const FEATURE_REASON_COPY: Readonly<Record<string, string>> = {
  FEATURE_REQUEST_CHANGED:
    "Someone else changed this request. It's reloaded; check it and try again.",
  FEATURE_REQUEST_MERGED:
    "This request was merged into another one. Open that one instead.",
  FEATURE_REQUEST_NOT_FOUND: "This request no longer exists.",
  FEATURE_COMMENT_NOT_FOUND: "That comment no longer exists.",
  SAME_REQUEST: "Pick another request to merge into.",
  NOT_ZERROR_REPLY: "Only ZCommerce team replies can be pinned.",
};

/** Reasons after which the request should be read again. */
const RELOAD_REASONS = new Set([
  "FEATURE_REQUEST_CHANGED",
  "FEATURE_REQUEST_MERGED",
  "FEATURE_COMMENT_NOT_FOUND",
]);

export function shouldReloadAfter(error: unknown): boolean {
  return RELOAD_REASONS.has(errorReasonOf(error) ?? "");
}

/** The toast text for a failed board mutation (null: nothing more to show). */
export function featureFailureCopy(error: unknown): string | null {
  const reason = errorReasonOf(error);
  if (reason && FEATURE_REASON_COPY[reason]) return FEATURE_REASON_COPY[reason];
  return mutationFailureCopy(error);
}

const FIELD_REASONS = new Set([
  "INVALID_FEATURE_REQUEST",
  "INVALID_FEATURE_STATUS",
  "NOTE_REQUIRED",
  "INVALID_URL",
]);

/**
 * A BAD_USER_INPUT answer as field errors (`extensions.field`), else
 * `{ form }`; null for anything a toast should show.
 */
export function featureFieldErrorsFromServer(
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
