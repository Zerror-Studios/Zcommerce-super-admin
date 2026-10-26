/**
 * Platform session (PRD-005 FR-11.2)
 *
 * The access token lives in memory (`lib/session-store`), the refresh token
 * in an HttpOnly cookie. On load the provider restores the session through
 * `platformRefreshToken`, then reads `platformMe`. Sign-in handles the TOTP
 * step through typed results, never message text.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PLATFORM_LOGIN,
  PLATFORM_LOGOUT,
  PLATFORM_LOGOUT_ALL,
  PLATFORM_ME,
} from "../graphql/auth";
import {
  client,
  clearAuth,
  errorCodeOf,
  errorReasonOf,
  isRefreshFailure,
  isSessionGone,
  refreshAccessToken,
  rescheduleKeepAlive,
  startSessionKeepAlive,
  type RefreshFailure,
} from "../lib/apollo-client";
import { broadcastLogin, onAuthMessage, rememberSessionEnd } from "../lib/auth-channel";
import { can as roleCan, type PlatformPermission } from "../lib/permissions";
import {
  clearSession,
  getAccessToken,
  getSessionUser,
  isUsableToken,
  setAccessToken,
  setCsrfToken,
  setSessionUser,
  subscribeSession,
} from "../lib/session-store";
import { isSessionRejection } from "../lib/session-failure.util";
import type { PlatformAuthPayload, PlatformUser } from "../types/platform-api";

// ─── Types ────────────────────────────────────────────────────────────────

/** `unreachable`: the refresh cookie may be fine but the server didn't answer (review C-L2). */
export type AuthStatus = "loading" | "guest" | "authenticated" | "unreachable";

