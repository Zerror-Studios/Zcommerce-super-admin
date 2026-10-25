/**
 * Apollo Client (PRD-005 FR-11.1), the console's one API client
 *
 * The same shape as `zcom-frontend/src/lib/apollo-client.ts`, for the
 * platform principal (ADR-001):
 * - `authorization: Bearer <platform access token>` from the in-memory
 *   session store; the refresh token is an HttpOnly cookie
 *   (`credentials: "include"`);
 * - silent refresh on TOKEN_EXPIRED, and on an UNAUTHENTICATED reply for a
 *   locally unexpired token (server-side revoke, role change, clock skew;
 *   review C-M4), single-flight, serialised across tabs, with one retry of
 *   the failed operation;
 * - proactive refresh shortly before `exp`;
 * - structured handling of the gateway error codes, never message text.
 */

import {
  ApolloClient,
  InMemoryCache,
  Observable,
  createHttpLink,
  fromPromise,
  type FetchResult,
  type NextLink,
  type NormalizedCacheObject,
  type Operation,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { addToast } from "@heroui/react";
import { GATEWAY_URL } from "../config/data-source";
import { requestNavigation } from "./navigation-events";
import {
  broadcastLogout,
  broadcastToken,
  rememberSessionEnd,
  takeRecentSharedToken,
  withRefreshLock,
  type SessionEndReason,
} from "./auth-channel";
import {
  clearSession,
  getAccessToken,
  isTokenExpired,
  setAccessToken,
  tokenExpiresAt,
} from "./session-store";

// ─── Constants ────────────────────────────────────────────────────────────

const REFRESH_TIMEOUT_MS = Number(import.meta.env.VITE_REFRESH_TIMEOUT_MS) || 15000;

/** Operations that must never trigger a refresh or a sign-out loop. */
const AUTH_OPERATIONS = new Set([
  "PlatformLogin",
  "PlatformRefreshToken",
  "PlatformLogout",
  "PlatformSetPassword",
]);

/** Codes that end the session: the token itself is wrong. */
const FATAL_AUTH_CODES = new Set<string | undefined>(["INVALID_AUTH_TOKEN"]);

/** Backend `extensions.reason` values that mean the session was revoked. */
const REVOKED_REASONS = new Set(["REUSE_DETECTED", "LOGGED_OUT", "DEVICE_LIMIT"]);

const TOAST_DEDUPE_WINDOW_MS = 5000;
/**
 * `FORBIDDEN` reasons that are a business rule, not a missing permission
 * (PRD-014 SEC-04); the screen explains them, so no global toast.
 */
const BUSINESS_FORBIDDEN_REASONS = new Set(["PAYMENT_REQUIRED"]);

/** Refresh this long before the access token's `exp`. */
const PROACTIVE_REFRESH_LEAD_MS = 60_000;
const PROACTIVE_REFRESH_JITTER_MS = 10_000;
/** Retry delays after a transient proactive-refresh failure; then wait for focus (review C-L3). */
const PROACTIVE_RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

// ─── Session end ──────────────────────────────────────────────────────────

/** End the local session; other tabs follow via the auth channel. */
export function clearAuth(
  reason: SessionEndReason = "EXPIRED",
  { broadcast = true } = {},
): void {
  clearSession();
  rememberSessionEnd(reason);
  if (broadcast) broadcastLogout(reason);
  if (window.location.pathname !== "/sign-in") {
    window.location.assign("/sign-in");
  }
}

// ─── Silent refresh ───────────────────────────────────────────────────────

export type RefreshFailure =
  | "NO_SESSION"
  | "REVOKED"
  | "RATE_LIMITED"
  | "NETWORK"
  | "TIMEOUT"
  | "SERVER";

export type RefreshResult =
  | { ok: true; token: string }
  | { ok: false; reason: RefreshFailure; detail?: string };

export function isRefreshFailure(
  result: RefreshResult,
): result is Extract<RefreshResult, { ok: false }> {
  return result.ok === false;
}

function classifyRefreshError(
  error: { extensions?: Record<string, unknown> } | undefined,
): RefreshFailure {
  const code = error?.extensions?.code as string | undefined;
  if (FATAL_AUTH_CODES.has(code)) return "NO_SESSION";
  const reason = error?.extensions?.reason as string | undefined;
  if (reason) return REVOKED_REASONS.has(reason) ? "REVOKED" : "NO_SESSION";
  return code === "UNAUTHENTICATED" || code === "FORBIDDEN" ? "NO_SESSION" : "SERVER";
}

async function requestRefresh(): Promise<RefreshResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-version": "v1" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({
        operationName: "PlatformRefreshToken",
        query: `mutation PlatformRefreshToken { platformRefreshToken { accessToken } }`,
      }),
    });
    if (response.status >= 500) return { ok: false, reason: "SERVER" };
    const result = await response.json().catch(() => null);
    const accessToken = result?.data?.platformRefreshToken?.accessToken;
    if (accessToken) return { ok: true, token: accessToken };
    if (result?.errors?.length) {
      const error = result.errors[0];
      return {
        ok: false,
        reason: classifyRefreshError(error),
        detail: error?.extensions?.reason ?? error?.extensions?.code,
      };
    }
    if (response.status === 429) return { ok: false, reason: "RATE_LIMITED" };
    return { ok: false, reason: "SERVER" };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return { ok: false, reason: timedOut ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timeoutId);
  }
}

