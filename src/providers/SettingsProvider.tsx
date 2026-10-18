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
import { DEFAULT_PLATFORM_SETTINGS, setServerPlatformSettings } from "../lib/platformSettings";
import type { PlatformSettings } from "../types";
import type { PlatformSettingsApi } from "../types/platform-api";
import { useAuth } from "./AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: PlatformSettings;
  loading: boolean;
  updateSettings: (next: PlatformSettings) => Promise<void>;
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

  const updateSettings = useCallback(
    async (next: PlatformSettings) => {
      await apollo.mutate({
        mutation: UPDATE_PLATFORM_SETTINGS,
        variables: { input: toPlatformSettingsInput(next) },
      });
      await query.refetch();
    },
    [apollo, query],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loading: query.loading && !query.data,
      updateSettings,
    }),
    [query.data, query.loading, settings, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function usePlatformSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("usePlatformSettings must be used within SettingsProvider");
  return ctx;
}
