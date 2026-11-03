/**
 * Ask ZCOM for staff: pure turn state (backend PRD-026 FR-7.2, guide §12)
 *
 * - `applyRun`: one polled run on a turn. `delta` is appended while the
 *   run is RUNNING; when it ends, the stored `message.text` (the final,
 *   cleaned answer) replaces what streamed.
 * - `turnsFromConversation`: a stored conversation (USER / ASSISTANT
 *   messages) as turns.
 * - `askQuestionText`, `pollOutcome`, `canRetrySameId`: the send and
 *   poll rules from the 2026-11-03 console review (backend
 *   `docs/reviews/2026-11-03-super-admin-chat-fe-fixes.md`, FE-1..FE-4).
 * - `consolePath`: only console paths become links in answers.
 * - `splitStoreNames`: store names in answer text, matched against the
 *   loaded stores, become links to Store detail.
 */

import type {
  PlatformAssistantMessage,
  PlatformAssistantRating,
  PlatformAssistantRun,
  PlatformAssistantToolActivity,
} from "../types/platform-insights";

// ─── Types ────────────────────────────────────────────────────────────────

export interface AskTurn {
  /** Stable row key and the `clientMessageId` sent with the question. */
  clientMessageId: string;
  question: string;
  runId?: string;
  /** SENDING, RUNNING, COMPLETED, COMPLETED_PARTIAL, CANCELLED or FAILED */
  status: string;
  text: string;
  toolActivity: PlatformAssistantToolActivity[];
  messageId?: string;
  sources: string[];
  rating?: PlatformAssistantRating | null;
  /** The run's `error.reason` (FAILED / COMPLETED_PARTIAL). */
  runErrorReason?: string | null;
  /** A refused or unsent question. */
  sendError?: {
    message: string;
    reason: string | null;
    code: string | null;
    /** Network error: retry with the same `clientMessageId`. */
    canRetrySame: boolean;
  };
}

/** A store an answer may name. */
export interface NamedStore {
  id: string;
  name: string;
}

export type AnswerSegment =
  | { kind: "text"; text: string }
  | { kind: "store"; text: string; storeId: string };

/** Store names shorter than this are never linked (too many false hits). */
const STORE_NAME_MIN_LENGTH = 3;

/** FE-2: the client's safety net; the backend ends a run after 90 s. */
export const ASK_POLL_TIMEOUT_MS = 2 * 60 * 1000;

/** FE-2: polls that fail in a row before the console gives up. */
export const ASK_MAX_POLL_FAILURES = 3;

/** Pairs of quotes that wrap a pasted question. */
const WRAPPING_QUOTES: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["\u201c", "\u201d"],
  ["'", "'"],
];

export type PollOutcome = "CONTINUE" | "ENDED" | "TIMED_OUT" | "UNREACHABLE";

// ─── Turns ────────────────────────────────────────────────────────────────

export function isTurnBusy(turn: Pick<AskTurn, "status">): boolean {
  return turn.status === "RUNNING" || turn.status === "SENDING";
}

/**
 * FE-3: the question as typed, trimmed. One pair of quotes around the
 * whole question (a pasted, quoted question) is dropped, so the model
 * never sees `"\"…\""`; quotes inside the question stay.
 */
export function askQuestionText(raw: string): string {
  const text = String(raw ?? "").trim();
  for (const [open, close] of WRAPPING_QUOTES) {
    if (text.length > 2 && text.startsWith(open) && text.endsWith(close)) {
      const inner = text.slice(open.length, -close.length).trim();
      if (inner && !inner.includes(open) && !inner.includes(close)) return inner;
    }
  }
  return text;
}

/**
 * FE-2: whether to poll again. A run that isn't RUNNING has ended; past
 * `ASK_POLL_TIMEOUT_MS` or after `ASK_MAX_POLL_FAILURES` failed polls in a
 * row the console stops.
 */
