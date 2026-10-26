/**
 * Stores, subscriptions and plans for every screen (PRD-005 FR-11.3)
 *
 * Reads `platformTenants` and `platformPlans` through the Apollo client,
 * maps them with `lib/api-adapters`, and runs the lifecycle mutations
 * (create, update, notes, suspend with a category, reactivate, delete with
 * the owner's force, restore; PRD-018) against the platform-admin API.
 *
 * The backend caps a page at 100 stores (`MAX_PAGE_LIMIT`), so the list is
 * read page by page with `offset` until `totalCount` is reached (PRD-014
 * FE-09); every page lands in one cached list (`lib/offset-paging.util`).
 */

import { useApolloClient, useQuery } from "@apollo/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PLATFORM_PLANS } from "../graphql/plans";
import {
  CREATE_TENANT,
  DELETE_TENANT,
  PLATFORM_TENANTS,
  REACTIVATE_TENANT,
  RESTORE_TENANT,
  RETRY_TENANT_PROVISIONING,
  SUSPEND_TENANT,
  UPDATE_TENANT,
  UPDATE_TENANT_NOTES,
} from "../graphql/tenants";
import { subscriptionsOf, toClient, toPlan } from "../lib/api-adapters";
import {
  isPageGuardReached,
  MAX_AUTO_PAGES,
  nextOffset,
  SERVER_PAGE_LIMIT,
} from "../lib/offset-paging.util";
import type { Client, ClientStatus, Plan, Subscription } from "../types";
import type {
  CreateTenantInput,
  CreateTenantResult,
  PlatformList,
  PlatformPlan,
  PlatformTenant,
  TenantSuspendCategory,
  UpdateTenantInput,
} from "../types/platform-api";
import { useAuth } from "./AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateStoreResult {
  client: Client;
  /** Legacy servers only: the owner's first password, shown once. */
  ownerTemporaryPassword: string | null;
  /** True when the owner was emailed a set-password link (PRD-014 PLT-07). */
  ownerInviteSent: boolean;
}