export type SignInFailure =
  | "INVALID"
  | "MFA_REQUIRED"
  | "INVALID_TOTP"
  | "ACCOUNT_DISABLED"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export type SignInResult =
  | { ok: true; mfaRequired: boolean }
  | { ok: false; code: SignInFailure };

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: PlatformUser | null;
  signIn: (email: string, password: string, totp?: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** Ends every session of this user on every device (PRD-014 PLT-13); throws if the server refused. */
  signOutEverywhere: () => Promise<void>;
  /** Re-read `platformMe` (after MFA enrolment, role changes). */
  refreshUser: () => Promise<void>;
  /** Try the session restore again after an `unreachable` load. */
  retryRestore: () => Promise<void>;
  /** Client-side mirror of the backend role matrix; the server still decides. */
  can: (permission: PlatformPermission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────

function signInFailureOf(error: unknown): SignInFailure {
  const code = errorCodeOf(error);
  const reason = errorReasonOf(error);
  if (code === "MFA_REQUIRED") return "MFA_REQUIRED";
  if (code === "ACCOUNT_DISABLED") return "ACCOUNT_DISABLED";
  if (code === "UNAUTHENTICATED" && reason === "INVALID_TOTP") return "INVALID_TOTP";
  if (code === "UNAUTHENTICATED") return "INVALID";
  const status = (error as { networkError?: { statusCode?: number } })?.networkError
    ?.statusCode;
  if (status === 429) return "RATE_LIMITED";
  return "UNAVAILABLE";
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PlatformUser | null>(null);

  const loadMe = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await client.query<{ platformMe: PlatformUser }>({
        query: PLATFORM_ME,
        fetchPolicy: "network-only",
      });
      setSessionUser(data.platformMe);
      setUser(data.platformMe);
      setStatus("authenticated");
      return true;
    } catch (error) {
      // PRD-014 FE-23: only a server verdict on the session signs out. A
      // network failure, timeout or 5xx keeps the session: a signed-in
      // operator stays where they are, a restore offers Retry.
      if (isSessionRejection(error)) {
        clearSession();
        setUser(null);
        setStatus("guest");
      } else if (!getSessionUser()) {
        setStatus("unreachable");
      }
      return false;
    }
  }, []);

  // Restore the session from the refresh cookie. A missing or revoked
  // session means guest; a network, timeout or server failure means we
  // don't know yet, so the shell offers Retry instead of the sign-in form.
  const settleRefreshFailure = useCallback((reason: RefreshFailure) => {
    if (isSessionGone(reason)) {
      clearSession();
      setStatus("guest");
    } else {
      setStatus("unreachable");
    }
  }, []);

  const restoreSession = useCallback(async (): Promise<void> => {
    setStatus("loading");
    const result = await refreshAccessToken();
    if (isRefreshFailure(result)) {
      settleRefreshFailure(result.reason);
      return;
    }
    await loadMe();
  }, [loadMe, settleRefreshFailure]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await refreshAccessToken();
      if (cancelled) return;
      if (isRefreshFailure(result)) {
        settleRefreshFailure(result.reason);
        return;
      }
      await loadMe();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe, settleRefreshFailure]);

  // Keep the token fresh and follow sign-ins and sign-outs from other tabs.
  useEffect(() => {
    const stopKeepAlive = startSessionKeepAlive();
    const unsubscribeSession = subscribeSession(() => rescheduleKeepAlive());
    const unsubscribeChannel = onAuthMessage((message) => {
      if (message.type === "login") {
        // Only a well-formed, unexpired token is adopted (review C-L1).
        if (!isUsableToken(message.token)) return;
        setCsrfToken(typeof message.csrfToken === "string" ? message.csrfToken : null);
        setAccessToken(message.token);
        void loadMe();
      } else if (message.type === "logout") {
        clearAuth(message.reason, { broadcast: false });
      }
    });
    return () => {
      stopKeepAlive();
      unsubscribeSession();
      unsubscribeChannel();
    };
  }, [loadMe]);

  const signIn = useCallback(
    async (email: string, password: string, totp?: string): Promise<SignInResult> => {
      try {
        const { data } = await client.mutate<{ platformLogin: PlatformAuthPayload }>({
          mutation: PLATFORM_LOGIN,
          variables: { email: email.trim(), password, totp: totp?.trim() || null },
          context: { skipAuth: true },
        });
        const payload = data?.platformLogin;
        if (!payload) return { ok: false, code: "UNAVAILABLE" };
        setCsrfToken(payload.csrfToken ?? null);
        setAccessToken(payload.accessToken);
        setSessionUser(payload.user);
        setUser(payload.user);
        setStatus("authenticated");
        broadcastLogin(payload.accessToken, payload.csrfToken ?? null);
        return { ok: true, mfaRequired: payload.mfaRequired };
      } catch (error) {
        return { ok: false, code: signInFailureOf(error) };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      if (getAccessToken()) {
        await client.mutate({ mutation: PLATFORM_LOGOUT });
      }
    } catch {
      // The cookie may already be gone; the local session ends regardless.
    }
    rememberSessionEnd("SIGNED_OUT");
    clearSession();
    await client.clearStore();
    setUser(null);
    setStatus("guest");
    clearAuth("SIGNED_OUT");
  }, []);

  const signOutEverywhere = useCallback(async () => {
    // Unlike signOut, a failure is reported: the other devices would stay signed in.
    await client.mutate({ mutation: PLATFORM_LOGOUT_ALL });
    rememberSessionEnd("SIGNED_OUT");
    clearSession();
    await client.clearStore();
    setUser(null);
    setStatus("guest");
    clearAuth("SIGNED_OUT");
  }, []);

  const refreshUser = useCallback(async () => {
    await loadMe();
  }, [loadMe]);

  const value = useMemo<AuthContextValue>(() => {
    const currentUser = user ?? getSessionUser();
    return {
      status,
      isAuthenticated: status === "authenticated",
      user: currentUser,
      signIn,
      signOut,
      signOutEverywhere,
      refreshUser,
      retryRestore: restoreSession,
      can: (permission) => roleCan(currentUser?.role, permission),
    };
  }, [refreshUser, restoreSession, signIn, signOut, signOutEverywhere, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
