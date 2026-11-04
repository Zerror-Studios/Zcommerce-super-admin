/**
 * Browser push for console staff (PRD-033 FR-2.6–FR-2.9)
 *
 * The pure half of the "Enable notifications" control: the VAPID key
 * conversion, which state this browser is in, the subscription input the
 * API takes, the preference options and the copy for a failure. The
 * browser calls (service worker, permission, subscribe) live in
 * `hooks/use-web-push.ts`.
 */

import { errorCodeOf, errorReasonOf } from "./apollo-client";
import { mutationFailureCopy } from "./mutation-errors";
import type {
  PlatformPushMinSeverity,
  PlatformPushSubscriptionInput,
} from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

/** Served from `public/`, so its scope is the whole console. */
export const PUSH_SERVICE_WORKER_URL = "/push-sw.js";

const MINUTE_MS = 60 * 1000;

export const pushMinSeverityEnum = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  OFF: "OFF",
} as const satisfies Record<PlatformPushMinSeverity, PlatformPushMinSeverity>;

/** The preference select, most selective first (D3: CRITICAL by default). */
export const PUSH_PREFERENCE_OPTIONS: ReadonlyArray<{
  key: PlatformPushMinSeverity;
  label: string;
}> = [
  { key: pushMinSeverityEnum.CRITICAL, label: "Only urgent" },
  { key: pushMinSeverityEnum.WARNING, label: "Urgent and warnings" },
  { key: pushMinSeverityEnum.OFF, label: "Off" },
];

/** What the control shows for this browser (FR-2.8). */
export const pushDeviceStateEnum = {
  /** Still reading the browser's subscription. */
  CHECKING: "CHECKING",
  /** No service worker, Push API or Notification API. */
  UNSUPPORTED: "UNSUPPORTED",
  /** iPhone or iPad in Safari: push needs the home-screen app (16.4+). */
  NEEDS_INSTALL: "NEEDS_INSTALL",
  /** The user (or a policy) denied notifications for this site. */
  BLOCKED: "BLOCKED",
  /** Supported, not subscribed yet. */
  AVAILABLE: "AVAILABLE",
  /** This browser has a subscription and permission. */
  ON: "ON",
} as const;

export type PushDeviceState =
  (typeof pushDeviceStateEnum)[keyof typeof pushDeviceStateEnum];

export const PUSH_REASON_COPY: Readonly<Record<string, string>> = {
  PUSH_NOT_CONFIGURED:
    "Browser notifications aren't set up on the platform yet.",
  INVALID_PUSH_SUBSCRIPTION:
    "The platform didn't accept this browser's subscription. Turn " +
    "notifications off and on again, or try another browser.",
  INVALID_PUSH_PREFERENCE: "Choose when to get notifications.",
};

export const PUSH_BLOCKED_COPY =
  "Notifications are blocked for this site. Allow them in the browser's " +
  "site settings (the icon next to the address), then reload the page.";

const PUSH_BROWSER_FAILURE_COPY =
  "This browser couldn't turn on notifications. Try again, or try another " +
  "browser.";

// ─── Types ────────────────────────────────────────────────────────────────

/** What the hook reads from the browser before deciding the state. */
export interface PushEnvironment {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
  isIos: boolean;
  isStandalone: boolean;
  /** `null` while the existing subscription is still being read. */
  subscribed: boolean | null;
}

/** The parts of a `PushSubscription` the API needs. */
export interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): { keys?: Record<string, string | undefined> };
}

// ─── Key conversion ───────────────────────────────────────────────────────

/** A base64url VAPID public key → the bytes `pushManager.subscribe` takes. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const trimmed = value.trim();
  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

/** Whether an existing subscription was made with this public key. */
export function isSameKey(
  existing: ArrayBuffer | null | undefined,
  key: Uint8Array,
): boolean {
  if (!existing) return false;
  const bytes = new Uint8Array(existing);
  if (bytes.length !== key.length) return false;
  return bytes.every((byte, index) => byte === key[index]);
}