export function pollOutcome(input: {
  status: string | null;
  failures: number;
  startedAt: number;
  now: number;
}): PollOutcome {
  // COMPLETED, COMPLETED_PARTIAL, CANCELLED, FAILED: only RUNNING continues
  if (input.status && input.status !== "RUNNING") return "ENDED";
  if (input.failures >= ASK_MAX_POLL_FAILURES) return "UNREACHABLE";
  if (input.now - input.startedAt > ASK_POLL_TIMEOUT_MS) return "TIMED_OUT";
  return "CONTINUE";
}

/**
 * FE-4: a send that never got an answer (network error, 5xx) is retried
 * with the same `clientMessageId`, so the backend returns the same run; an
 * answered error never is.
 */
export function canRetrySameId(error: unknown): boolean {
  const e = error as { networkError?: unknown; graphQLErrors?: unknown[] } | null;
  if (e?.graphQLErrors?.length) return false;
  return Boolean(e?.networkError);
}

/** A polled run applied to its turn. */
export function applyRun(turn: AskTurn, run: PlatformAssistantRun): AskTurn {
  const isDone = run.status !== "RUNNING";
  return {
    ...turn,
    runId: run.id,
    status: run.status,
    text: isDone && run.message ? run.message.text : `${turn.text}${run.delta ?? ""}`,
    toolActivity: run.toolActivity?.length ? run.toolActivity : turn.toolActivity,
    messageId: run.message?.id ?? turn.messageId,
    sources: run.message?.sources ?? turn.sources,
    rating: run.message?.rating ?? turn.rating,
    runErrorReason: run.error?.reason ?? null,
  };
}

/** A stored conversation as turns (each USER message, then its answer). */
export function turnsFromConversation(messages: PlatformAssistantMessage[]): AskTurn[] {
  const turns: AskTurn[] = [];
  for (const message of messages) {
    if (message.role === "USER") {
      turns.push({
        clientMessageId: `stored-${message.id}`,
        question: message.text,
        status: "COMPLETED",
        text: "",
        toolActivity: [],
        sources: [],
      });
    } else if (turns.length > 0) {
      const last = turns[turns.length - 1];
      turns[turns.length - 1] = {
        ...last,
        status: message.status ?? "COMPLETED",
        text: message.text,
        messageId: message.id,
        sources: message.sources ?? [],
        rating: message.rating ?? null,
      };
    }
  }
  return turns;
}

/** "Used: Money, Stores" from the tools the answer read; "" when none. */
export function formatSources(sources: string[]): string {
  const unique = Array.from(new Set(sources.filter(Boolean)));
  return unique.length ? `Used: ${unique.join(", ")}` : "";
}

// ─── Links ────────────────────────────────────────────────────────────────

/**
 * A console path from an answer link, or null. Only relative paths stay
 * links (guide §12); anything with a scheme, host or `//` is text.
 */
export function consolePath(href: string): string | null {
  const value = String(href ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits `text` around store names it mentions (whole words, case kept as
 * typed by the answer, longest name first so "Kesar & Kin" wins over
 * "Kesar"). Names under three characters are ignored.
 */
export function splitStoreNames(text: string, stores: NamedStore[]): AnswerSegment[] {
  const usable = stores
    .filter((store) => store.name && store.name.trim().length >= STORE_NAME_MIN_LENGTH)
    .sort((a, b) => b.name.length - a.name.length);
  if (!text || usable.length === 0) return [{ kind: "text", text }];
  const byName = new Map(usable.map((store) => [store.name.trim().toLowerCase(), store.id]));
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${usable.map((store) => escapeRegex(store.name.trim())).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const storeId = byName.get(match[0].toLowerCase());
    if (!storeId) continue;
    if (index > last) segments.push({ kind: "text", text: text.slice(last, index) });
    segments.push({ kind: "store", text: match[0], storeId });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments.length ? segments : [{ kind: "text", text }];
}
