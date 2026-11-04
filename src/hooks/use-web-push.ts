/**
 * Browser push hooks (PRD-033 FR-2.6–FR-2.9)
 *
 * `useWebPush` drives the Settings › Profile & security control: it reads
 * whether the platform offers push, the caller's preference, and this
 * browser's own subscription, and enables, disables, changes the
 * preference and sends a test. `useWebPushRefresh` re-registers an
 * existing subscription once per app load so the server's row stays fresh
 * (silent; errors are ignored). The decisions are in `lib/web-push.util.ts`.
 */

import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PLATFORM_MY_PUSH_SETTINGS,
  PLATFORM_REGISTER_PUSH_SUBSCRIPTION,
  PLATFORM_REMOVE_PUSH_SUBSCRIPTION,
  PLATFORM_SEND_TEST_PUSH,
  PLATFORM_SET_PUSH_PREFERENCE,
  PLATFORM_WEB_PUSH_CONFIG,
} from "../graphql/notifications";
import {
  PUSH_SERVICE_WORKER_URL,
  isIosDevice,
  isSameKey,
  pushDeviceState,
  pushSubscriptionInput,
  urlBase64ToUint8Array,
  type PushDeviceState,
} from "../lib/web-push.util";
import { useAuth } from "../providers/AuthProvider";
import type {
  PlatformPushMinSeverity,
  PlatformPushSettings,
  PlatformWebPushConfig,
} from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

const SERVICE_WORKER_SCOPE = "/";

// ─── Browser helpers ──────────────────────────────────────────────────────