interface ClientsContextValue {
  clients: Client[];
  subscriptions: Subscription[];
  plans: Plan[];
  /** True while the first page of the tenant list is loading. */
  loading: boolean;
  /** True while later pages are still being read (FE-09). */
  loadingMore: boolean;
  /** The API error, when the list could not be read. */
  error: Error | null;
  /** Stores on the server; more than `clients.length` while `loadingMore` (or after a page failed). */
  totalCount: number;
  /** Paging stopped before `totalCount`: every screen built on `clients` is partial (W2V-C-01). */
  incomplete: boolean;
  /** Paging stopped at the page guard (5,000 stores), not on a failed page (W2V2-06). */
  pageGuardReached: boolean;
  /** Reads the missing pages again, from where paging stopped; past the guard, the next 5,000. */
  loadRemaining: () => void;
  refetch: () => Promise<unknown>;
  getClient: (id: string) => Client | undefined;
  /** Provisions a new tenant; says whether the owner was emailed an invite. */
  createStore: (input: CreateTenantInput) => Promise<CreateStoreResult>;
  retryProvisioning: (id: string) => Promise<CreateStoreResult>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  /** The store details form (PRD-017 FR-4.5): only the changed fields. */
  updateStoreDetails: (id: string, input: UpdateTenantInput) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  /**
   * Suspend (with a reason and a PRD-018 category) or reactivate.
   * Reactivation always sends `override` and `reason` (PRD-016 FR-18: a
   * BILLING suspension needs a payment or an audited override).
   */
  setClientStatus: (
    id: string,
    status: ClientStatus,
    reason?: string,
    reactivation?: { override: boolean; reason: string | null },
    category?: TenantSuspendCategory,
  ) => Promise<void>;
  /**
   * Needs the slug typed to confirm (PRD-005 FR-3.4); `force` with a
   * reason deletes despite money in flight (PRD-018 FR-2.1, owner only).
   */
  deleteClient: (
    id: string,
    confirmSlug?: string,
    force?: { forceReason: string },
  ) => Promise<void>;
  /** A deleted store back to SUSPENDED inside its grace period (PRD-018 FR-2.3). */
  restoreClient: (id: string) => Promise<void>;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

/** One page of tenants: the backend's cap (FE-09). */
const TENANT_PAGE_LIMIT = SERVER_PAGE_LIMIT;

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Maps the console's `Client` patch onto the API's `UpdateTenantInput`. */
function toUpdateInput(patch: Partial<Client>): UpdateTenantInput {
  const input: UpdateTenantInput = {};
  if (patch.storeName !== undefined) input.name = patch.storeName;
  // PRD-018 FR-4.4: the domain changes only through domain verification
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

  const tenantPage = tenantsQuery.data?.platformTenants;
  const tenants = useMemo(() => tenantPage?.items ?? [], [tenantPage]);

  // Read the next page until the list is complete. `lastPageSize` stops a
  // loop when a page comes back empty (a store deleted meanwhile) or fails;
  // `refetch` starts over from the first page.
  const { fetchMore, loading: tenantsLoading } = tenantsQuery;
  const [lastPageSize, setLastPageSize] = useState<number | null>(null);
  // W2V2-06: the page guard grows by MAX_AUTO_PAGES each time the user asks
  // for more, so "Load more" past 5,000 stores actually reads on.
  const [pageBudget, setPageBudget] = useState(MAX_AUTO_PAGES);
  const fetchingOffset = useRef<number | null>(null);
  const pendingOffset = nextOffset(
    tenantPage,
    TENANT_PAGE_LIMIT,
    lastPageSize,
    pageBudget,
  );
  const pageGuardReached = isPageGuardReached(
    tenantPage,
    TENANT_PAGE_LIMIT,
    pageBudget,
  );
  useEffect(() => {
    if (pendingOffset === null || tenantsLoading) return;
    if (fetchingOffset.current === pendingOffset) return;
    fetchingOffset.current = pendingOffset;
    fetchMore({ variables: { offset: pendingOffset } })
      .then((result) => setLastPageSize(result.data.platformTenants.items.length))
      .catch(() => setLastPageSize(0))
      .finally(() => {
        fetchingOffset.current = null;
      });
  }, [fetchMore, pendingOffset, tenantsLoading]);

  const clients = useMemo(() => tenants.map(toClient), [tenants]);
  const subscriptions = useMemo(() => subscriptionsOf(tenants), [tenants]);
  const plans = useMemo(
    () => (plansQuery.data?.platformPlans ?? []).map(toPlan),
    [plansQuery.data],
  );

  const getClient = useCallback(
    (id: string) => clients.find((client) => client.id === id),
    [clients],
  );

  const { refetch: refetchTenants } = tenantsQuery;
  const { refetch: refetchPlans } = plansQuery;
  const refetch = useCallback(async () => {
    setLastPageSize(null);
    setPageBudget(MAX_AUTO_PAGES);
    // Plan store counts are server-side now, so they refresh with the list.
    void refetchPlans().catch(() => undefined);
    return await refetchTenants();
  }, [refetchTenants, refetchPlans]);
  const totalCount = tenantsQuery.data?.platformTenants.totalCount ?? clients.length;
  const incomplete =
    !tenantsQuery.error && pendingOffset === null && !tenantsLoading && totalCount > clients.length;
  // Clearing the failed page's marker lets `nextOffset` resume at the
  // first missing row; at the page guard the budget grows too (W2V2-06).
  const loadRemaining = useCallback(() => {
    setLastPageSize(null);
    if (pageGuardReached) {
      setPageBudget((budget) => budget + MAX_AUTO_PAGES);
    }
  }, [pageGuardReached]);

  const createStore = useCallback(
    async (input: CreateTenantInput): Promise<CreateStoreResult> => {
      const { data } = await apollo.mutate<{
        createTenant: CreateTenantResult;
      }>({ mutation: CREATE_TENANT, variables: { input } });
      if (!data) throw new Error("No response");
      await refetch();
      return {
        client: toClient(data.createTenant.tenant),
        ownerTemporaryPassword: data.createTenant.ownerTemporaryPassword,
        ownerInviteSent: data.createTenant.ownerInviteSent === true,
      };
    },
    [apollo, refetch],
  );

  const retryProvisioning = useCallback(
    async (id: string): Promise<CreateStoreResult> => {
      const { data } = await apollo.mutate<{
        retryTenantProvisioning: CreateTenantResult;
      }>({ mutation: RETRY_TENANT_PROVISIONING, variables: { id } });
      if (!data) throw new Error("No response");
      await refetch();
      return {
        client: toClient(data.retryTenantProvisioning.tenant),
        ownerTemporaryPassword: data.retryTenantProvisioning.ownerTemporaryPassword,
        ownerInviteSent: data.retryTenantProvisioning.ownerInviteSent === true,
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

  const updateStoreDetails = useCallback(
    async (id: string, input: UpdateTenantInput) => {
      if (Object.keys(input).length === 0) return;
      // Returns the tenant fragment; Apollo updates the list by id
      await apollo.mutate({ mutation: UPDATE_TENANT, variables: { id, input } });
    },
    [apollo],
  );

  const updateNotes = useCallback(
    async (id: string, notes: string) => updateClient(id, { notes }),
    [updateClient],
  );

  const setClientStatus = useCallback(
    async (
      id: string,
      status: ClientStatus,
      reason?: string,
      reactivation?: { override: boolean; reason: string | null },
      category?: TenantSuspendCategory,
    ) => {
      if (status === "suspended") {
        await apollo.mutate({
          mutation: SUSPEND_TENANT,
          variables: {
            id,
            reason: reason?.trim() || "Suspended from the console",
            category: category ?? null,
          },
        });
      } else {
        await apollo.mutate({
          mutation: REACTIVATE_TENANT,
          variables: {
            id,
            override: reactivation?.override ?? false,
            reason: reactivation?.reason ?? null,
          },
        });
      }
      // Suspend and reactivate return the full tenant fragment (review C-M7).
    },
    [apollo],
  );

  const deleteClient = useCallback(
    async (id: string, confirmSlug?: string, force?: { forceReason: string }) => {
      await apollo.mutate({
        mutation: DELETE_TENANT,
        variables: {
          id,
          confirmSlug: confirmSlug ?? "",
          force: force ? true : null,
          forceReason: force?.forceReason ?? null,
        },
      });
      await refetch();
    },
    [apollo, refetch],
  );

  const restoreClient = useCallback(
    async (id: string) => {
      await apollo.mutate({ mutation: RESTORE_TENANT, variables: { id } });
      // A restored store rejoins the list (the list leaves DELETED out)
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
      loadingMore: pendingOffset !== null,
      error: tenantsQuery.error ?? null,
      totalCount,
      incomplete,
      pageGuardReached,
      loadRemaining,
      refetch,
      getClient,
      createStore,
      retryProvisioning,
      updateClient,
      updateStoreDetails,
      updateNotes,
      setClientStatus,
      deleteClient,
      restoreClient,
    }),
    [
      clients,
      createStore,
      deleteClient,
      restoreClient,
      getClient,
      incomplete,
      loadRemaining,
      pageGuardReached,
      pendingOffset,
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
      updateStoreDetails,
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