// ─── Device state ─────────────────────────────────────────────────────────

/** iPhone, iPod or iPad (iPadOS reports a Mac with a touch screen). */
export function isIosDevice(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

/** Which state the control shows (FR-2.8). */
export function pushDeviceState(env: PushEnvironment): PushDeviceState {
  // iOS exposes the Push API only to the home-screen app (16.4+).
  if (env.isIos && !env.isStandalone) return pushDeviceStateEnum.NEEDS_INSTALL;
  const hasApis =
    env.hasServiceWorker && env.hasPushManager && env.hasNotification;
  if (!hasApis) return pushDeviceStateEnum.UNSUPPORTED;
  if (env.permission === "denied") return pushDeviceStateEnum.BLOCKED;
  if (env.subscribed == null) return pushDeviceStateEnum.CHECKING;
  if (env.subscribed && env.permission === "granted") {
    return pushDeviceStateEnum.ON;
  }
  return pushDeviceStateEnum.AVAILABLE;
}

// ─── API input ────────────────────────────────────────────────────────────

/** The register input, or `null` when the browser gave no keys. */
export function pushSubscriptionInput(
  subscription: PushSubscriptionLike,
  userAgent: string | null,
): PlatformPushSubscriptionInput | null {
  const keys = subscription.toJSON().keys ?? {};
  const { p256dh, auth } = keys;
  if (!subscription.endpoint || !p256dh || !auth) return null;
  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    userAgent: userAgent || null,
  };
}

// ─── Copy ─────────────────────────────────────────────────────────────────

/** "in 1 minute", "in 42 minutes"; at least one minute. */
function minutesFromNow(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE_MS));
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** `extensions.retryAfterMs` of the first GraphQL error, when present. */
function retryAfterMsOf(error: unknown): number | null {
  const graphQLErrors = (
    error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> }
  )?.graphQLErrors;
  const value = graphQLErrors?.[0]?.extensions?.retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The toast for a failed push action, or `null` when the Apollo link
 * already reported it. Browser errors (a `DOMException` from the permission
 * prompt or `subscribe`) get their own copy.
 */
export function pushFailureCopy(error: unknown): string | null {
  if (error instanceof DOMException || isDomLikeError(error)) {
    const name = (error as { name: string }).name;
    if (name === "NotAllowedError") return PUSH_BLOCKED_COPY;
    return PUSH_BROWSER_FAILURE_COPY;
  }
  const reason = errorReasonOf(error);
  if (reason === "RATE_LIMITED" && errorCodeOf(error) === "BAD_USER_INPUT") {
    const retryAfterMs = retryAfterMsOf(error);
    return (
      "You can send 5 test notifications an hour." +
      (retryAfterMs != null ? ` Try again ${minutesFromNow(retryAfterMs)}.` : "")
    );
  }
  if (reason && PUSH_REASON_COPY[reason]) return PUSH_REASON_COPY[reason];
  return mutationFailureCopy(error);
}

/** Errors thrown by the browser APIs that aren't a `DOMException` here. */
function isDomLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { graphQLErrors?: unknown }).graphQLErrors) return false;
  return [
    "NotAllowedError",
    "AbortError",
    "InvalidStateError",
    "NotSupportedError",
    "SecurityError",
  ].includes(error.name);
}

/** The line under the control after a test send. */
export function testPushResultCopy(sent: number): string {
  if (sent === 0) {
    return "No browser received it. Turn notifications on here first.";
  }
  return `Test notification sent to ${sent} browser${sent === 1 ? "" : "s"}.`;
}

/** "On this device · 2 browsers" style count. */
export function deviceCountCopy(count: number): string {
  if (count <= 0) return "No browsers registered";
  return `${count} browser${count === 1 ? "" : "s"} registered`;
}