function hasPushApis(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandaloneApp(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  return (
    standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

function currentPermission(): NotificationPermission | null {
  return "Notification" in window ? Notification.permission : null;
}

/** This browser's existing subscription, without registering anything. */
async function existingSubscription(): Promise<PushSubscription | null> {
  if (!hasPushApis()) return null;
  const registration =
    await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
  return registration ? await registration.pushManager.getSubscription() : null;
}

/** Registers the worker and returns a subscription made with `publicKey`. */
async function subscribeBrowser(publicKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.register(
    PUSH_SERVICE_WORKER_URL,
    { scope: SERVICE_WORKER_SCOPE },
  );
  await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(publicKey);
  const current = await registration.pushManager.getSubscription();
  if (current && isSameKey(current.options.applicationServerKey, key)) {
    return current;
  }
  // A subscription made with an older key can't be reused (the keys rotated).
  if (current) await current.unsubscribe();
  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface WebPushControl {
  /** The platform offers push (VAPID keys set on the backend). */
  enabled: boolean;
  configLoading: boolean;
  configError: boolean;
  retryConfig: () => void;
  state: PushDeviceState;
  settings: PlatformPushSettings | null;
  settingsLoading: boolean;
  isEnabling: boolean;
  isDisabling: boolean;
  isSavingPreference: boolean;
  isTesting: boolean;
  /** Each action throws on failure; the screen turns it into copy. */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  setPreference: (minSeverity: PlatformPushMinSeverity) => Promise<void>;
  sendTest: () => Promise<number>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────

export function useWebPush(): WebPushControl {
  const { isAuthenticated } = useAuth();
  const config = useQuery<{ platformWebPushConfig: PlatformWebPushConfig }>(
    PLATFORM_WEB_PUSH_CONFIG,
    { skip: !isAuthenticated, fetchPolicy: "cache-first" },
  );
  const enabled = config.data?.platformWebPushConfig.enabled === true;
  const publicKey = config.data?.platformWebPushConfig.publicKey ?? null;

  const settingsQuery = useQuery<{
    platformMyPushSettings: PlatformPushSettings;
  }>(PLATFORM_MY_PUSH_SETTINGS, {
    skip: !isAuthenticated || !enabled,
    fetchPolicy: "cache-and-network",
  });

  const [registerSubscription] = useMutation(
    PLATFORM_REGISTER_PUSH_SUBSCRIPTION,
  );
  const [removeSubscription] = useMutation(PLATFORM_REMOVE_PUSH_SUBSCRIPTION);
  const [savePreference, { loading: isSavingPreference }] = useMutation<{
    platformSetPushPreference: PlatformPushMinSeverity;
  }>(PLATFORM_SET_PUSH_PREFERENCE);
  const [sendTestPush, { loading: isTesting }] = useMutation<{
    platformSendTestPush: number;
  }>(PLATFORM_SEND_TEST_PUSH);

  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => (typeof window !== "undefined" ? currentPermission() : null),
  );
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    existingSubscription()
      .then((subscription) => {
        if (!cancelled) setSubscribed(subscription != null);
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchSettings = useCallback(async () => {
    await settingsQuery.refetch().catch(() => undefined);
  }, [settingsQuery]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setIsEnabling(true);
    try {
      // Asked first, while the click still counts as a user gesture.
      const answer = await Notification.requestPermission();
      setPermission(answer);
      if (answer !== "granted") return;
      const subscription = await subscribeBrowser(publicKey);
      const input = pushSubscriptionInput(subscription, navigator.userAgent);
      if (!input) {
        await subscription.unsubscribe().catch(() => undefined);
        throw new DOMException("No subscription keys", "InvalidStateError");
      }
      try {
        await registerSubscription({ variables: { input } });
      } catch (error) {
        // Keep the browser and the server in step: no row, no subscription.
        await subscription.unsubscribe().catch(() => undefined);
        throw error;
      }
      setSubscribed(true);
      await refetchSettings();
    } finally {
      setIsEnabling(false);
    }
  }, [publicKey, refetchSettings, registerSubscription]);

  const disable = useCallback(async () => {
    setIsDisabling(true);
    try {
      const subscription = await existingSubscription();
      if (subscription) {
        await removeSubscription({
          variables: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe().catch(() => undefined);
      }
      setSubscribed(false);
      await refetchSettings();
    } finally {
      setIsDisabling(false);
    }
  }, [refetchSettings, removeSubscription]);

  const setPreference = useCallback(
    async (minSeverity: PlatformPushMinSeverity) => {
      await savePreference({
        variables: { minSeverity },
        update: (cache, result) => {
          const saved = result.data?.platformSetPushPreference;
          if (!saved) return;
          cache.updateQuery<{ platformMyPushSettings: PlatformPushSettings }>(
            { query: PLATFORM_MY_PUSH_SETTINGS },
            (data) =>
              data
                ? {
                    platformMyPushSettings: {
                      ...data.platformMyPushSettings,
                      minSeverity: saved,
                    },
                  }
                : data,
          );
        },
      });
    },
    [savePreference],
  );

  const sendTest = useCallback(async () => {
    const result = await sendTestPush();
    return result.data?.platformSendTestPush ?? 0;
  }, [sendTestPush]);

  const state = pushDeviceState({
    hasServiceWorker:
      typeof navigator !== "undefined" && "serviceWorker" in navigator,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasNotification: typeof window !== "undefined" && "Notification" in window,
    permission,
    isIos: isIosDevice(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints ?? 0,
    ),
    isStandalone: isStandaloneApp(),
    subscribed,
  });

  return {
    enabled,
    configLoading: config.loading && !config.data,
    configError: !!config.error && !config.data,
    retryConfig: () => void config.refetch().catch(() => undefined),
    state,
    settings: settingsQuery.data?.platformMyPushSettings ?? null,
    settingsLoading: settingsQuery.loading && !settingsQuery.data,
    isEnabling,
    isDisabling,
    isSavingPreference,
    isTesting,
    enable,
    disable,
    setPreference,
    sendTest,
  };
}

/**
 * FR-2.2: once per app load, re-send this browser's subscription when it
 * already has one and permission is granted, so the server's row stays
 * current (a row removed after failed sends comes back). Never prompts.
 */
export function useWebPushRefresh(): void {
  const { isAuthenticated } = useAuth();
  const apollo = useApolloClient();
  const done = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || done.current) return;
    if (!hasPushApis() || Notification.permission !== "granted") return;
    done.current = true;
    void (async () => {
      try {
        const { data } = await apollo.query<{
          platformWebPushConfig: PlatformWebPushConfig;
        }>({ query: PLATFORM_WEB_PUSH_CONFIG, fetchPolicy: "cache-first" });
        const publicKey = data.platformWebPushConfig.publicKey;
        if (!data.platformWebPushConfig.enabled || !publicKey) return;
        const subscription = await existingSubscription();
        if (!subscription) return;
        // A subscription from an older key would be refused; leave it.
        const key = urlBase64ToUint8Array(publicKey);
        if (!isSameKey(subscription.options.applicationServerKey, key)) return;
        const input = pushSubscriptionInput(subscription, navigator.userAgent);
        if (!input) return;
        await apollo.mutate({
          mutation: PLATFORM_REGISTER_PUSH_SUBSCRIPTION,
          variables: { input },
        });
      } catch {
        // Silent by design: the settings control shows the real state.
      }
    })();
  }, [apollo, isAuthenticated]);
}