let activeRefreshPromise: Promise<RefreshResult> | null = null;

/**
 * Rotate the refresh cookie and get a new access token: single-flight in
 * the tab, serialised across tabs, reusing a token another tab just got.
 */
export async function refreshAccessToken(): Promise<RefreshResult> {
  if (activeRefreshPromise) return activeRefreshPromise;

  const staleToken = getAccessToken();
  activeRefreshPromise = withRefreshLock(async () => {
    const current = getAccessToken();
    const shared =
      takeRecentSharedToken(staleToken) ||
      (current && current !== staleToken && !isTokenExpired(current) ? current : null);
    const result: RefreshResult = shared ? { ok: true, token: shared } : await requestRefresh();
    if (result.ok) {
      setAccessToken(result.token);
      if (!shared) broadcastToken(result.token);
    }
    return result;
  }).finally(() => {
    activeRefreshPromise = null;
  });
  return activeRefreshPromise;
}

export function isSessionGone(failure: RefreshFailure): boolean {
  return failure === "NO_SESSION" || failure === "REVOKED";
}

// ─── User feedback ────────────────────────────────────────────────────────

const recentToasts = new Map<string, number>();

/** Show a toast unless the same one was shown moments ago. */
function toastOnce(key: string, toast: Parameters<typeof addToast>[0]): void {
  const now = Date.now();
  const shownAt = recentToasts.get(key);
  if (shownAt !== undefined && now - shownAt < TOAST_DEDUPE_WINDOW_MS) return;
  recentToasts.set(key, now);
  addToast(toast);
}

const reportedRefreshes = new WeakSet<Promise<RefreshResult>>();

function reportRefreshFailure(
  refresh: Promise<RefreshResult>,
  failure: RefreshFailure,
  { quiet = false } = {},
): void {
  if (reportedRefreshes.has(refresh)) return;
  reportedRefreshes.add(refresh);
  if (isSessionGone(failure)) {
    clearAuth(failure === "REVOKED" ? "REVOKED" : "EXPIRED");
  } else if (failure === "RATE_LIMITED") {
    toastOnce("rate-limit", {
      title: "Too many requests. Wait a moment and try again.",
      color: "warning",
    });
  } else if (!quiet) {
    toastOnce("unreachable", {
      title: "Can't reach the server",
      description: "Your session is still active. Please retry in a moment.",
      color: "warning",
    });
  }
}

function refreshAndRetry(
  operation: Operation,
  forward: NextLink,
  fallback: () => Observable<FetchResult>,
): Observable<FetchResult> {
  const refresh = refreshAccessToken();
  return fromPromise(refresh).flatMap((result) => {
    if (isRefreshFailure(result)) {
      reportRefreshFailure(refresh, result.reason);
      return fallback();
    }
    const oldHeaders = operation.getContext().headers;
    operation.setContext({
      retriedAfterRefresh: true,
      headers: { ...oldHeaders, authorization: `Bearer ${result.token}` },
    });
    return forward(operation);
  });
}

// ─── Proactive refresh ────────────────────────────────────────────────────

let proactiveTimer: ReturnType<typeof setTimeout> | null = null;
let proactiveRetryCount = 0;

function scheduleProactiveRefresh(token: string | null, minDelayMs = 0): void {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  proactiveTimer = null;
  const expiresAt = token ? tokenExpiresAt(token) : null;
  if (expiresAt === null) return;
  const lead = PROACTIVE_REFRESH_LEAD_MS + Math.random() * PROACTIVE_REFRESH_JITTER_MS;
  const delay = Math.max(expiresAt - lead - Date.now(), minDelayMs);
  proactiveTimer = setTimeout(() => void runProactiveRefresh(), delay);
}

