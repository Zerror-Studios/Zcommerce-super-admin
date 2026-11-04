import { GraphQLError } from "graphql";
import { ApolloError } from "@apollo/client";
import { describe, expect, it } from "vitest";

import {
  PUSH_BLOCKED_COPY,
  PUSH_PREFERENCE_OPTIONS,
  PUSH_REASON_COPY,
  deviceCountCopy,
  isIosDevice,
  isSameKey,
  pushDeviceState,
  pushDeviceStateEnum,
  pushFailureCopy,
  pushSubscriptionInput,
  testPushResultCopy,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from "./web-push.util";

// ─── Helpers ──────────────────────────────────────────────────────────────

const desktop = (overrides: Partial<PushEnvironment> = {}): PushEnvironment => ({
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default",
  isIos: false,
  isStandalone: false,
  subscribed: false,
  ...overrides,
});

function apolloError(extensions: Record<string, unknown>, message = "Server said no") {
  return new ApolloError({ graphQLErrors: [new GraphQLError(message, { extensions })] });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("urlBase64ToUint8Array (PRD-033 FR-2.8)", () => {
  it("decodes base64url without padding", () => {
    // "+/8" in base64 is "-_8" in base64url: bytes 0xfb 0xff
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([0xfb, 0xff]);
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
  });

  it("decodes a 65-byte uncompressed P-256 public key", () => {
    const raw = new Uint8Array(65).map((_, index) => (index === 0 ? 4 : index));
    const base64url = btoa(String.fromCharCode(...raw))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const bytes = urlBase64ToUint8Array(base64url);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
    expect(Array.from(bytes)).toEqual(Array.from(raw));
  });

  it("compares an existing subscription's key", () => {
    const key = urlBase64ToUint8Array("AQID");
    expect(isSameKey(new Uint8Array([1, 2, 3]).buffer, key)).toBe(true);
    expect(isSameKey(new Uint8Array([1, 2, 4]).buffer, key)).toBe(false);
    expect(isSameKey(new Uint8Array([1, 2]).buffer, key)).toBe(false);
    expect(isSameKey(null, key)).toBe(false);
  });
});

describe("pushDeviceState (FR-2.8)", () => {
  it("is Not supported without the push APIs", () => {
    expect(pushDeviceState(desktop({ hasPushManager: false }))).toBe(pushDeviceStateEnum.UNSUPPORTED);
    expect(pushDeviceState(desktop({ hasServiceWorker: false }))).toBe(pushDeviceStateEnum.UNSUPPORTED);
    expect(pushDeviceState(desktop({ hasNotification: false }))).toBe(pushDeviceStateEnum.UNSUPPORTED);
  });

  it("asks iPhone and iPad users to add it to the Home Screen first", () => {
    expect(pushDeviceState(desktop({ isIos: true, hasPushManager: false }))).toBe(pushDeviceStateEnum.NEEDS_INSTALL);
    expect(pushDeviceState(desktop({ isIos: true }))).toBe(pushDeviceStateEnum.NEEDS_INSTALL);
    expect(pushDeviceState(desktop({ isIos: true, isStandalone: true }))).toBe(pushDeviceStateEnum.AVAILABLE);
  });

  it("is Blocked when permission was denied, even with a subscription", () => {
    expect(pushDeviceState(desktop({ permission: "denied", subscribed: true }))).toBe(pushDeviceStateEnum.BLOCKED);
  });

  it("waits while the subscription is read, then shows On or Enable", () => {
    expect(pushDeviceState(desktop({ subscribed: null }))).toBe(pushDeviceStateEnum.CHECKING);
    expect(pushDeviceState(desktop({ permission: "granted", subscribed: true }))).toBe(pushDeviceStateEnum.ON);
    expect(pushDeviceState(desktop({ permission: "granted", subscribed: false }))).toBe(pushDeviceStateEnum.AVAILABLE);
    // A leftover subscription without permission isn't "on".
    expect(pushDeviceState(desktop({ permission: "default", subscribed: true }))).toBe(pushDeviceStateEnum.AVAILABLE);
  });

  it("recognises iPhone, and iPadOS that reports a Mac with touch", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0)).toBe(false);
  });
});

