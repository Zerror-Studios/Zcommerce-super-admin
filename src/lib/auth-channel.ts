/**
 * Cross-tab session coordination (PRD-001 FR-4.4/4.5, reused for the
 * platform console by PRD-005 FR-11.1)
 *
 * - `withRefreshLock` serialises refreshes across tabs with the Web Locks
 *   API, so two tabs never rotate the refresh cookie at once.
 * - Tabs share fresh access tokens, logins and logouts over a
 *   BroadcastChannel.
 * - Without Web Locks a BroadcastChannel claim makes other tabs wait.
 * Both degrade to single-tab behaviour where the APIs are unavailable.
 *
 * A shared token travels with its session's CSRF token (PRD-014 FR-1.11),
 * so a tab that adopts it can still send mutations.
 */

import { isUsableToken } from "./session-store";

export type SessionEndReason = "EXPIRED" | "REVOKED" | "SIGNED_OUT";

export type AuthMessage =
  | { type: "token"; token: string; csrfToken?: string | null }
  | { type: "login"; token: string; csrfToken?: string | null }
  | { type: "logout"; reason: SessionEndReason }
  | { type: "refresh-start" }
  | { type: "refresh-end" };

// ─── Constants ────────────────────────────────────────────────────────────

const CHANNEL_NAME = "zc-platform-auth";
const LOCK_NAME = "zc-platform-refresh";
/** A token another tab obtained this recently is reused, not rotated again. */
const SHARED_TOKEN_MAX_AGE_MS = 10_000;
/** Longest a tab without Web Locks waits for another tab's refresh. */
const FALLBACK_WAIT_MAX_MS = 20_000;
const FALLBACK_POLL_MS = 100;
const FALLBACK_JITTER_MS = 150;

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

/** An access token another tab obtained, with its CSRF token. */
export interface SharedToken {
  token: string;
  csrfToken: string | null;
}

let lastSharedToken: (SharedToken & { receivedAt: number }) | null = null;
let foreignRefreshStartedAt = 0;

channel?.addEventListener("message", (event: MessageEvent<AuthMessage>) => {
  const message = event.data;
  if (message?.type === "token" || message?.type === "login") {
    // Only a well-formed, unexpired JWT is reused; anything else on the
    // channel is ignored (review C-L1).
    if (!isUsableToken(message.token)) return;
    lastSharedToken = {
      token: message.token,
      csrfToken: typeof message.csrfToken === "string" ? message.csrfToken : null,
      receivedAt: Date.now(),
    };
  } else if (message?.type === "refresh-start") {
    foreignRefreshStartedAt = Date.now();
  } else if (message?.type === "refresh-end") {
    foreignRefreshStartedAt = 0;
  }
});

// ─── Broadcast ────────────────────────────────────────────────────────────

export function broadcastToken(token: string, csrfToken: string | null = null): void {
  channel?.postMessage({ type: "token", token, csrfToken } satisfies AuthMessage);
}

export function broadcastLogin(token: string, csrfToken: string | null = null): void {
  channel?.postMessage({ type: "login", token, csrfToken } satisfies AuthMessage);
}

export function broadcastLogout(reason: SessionEndReason): void {
  channel?.postMessage({ type: "logout", reason } satisfies AuthMessage);
}

/** Subscribe to messages from other tabs. Returns an unsubscribe function. */
export function onAuthMessage(handler: (message: AuthMessage) => void): () => void {
  if (!channel) return () => {};
  const listener = (event: MessageEvent<AuthMessage>) => handler(event.data);
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}

/** A token another tab refreshed moments ago that differs from `staleToken`. */
export function takeRecentSharedToken(staleToken?: string | null): SharedToken | null {
  if (!lastSharedToken) return null;
  const fresh = Date.now() - lastSharedToken.receivedAt < SHARED_TOKEN_MAX_AGE_MS;
  if (!fresh || lastSharedToken.token === staleToken) return null;
  return { token: lastSharedToken.token, csrfToken: lastSharedToken.csrfToken };
}

// ─── Lock ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForForeignRefresh(): Promise<void> {
  const deadline = foreignRefreshStartedAt + FALLBACK_WAIT_MAX_MS;
  while (foreignRefreshStartedAt && Date.now() < deadline) {
    await sleep(FALLBACK_POLL_MS);
  }
}

/** Run `task` while no other tab refreshes. */
export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, task);
  }
  if (!channel) return task();

  await sleep(Math.random() * FALLBACK_JITTER_MS);
  await waitForForeignRefresh();
  channel.postMessage({ type: "refresh-start" } satisfies AuthMessage);
  try {
    return await task();
  } finally {
    channel.postMessage({ type: "refresh-end" } satisfies AuthMessage);
  }
}

// ─── Sign-in notice ───────────────────────────────────────────────────────
// Why the last session ended survives the redirect to /sign-in. A UX flag
// only, never a token.

const SESSION_END_KEY = "zcommerce-session-end";

export const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  EXPIRED: "Your session expired. Log in again.",
  REVOKED: "You were logged out because your session ended on another device.",
  SIGNED_OUT: "You've been logged out.",
};

export function rememberSessionEnd(reason: SessionEndReason): void {
  try {
    sessionStorage.setItem(SESSION_END_KEY, reason);
  } catch {
    // storage unavailable: the notice is optional
  }
}

export function consumeSessionEnd(): SessionEndReason | null {
  try {
    const reason = sessionStorage.getItem(SESSION_END_KEY) as SessionEndReason | null;
    sessionStorage.removeItem(SESSION_END_KEY);
    return reason && reason in SESSION_END_MESSAGES ? reason : null;
  } catch {
    return null;
  }
}
