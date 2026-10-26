/**
 * Platform settings (PRD-005 FR-7.1)
 *
 * Loads `platformSettings` once the user is signed in and keeps
 * `lib/platformSettings` in step, so the screens that still call
 * `loadPlatformSettings()` read the server's values. `updateSettings`
 * writes through `updatePlatformSettings`.
 */

import { useApolloClient, useQuery } from "@apollo/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { PLATFORM_SETTINGS, UPDATE_PLATFORM_SETTINGS } from "../graphql/settings";
import { toPlatformSettings, toPlatformSettingsInput } from "../lib/api-adapters";
import {
  DEFAULT_PLATFORM_SETTINGS,
  isPlatformSettingsLoaded,
  setServerPlatformSettings,
} from "../lib/platformSettings";
import type { PlatformSettings } from "../types";
import type { PlatformSettingsApi, PlatformSettingsPatch } from "../types/platform-api";
import { useAuth } from "./AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: PlatformSettings;
  /**
   * True until the server copy has loaded, including after a failed load:
   * forms stay disabled so Save can't overwrite the server with the
   * defaults (PRD-024 FR-1.1, D-01).
   */
  loading: boolean;
  /** The last load failure while no server copy is held (PRD-024 FR-1.1). */
  error: Error | null;
  /** Reloads the server copy after a failure. */
  retry: () => void;
  updateSettings: (next: PlatformSettings) => Promise<void>;
  /**
   * Saves only the fields in `patch` (the server merges them): dunning and
   * the entitlement mode, each behind its own confirmation (PRD-016).
   */
  updateSettingsPatch: (patch: PlatformSettingsPatch) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const apollo = useApolloClient();

  const query = useQuery<{ platformSettings: PlatformSettingsApi }>(PLATFORM_SETTINGS, {
    skip: !isAuthenticated,
    fetchPolicy: "cache-and-network",
  });

  const serverSettings = useMemo(
    () => (query.data ? toPlatformSettings(query.data.platformSettings) : null),
    [query.data],
  );

  // Keep the module-level reader in step for the screens that call it.
  useEffect(() => {
    setServerPlatformSettings(serverSettings);
  }, [serverSettings]);

  const settings = serverSettings ?? DEFAULT_PLATFORM_SETTINGS;
  // `refetch` is stable; the query result object is not (it would rebuild the context every render).
  const { refetch } = query;

  const updateSettings = useCallback(
    async (next: PlatformSettings) => {
      await apollo.mutate({
        mutation: UPDATE_PLATFORM_SETTINGS,
        variables: { input: toPlatformSettingsInput(next) },
      });
      await refetch();
    },
    [apollo, refetch],
  );

  const updateSettingsPatch = useCallback(
    async (patch: PlatformSettingsPatch) => {
      await apollo.mutate({
        mutation: UPDATE_PLATFORM_SETTINGS,
        variables: { input: patch },
      });
      await query.refetch();
    },
    [apollo, query],
  );

  const retry = useCallback(() => {
    void refetch().catch(() => undefined);
  }, [refetch]);

  const loadError = serverSettings ? null : (query.error ?? null);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loading: !isPlatformSettingsLoaded(serverSettings),
      error: loadError,
      retry,
      updateSettings,
      updateSettingsPatch,
    }),
    [loadError, retry, serverSettings, settings, updateSettings, updateSettingsPatch],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function usePlatformSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("usePlatformSettings must be used within SettingsProvider");
  return ctx;
}