describe("pushSubscriptionInput (FR-2.2)", () => {
  it("sends the endpoint, both keys and the user agent", () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      toJSON: () => ({ keys: { p256dh: "BPkey", auth: "authkey" } }),
    };
    expect(pushSubscriptionInput(subscription, "Chrome")).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      p256dh: "BPkey",
      auth: "authkey",
      userAgent: "Chrome",
    });
    expect(pushSubscriptionInput(subscription, "")?.userAgent).toBeNull();
  });

  it("returns null when the browser gave no keys", () => {
    expect(pushSubscriptionInput({ endpoint: "https://x", toJSON: () => ({}) }, null)).toBeNull();
    expect(pushSubscriptionInput({ endpoint: "https://x", toJSON: () => ({ keys: { p256dh: "a" } }) }, null)).toBeNull();
  });
});

describe("push copy (FR-2.8, FR-2.9)", () => {
  it("maps the server reasons", () => {
    expect(pushFailureCopy(apolloError({ code: "CONFLICT", reason: "PUSH_NOT_CONFIGURED" }))).toBe(
      PUSH_REASON_COPY.PUSH_NOT_CONFIGURED,
    );
    expect(pushFailureCopy(apolloError({ code: "BAD_USER_INPUT", reason: "INVALID_PUSH_SUBSCRIPTION" }))).toBe(
      PUSH_REASON_COPY.INVALID_PUSH_SUBSCRIPTION,
    );
  });

  it("says when the next test can be sent", () => {
    const limited = apolloError({ code: "BAD_USER_INPUT", reason: "RATE_LIMITED", retryAfterMs: 41 * 60 * 1000 + 5 });
    expect(pushFailureCopy(limited)).toBe("You can send 5 test notifications an hour. Try again in 42 minutes.");
    const soon = apolloError({ code: "BAD_USER_INPUT", reason: "RATE_LIMITED", retryAfterMs: 10 });
    expect(pushFailureCopy(soon)).toBe("You can send 5 test notifications an hour. Try again in 1 minute.");
    const noTime = apolloError({ code: "BAD_USER_INPUT", reason: "RATE_LIMITED" });
    expect(pushFailureCopy(noTime)).toBe("You can send 5 test notifications an hour.");
  });

  it("explains a denied prompt and other browser failures", () => {
    expect(pushFailureCopy(new DOMException("denied", "NotAllowedError"))).toBe(PUSH_BLOCKED_COPY);
    expect(pushFailureCopy(new DOMException("aborted", "AbortError"))).toMatch(/couldn't turn on notifications/);
  });

  it("leaves FORBIDDEN to the Apollo link", () => {
    expect(pushFailureCopy(apolloError({ code: "FORBIDDEN" }))).toBeNull();
  });

  it("describes test results and device counts", () => {
    expect(testPushResultCopy(0)).toMatch(/No browser received it/);
    expect(testPushResultCopy(1)).toBe("Test notification sent to 1 browser.");
    expect(testPushResultCopy(3)).toBe("Test notification sent to 3 browsers.");
    expect(deviceCountCopy(0)).toBe("No browsers registered");
    expect(deviceCountCopy(2)).toBe("2 browsers registered");
  });

  it("offers the three preferences, urgent first (D3)", () => {
    expect(PUSH_PREFERENCE_OPTIONS.map((option) => option.key)).toEqual(["CRITICAL", "WARNING", "OFF"]);
    expect(PUSH_PREFERENCE_OPTIONS.map((option) => option.label)).toEqual([
      "Only urgent",
      "Urgent and warnings",
      "Off",
    ]);
  });
});
