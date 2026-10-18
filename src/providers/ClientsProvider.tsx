/**
 * Stores, subscriptions and plans for every screen (PRD-005 FR-11.3)
 *
 * Reads `platformTenants` and `platformPlans` through the Apollo client,
 * maps them with `lib/api-adapters`, and runs the lifecycle mutations
 * (create, update, notes, suspend, reactivate, delete) against the
 * platform-admin API.
 */

import { useApolloClient, useQuery } from "@apollo/client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { PLATFORM_PLANS } from "../graphql/plans";
import {
  CREATE_TENANT,
  DELETE_TENANT,
  PLATFORM_TENANTS,
  REACTIVATE_TENANT,
  RETRY_TENANT_PROVISIONING,
  SUSPEND_TENANT,
  UPDATE_TENANT,
  UPDATE_TENANT_NOTES,
} from "../graphql/tenants";
import { subscriptionsOf, toClient, toPlan } from "../lib/api-adapters";
import type { Client, ClientStatus, Plan, Subscription } from "../types";
import type {
  CreateTenantInput,
  PlatformList,
  PlatformPlan,
  PlatformTenant,
  UpdateTenantInput,
} from "../types/platform-api";
import { useAuth } from "./AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateStoreResult {
  client: Client;
  /** Shown once: the store owner's first password. */
  ownerTemporaryPassword: string | null;
}

