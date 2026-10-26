/**
 * In-memory platform session (PRD-005 FR-11.2)
 *
 * The access token lives here and nowhere else: never in localStorage or
 * sessionStorage. The refresh token is an HttpOnly cookie the browser
 * sends on its own. A page reload therefore starts with no token and
 * restores the session through `platformRefreshToken`.
 *
 * The CSRF token (PRD-014 FR-1.11, D8) sits beside the access token, in
 * memory only: `platformLogin` and `platformRefreshToken` return it, and
 * the Apollo client sends it as `x-zcom-csrf` on every mutation.
 */

import type { PlatformUser } from "../types/platform-api";

// ─── State ────────────────────────────────────────────────────────────────

interface SessionState {
  accessToken: string | null;
  csrfToken: string | null;
  user: PlatformUser | null;
}

let state: SessionState = { accessToken: null, csrfToken: null, user: null };

const listeners = new Set<(state: SessionState) => void>();

function emit(): void {
  for (const listener of listeners) listener(state);
}

// ─── Accessors ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return state.accessToken;
}

export function getCsrfToken(): string | null {
  return state.csrfToken;
}

export function getSessionUser(): PlatformUser | null {
  return state.user;
}

export function setAccessToken(accessToken: string | null): void {
  if (state.accessToken === accessToken) return;
  state = { ...state, accessToken };
  emit();
}

/**
 * Store the session's CSRF token. `undefined` keeps the current one (a
 * token adopted from another tab may arrive without it).
 */
export function setCsrfToken(csrfToken: string | null | undefined): void {
  if (csrfToken === undefined || state.csrfToken === csrfToken) return;
  state = { ...state, csrfToken };
}

export function setSessionUser(user: PlatformUser | null): void {
  state = { ...state, user };
  emit();
}

export function clearSession(): void {
  if (!state.accessToken && !state.csrfToken && !state.user) return;
  state = { accessToken: null, csrfToken: null, user: null };
  emit();
}

export function subscribeSession(
  listener: (state: SessionState) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Token inspection (no verification; classification only) ──────────────

/** `exp` of the access token in ms, or null when unreadable. */
export function tokenExpiresAt(token: string): number | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= Date.now();
}

/**
 * A JWT-shaped token with a readable, future `exp`. Tokens that arrive over
 * the cross-tab channel are only adopted when this holds (review C-L1).
 */
export function isUsableToken(token: unknown): token is string {
  if (typeof token !== "string" || token.split(".").length !== 3) return false;
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt > Date.now();
}
