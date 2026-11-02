/**
 * Ask ZCOM for staff: pure turn state (backend PRD-026 FR-7.2, guide §12)
 *
 * - `applyRun`: one polled run on a turn. `delta` is appended while the
 *   run is RUNNING; when it ends, the stored `message.text` (the final,
 *   cleaned answer) replaces what streamed.
 * - `turnsFromConversation`: a stored conversation (USER / ASSISTANT
 *   messages) as turns.
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

// ─── Turns ────────────────────────────────────────────────────────────────

export function isTurnBusy(turn: Pick<AskTurn, "status">): boolean {
  return turn.status === "RUNNING" || turn.status === "SENDING";
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