async function runProactiveRefresh(): Promise<void> {
  if (!getAccessToken()) return;
  const refresh = refreshAccessToken();
  const result = await refresh;
  if (!isRefreshFailure(result)) {
    proactiveRetryCount = 0;
    return;
  }
  reportRefreshFailure(refresh, result.reason, { quiet: true });
  if (isSessionGone(result.reason)) return;
  // Transient failure: 30 s, 60 s, 120 s, then stop until the tab is next
  // focused, so a dead network never turns into a request loop.
  const delay = PROACTIVE_RETRY_DELAYS_MS[proactiveRetryCount];
  if (delay === undefined) return;
  proactiveRetryCount += 1;
  scheduleProactiveRefresh(getAccessToken(), delay);
}

/**
 * Keep the session fresh while the console is open: refresh about a minute
 * before `exp`, and when the tab becomes visible near or past it. Returns
 * a cleanup function.
 */
export function startSessionKeepAlive(): () => void {
  scheduleProactiveRefresh(getAccessToken());
  const handleVisibility = () => {
    if (document.visibilityState !== "visible") return;
    const token = getAccessToken();
    const expiresAt = token ? tokenExpiresAt(token) : null;
    // A fresh look at the tab resets the retry budget.
    proactiveRetryCount = 0;
    if (expiresAt !== null && expiresAt - Date.now() <= PROACTIVE_REFRESH_LEAD_MS) {
      void runProactiveRefresh();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);
  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    if (proactiveTimer) clearTimeout(proactiveTimer);
    proactiveTimer = null;
  };
}

/** Re-arm the proactive timer when the token changes (called by AuthProvider). */
export function rescheduleKeepAlive(): void {
  scheduleProactiveRefresh(getAccessToken());
}

// ─── Links ────────────────────────────────────────────────────────────────

const httpLink = createHttpLink({ uri: GATEWAY_URL, credentials: "include" });

const authLink = setContext((_, { headers, skipAuth }) => {
  const token = skipAuth ? null : getAccessToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-api-version": "v1",
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward, response }) => {
  const isAuthOperation = AUTH_OPERATIONS.has(operation.operationName);

  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code as string | undefined;
      const currentToken = getAccessToken();
      // TOKEN_EXPIRED, or UNAUTHENTICATED while we hold a token: the token
      // may be locally unexpired yet revoked or stale on the server, so try
      // one refresh (review C-M4). `reportRefreshFailure` ends the session
      // when the refresh itself says NO_SESSION or REVOKED.
      const shouldRefresh =
        code === "TOKEN_EXPIRED" || (code === "UNAUTHENTICATED" && !!currentToken);
      const alreadyRetried = operation.getContext().retriedAfterRefresh === true;

      if (!isAuthOperation && shouldRefresh && !alreadyRetried) {
        return refreshAndRetry(operation, forward, () =>
          Observable.of(response as FetchResult),
        );
      }
      if (!isAuthOperation && FATAL_AUTH_CODES.has(code)) {
        clearAuth("EXPIRED");
        return;
      }
      if (!isAuthOperation && code === "MFA_REQUIRED") {
        // Manage roles must enrol before any manage mutation (PRD-005 FR-1.4).
        toastOnce("mfa-required", {
          title: "Turn on two-step verification before changing platform data.",
          color: "warning",
        });
        requestNavigation("/mfa");
      }
      const reason = err.extensions?.reason as string | undefined;
      if (code === "FORBIDDEN" && !BUSINESS_FORBIDDEN_REASONS.has(reason ?? "")) {
        toastOnce(`forbidden:${err.message}`, {
          title: "You don't have permission to do that.",
          color: "danger",
        });
      }
    }
  }

  if (!isAuthOperation && networkError && "statusCode" in networkError) {
    const status = (networkError as { statusCode?: number }).statusCode;
    if (status === 429) {
      toastOnce("rate-limit", {
        title: "Too many requests. Wait a moment and try again.",
        color: "warning",
      });
    } else if (status === 401 || status === 403) {
      toastOnce(`http:${status}`, {
        title: "Request blocked",
        description: `The server refused this request (HTTP ${status}). You're still signed in; please try again.`,
        color: "warning",
      });
    }
  }
});

// ─── Client ───────────────────────────────────────────────────────────────

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        platformTenants: { keyArgs: ["filter", "sort"] },
        platformSubscriptions: { keyArgs: ["filter", "sort"] },
      },
    },
  },
});

export const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache,
  connectToDevTools: import.meta.env.DEV,
});

/** `extensions.code` of the first GraphQL error on an Apollo failure. */
export function errorCodeOf(error: unknown): string | undefined {
  const graphQLErrors = (error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> })
    ?.graphQLErrors;
  return graphQLErrors?.[0]?.extensions?.code as string | undefined;
}

/** `extensions.reason` of the first GraphQL error on an Apollo failure. */
export function errorReasonOf(error: unknown): string | undefined {
  const graphQLErrors = (error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> })
    ?.graphQLErrors;
  return graphQLErrors?.[0]?.extensions?.reason as string | undefined;
}