interface ClientsContextValue {
  clients: Client[];
  subscriptions: Subscription[];
  plans: Plan[];
  /** True while the tenant list is loading. */
  loading: boolean;
  /** The API error, when the list could not be read. */
  error: Error | null;
  /** Stores on the server; more than `clients.length` means the page cap was hit (review C-L9). */
  totalCount: number;
  refetch: () => Promise<unknown>;
  getClient: (id: string) => Client | undefined;
  /** Provisions a new tenant and returns the owner's one-time password. */
  createStore: (input: CreateTenantInput) => Promise<CreateStoreResult>;
  retryProvisioning: (id: string) => Promise<CreateStoreResult>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  setClientStatus: (id: string, status: ClientStatus, reason?: string) => Promise<void>;
  /** Needs the slug typed to confirm (PRD-005 FR-3.4). */
  deleteClient: (id: string, confirmSlug?: string) => Promise<void>;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

/** All tenants in one page; the platform has tens of stores, not thousands. */
const TENANT_PAGE_LIMIT = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Maps the console's `Client` patch onto the API's `UpdateTenantInput`. */
function toUpdateInput(patch: Partial<Client>): UpdateTenantInput {
  const input: UpdateTenantInput = {};
  if (patch.storeName !== undefined) input.name = patch.storeName;
  if (patch.domain !== undefined) input.domain = patch.domain || null;
  if (patch.ownerName !== undefined) input.ownerName = patch.ownerName;
  if (patch.ownerEmail !== undefined) input.ownerEmail = patch.ownerEmail;
  if (patch.ownerPhone !== undefined) input.ownerPhone = patch.ownerPhone || null;
  if ("gracePeriodDays" in patch) input.gracePeriodDaysOverride = patch.gracePeriodDays ?? null;
  return input;
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function ClientsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const apollo = useApolloClient();

  const tenantsQuery = useQuery<{ platformTenants: PlatformList<PlatformTenant> }>(
    PLATFORM_TENANTS,
    {
      variables: { sort: "NAME_ASC", limit: TENANT_PAGE_LIMIT, offset: 0 },
      skip: !isAuthenticated,
      fetchPolicy: "cache-and-network",
    },
  );
  const plansQuery = useQuery<{ platformPlans: PlatformPlan[] }>(PLATFORM_PLANS, {
    variables: { includeInactive: false },
    skip: !isAuthenticated,
  });

  const tenants = useMemo(
    () => tenantsQuery.data?.platformTenants.items ?? [],
    [tenantsQuery.data],
  );

  const clients = useMemo(() => tenants.map(toClient), [tenants]);
  const subscriptions = useMemo(() => subscriptionsOf(tenants), [tenants]);
  const plans = useMemo(
    () => (plansQuery.data?.platformPlans ?? []).map((plan) => toPlan(plan, tenants)),
    [plansQuery.data, tenants],
  );

  const getClient = useCallback(
    (id: string) => clients.find((client) => client.id === id),
    [clients],
  );

  const refetch = tenantsQuery.refetch;
  const totalCount = tenantsQuery.data?.platformTenants.totalCount ?? clients.length;

  const createStore = useCallback(
    async (input: CreateTenantInput): Promise<CreateStoreResult> => {
      const { data } = await apollo.mutate<{
        createTenant: { tenant: PlatformTenant; ownerTemporaryPassword: string | null };
      }>({ mutation: CREATE_TENANT, variables: { input } });
      if (!data) throw new Error("No response");
      await refetch();
      return {
        client: toClient(data.createTenant.tenant),
        ownerTemporaryPassword: data.createTenant.ownerTemporaryPassword,
      };
    },
    [apollo, refetch],
  );

  const retryProvisioning = useCallback(
    async (id: string): Promise<CreateStoreResult> => {
      const { data } = await apollo.mutate<{
        retryTenantProvisioning: { tenant: PlatformTenant; ownerTemporaryPassword: string | null };
      }>({ mutation: RETRY_TENANT_PROVISIONING, variables: { id } });
      if (!data) throw new Error("No response");
      await refetch();
      return {
        client: toClient(data.retryTenantProvisioning.tenant),
        ownerTemporaryPassword: data.retryTenantProvisioning.ownerTemporaryPassword,
      };
    },
    [apollo, refetch],
  );

  const updateClient = useCallback(
    async (id: string, patch: Partial<Client>) => {
      if (patch.notes !== undefined) {
        await apollo.mutate({ mutation: UPDATE_TENANT_NOTES, variables: { id, notes: patch.notes } });
      }
      const input = toUpdateInput(patch);
      if (Object.keys(input).length > 0) {
        await apollo.mutate({ mutation: UPDATE_TENANT, variables: { id, input } });
      }
      // Both mutations return the tenant (or its id + notes), which Apollo
      // normalises into the list by id: no refetch needed (review C-M7).
    },
    [apollo],
  );

  const updateNotes = useCallback(
    async (id: string, notes: string) => updateClient(id, { notes }),
    [updateClient],
  );

  const setClientStatus = useCallback(
    async (id: string, status: ClientStatus, reason?: string) => {
      if (status === "suspended") {
        await apollo.mutate({
          mutation: SUSPEND_TENANT,
          variables: { id, reason: reason?.trim() || "Suspended from the console" },
        });
      } else {
        await apollo.mutate({ mutation: REACTIVATE_TENANT, variables: { id } });
      }
      // Suspend and reactivate return the full tenant fragment (review C-M7).
    },
    [apollo],
  );

  const deleteClient = useCallback(
    async (id: string, confirmSlug?: string) => {
      await apollo.mutate({ mutation: DELETE_TENANT, variables: { id, confirmSlug: confirmSlug ?? "" } });
      await refetch();
    },
    [apollo, refetch],
  );

  const value = useMemo<ClientsContextValue>(
    () => ({
      clients,
      subscriptions,
      plans,
      loading: tenantsQuery.loading && !tenantsQuery.data,
      error: tenantsQuery.error ?? null,
      totalCount,
      refetch,
      getClient,
      createStore,
      retryProvisioning,
      updateClient,
      updateNotes,
      setClientStatus,
      deleteClient,
    }),
    [
      clients,
      createStore,
      deleteClient,
      getClient,
      plans,
      refetch,
      retryProvisioning,
      setClientStatus,
      subscriptions,
      tenantsQuery.data,
      tenantsQuery.error,
      tenantsQuery.loading,
      totalCount,
      updateClient,
      updateNotes,
    ],
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients(): ClientsContextValue {
  const ctx = useContext(ClientsContext);
  if (!ctx) {
    throw new Error("useClients must be used within ClientsProvider");
  }
  return ctx;
}
