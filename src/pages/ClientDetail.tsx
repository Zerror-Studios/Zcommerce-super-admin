import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentType, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClientActivityCard } from "../components/clients/ClientActivityCard";
import { ClientAiCard } from "../components/clients/ClientAiCard";
import { ClientAnalyticsCard } from "../components/clients/ClientAnalyticsCard";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { IssueCreditDialog, RecordRefundDialog } from "../components/clients/ClientPlatformBilling";
import { ClientUsageHistory } from "../components/clients/ClientUsageHistory";
import { OnboardingCard } from "../components/clients/OnboardingCard";
import { StoreBillingSection } from "../components/clients/StoreBillingSection";
import { InlineNotice } from "../components/clients/StoreDetailParts";
import { StoreDetailsCard, StoreDetailsDialog } from "../components/clients/StoreDetailsCard";
import { StoreGoLiveCard } from "../components/clients/StoreGoLiveCard";
import { StoreLifecycleCard } from "../components/clients/StoreLifecycleCard";
import {
  SubscriptionDialogs,
  subscriptionActionsFor,
  type SubscriptionDialog,
} from "../components/clients/SubscriptionActions";
import { paymentBadge, storeStatusBadge } from "../components/clients/stores-list/store-list.util";
import { StoreActionDialog, type StoreAction } from "../components/clients/storeActions";
import { logInToStore } from "../components/clients/storeLogin";
import { useStoreBillingRefresh } from "../components/clients/useStoreBillingRefresh";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { PageHeader } from "../components/common/PageHeader";
import { PlanEditorModal } from "../components/settings/PlanEditorModal";
import { PLATFORM_TENANT, RESEND_OWNER_INVITE } from "../graphql/tenants";
import { subscriptionsOf, toClient } from "../lib/api-adapters";
import { findLatestSubscription } from "../lib/subscription-lookup.util";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { ownerContactGaps } from "../lib/owner-contact.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { graceDaysFor } from "../lib/storeStatus";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformSettings } from "../providers/SettingsProvider";
import { toasts } from "../copy";
import type { PlatformTenant } from "../types/platform-api";
import {
  IconAnalytics,
  IconBilling,
  IconBolt,
  IconChartBar,
  IconDelete,
  IconEdit,
  IconGlobe,
  IconHome,
  IconLink,
  IconLogin,
  IconPause,
  IconPayments,
  IconPlans,
  IconPower,
  IconSend,
  IconStore,
  IconTime,
} from "../components/ui/icons";
import {
  Button as UiButton,
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  PaneHeader,
  RowMenu,
  SettingsShell,
  toast,
  toastError,
  type RowMenuItem,
  type SettingsMenuGroup,
} from "../components/ui";

// ─── Sections ────────────────────────────────────────────────────────────────

/** The store page's sections, one per URL (/stores/:id/:section), in the shared section-menu card (04 S-03). */
type StoreSection = "overview" | "details" | "go-live" | "billing" | "usage" | "analytics" | "ai" | "activity" | "lifecycle";

interface StoreSectionMeta {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const storeSections: Record<StoreSection, StoreSectionMeta> = {
  overview: {
    title: "Overview",
    description: "Sales, health and plan usage at a glance, with the owner's profile and notes.",
    icon: IconHome,
  },
  // PRD-017 FR-4.5
  details: {
    title: "Store details",
    description: "Name, owner, contacts, GSTIN, time zone and currency. The domain changes in Go live.",
    icon: IconStore,
  },
  // PRD-018 FR-4
  "go-live": {
    title: "Go live",
    description: "Verify the store's domain and check everything it needs before going live.",
    icon: IconGlobe,
  },
  // PRD-016 FR-26, PRD-017 FR-4.2, PRD-024 FR-3.9; the old Subscription section merged in (04 S-03d).
  billing: {
    title: "Billing & plan",
    description: "The plan, payments, invoices, credits and reminders, and every billing action.",
    icon: IconBilling,
  },
  // PRD-014 PLT-13
  usage: {
    title: "Usage history",
    description: "The monthly usage snapshots: the last daily snapshot of each month.",
    icon: IconChartBar,
  },
  // PRD-012 FR-8.3
  analytics: {
    title: "Analytics",
    description: "Whether this store's Google Analytics data is syncing and how fresh it is.",
    icon: IconAnalytics,
  },
  // PRD-021 FR-6.4
  ai: {
    title: "ZCOM AI",
    description: "This store's AI status, limits, use this month and most-asked questions.",
    icon: IconBolt,
  },
  // PRD-024 FR-1.12
  activity: {
    title: "Activity",
    description: "Every change made to this store from the console, newest first.",
    icon: IconTime,
  },
  // PRD-018 FR-1, FR-2
  lifecycle: {
    title: "Lifecycle",
    description: "Suspend, reactivate, delete or restore the store, after checking money in flight.",
    icon: IconPower,
  },
};

/** Menu groups (04 S-03): Store · Billing · Insights · Manage. */
const sectionGroups: { label: string; keys: StoreSection[] }[] = [
  { label: "Store", keys: ["overview", "details", "go-live"] },
  { label: "Billing", keys: ["billing", "usage"] },
  { label: "Insights", keys: ["analytics", "ai", "activity"] },
  { label: "Manage", keys: ["lifecycle"] },
];

const DEFAULT_SECTION: StoreSection = "overview";

function isStoreSection(value: string | undefined): value is StoreSection {
  return value != null && value in storeSections;
}

type BillingDialog = SubscriptionDialog | "credit" | "refund" | "customPlan";

const PHONE_QUERY = "(max-width: 639px)";

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Phone: header actions other than "Log in to store" move into ⋯ (04 S-03d). */
function useIsPhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

/**
 * Where the back button goes (01 §7.27): "Back to Subscriptions" when opened from a Subscriptions row
 * (`?from=subscriptions`), else "Back to Stores". A list that passes `state.from` (its URL with tab, filters and
 * page) gets that URL back.
 */
function backTarget(fromSubscriptions: boolean, from: string | undefined): { href: string; label: string } {
  if (fromSubscriptions) {
    return { href: from?.startsWith("/subscriptions") ? from : "/subscriptions", label: "Subscriptions" };
  }
  return { href: from?.startsWith("/stores") ? from : "/stores", label: "Stores" };
}

/** The store header is sticky: table heads in the sections stick just under it (01 §7.14, 02 §8). */
const stickyTopStyle = {
  "--zc-sticky-top": "calc(var(--zc-topbar-offset, 0rem) + var(--zc-sticky-header-h, 4.5rem))",
} as CSSProperties;

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Store detail (04 S-03): the sticky detail header (back, store name with status and payment badges, meta line,
 * ⋯ and "Log in to store"), the missing-owner notice, then the shared section menu card (220px, sticky under the
 * header) and the chosen section. Each section keeps its URL (/stores/:id/:section); sections the user can't see
 * (ZCOM AI and Lifecycle by permission, Go live once deleted) go back to Overview.
 */
export function ClientDetail() {
  const { id, section } = useParams<{ id: string; section: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();
  const { getClient, subscriptions, updateClient, loading, error, refetch } = useClients();
  // Read through the provider so the page re-renders when the server settings arrive.
  const { settings } = usePlatformSettings();
  const { can, user } = useAuth();
  const [action, setAction] = useState<StoreAction | null>(null);
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [billingDialog, setBillingDialog] = useState<BillingDialog | null>(null);
  // The list URL the user came from survives section switches (the page stays mounted between sections).
  const [cameFrom] = useState(() => (location.state as { from?: string } | null)?.from);
  const [resendOwnerInvite] = useMutation<{ resendOwnerInvite: boolean }>(RESEND_OWNER_INVITE);
  const refreshBilling = useStoreBillingRefresh();
  // Client-side mirror of the backend guard (review C-M5): the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const canManageBilling = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canReadAi = can(PLATFORM_PERMISSIONS.AI_READ);
  const fromSubscriptions = searchParams.get("from") === "subscriptions";
  const back = backTarget(fromSubscriptions, cameFrom);

  // The Stores row menu's "Edit store details" opens /stores/:id/details?edit=1: open the Edit pop-up once, then
  // drop the param so a reload or Back doesn't open it again.
  const wantsEdit = section === "details" && searchParams.get("edit") === "1";
  useEffect(() => {
    if (!wantsEdit) return;
    if (canManage) setEditingDetails(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("edit");
        return next;
      },
      { replace: true },
    );
  }, [canManage, setSearchParams, wantsEdit]);

  const listedClient = id ? getClient(id) : undefined;
  // PRD-014 FE-09: a store that isn't in the loaded list (a deep link while
  // later pages load) is read on its own; NOT_FOUND means it doesn't exist.
  const single = useQuery<{ platformTenant: PlatformTenant }>(PLATFORM_TENANT, {
    variables: { id },
    skip: !id || !!listedClient || loading,
  });
  const fetchedTenant = listedClient ? undefined : single.data?.platformTenant;
  const client = useMemo(
    () => listedClient ?? (fetchedTenant ? toClient(fetchedTenant) : undefined),
    [fetchedTenant, listedClient],
  );
  const defaultGracePeriodDays = settings.gracePeriodDays;

  const subscription = useMemo(() => {
    if (!client) return undefined;
    const source = fetchedTenant ? subscriptionsOf([fetchedTenant]) : subscriptions;
    return findLatestSubscription(source, client.id);
  }, [client, fetchedTenant, subscriptions]);

  if (!id) {
    return <Navigate to="/stores" replace />;
  }

  // Deep links land here before `platformTenants` has answered: wait, don't say "not found".
  if (!client && (loading || single.loading)) {
    return (
      <div className="mx-auto max-w-content">
        <PageHeader type="detail" back={back} title="Loading store…" />
      </div>
    );
  }

  // The list failed to load: say so, don't claim the store doesn't exist.
  if (!client && error) {
    return (
      <div className="mx-auto max-w-content">
        <PageHeader type="detail" back={back} title="Store" />
        <ErrorState title="Couldn't load the store." description={toasts.genericError} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-content">
        <PageHeader type="detail" back={back} title="Store not found" />
        <Card>
          <EmptyState
            icon={IconStore}
            title="This store doesn't exist"
            description="It may have been deleted, or the link may be broken."
            action={
              <UiButton variant="secondary" onPress={() => navigate("/stores")}>
                Go to stores
              </UiButton>
            }
          />
        </Card>
      </div>
    );
  }

  const status = storeStatusBadge(client);
  const payment = paymentBadge(subscription, graceDaysFor(client, defaultGracePeriodDays));
  const isDeleted = client.tenantStatus === "DELETED";
  const contactGaps = ownerContactGaps(client);
  const isSuspended = !isDeleted && client.status === "suspended";
  // Q10 / PRD-018 FR-2.1: only the platform owner deletes a store.
  const isOwner = user?.role === "PLATFORM_OWNER";

  // Client-side mirror of the guards above; a hidden section's URL goes back to Overview.
  const visible: Record<StoreSection, boolean> = {
    overview: true,
    details: true,
    "go-live": !isDeleted,
    billing: true,
    usage: true,
    analytics: true,
    ai: canReadAi,
    activity: true,
    lifecycle: canManage,
  };
  const base = `/stores/${client.id}`;
  // Opened from Subscriptions: every section keeps "Back to Subscriptions".
  const query = fromSubscriptions ? "?from=subscriptions" : "";
  const hrefOf = (key: StoreSection) => `${base}/${key}${query}`;

  // The Subscription section merged into Billing & plan (04 S-03 change 2); App.tsx redirects it too.
  if (section === "subscription") return <Navigate to={hrefOf("billing")} replace />;
  if (section && !(isStoreSection(section) && visible[section])) return <Navigate to={hrefOf(DEFAULT_SECTION)} replace />;

  const active: StoreSection = isStoreSection(section) ? section : DEFAULT_SECTION;
  const meta = storeSections[active];
  const menuGroups: SettingsMenuGroup[] = sectionGroups.map((group) => ({
    label: group.label,
    items: group.keys
      .filter((key) => visible[key])
      .map((key) => ({ key, label: storeSections[key].title, href: hrefOf(key), icon: storeSections[key].icon })),
  }));

  // PRD-024 FR-1.4 (D-04): resolves true only once the server saved it; a failure is shown (review C-L6).
  const onSaveGracePeriod = (days: number | undefined): Promise<boolean> =>
    updateClient(client.id, { gracePeriodDays: days }).then(
      () => true,
      (failure: unknown) => {
        const message = mutationFailureCopy(failure);
        if (message) toastError(message);
        return false;
      },
    );

  // PRD-014 PLT-07: a fresh set-password email for the owner (tenants:manage).
  const sendOwnerInvite = async () => {
    try {
      await resendOwnerInvite({ variables: { tenantId: client.id } });
      addToast({ title: `Invite sent to ${client.ownerEmail}.` });
    } catch (failure) {
      const message = mutationFailureCopy(failure);
      if (message) toastError(message);
    }
  };

  const copyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${client.domain}`);
      toast.success("Store link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  // ── Header actions ──
  const logIn =
    canImpersonate && !isDeleted ? (
      <UiButton
        variant={active === "billing" && !isPhone ? "secondary" : "primary"}
        startIcon={<IconLogin aria-hidden />}
        onPress={() => void logInToStore(client)}
      >
        Log in to store
      </UiButton>
    ) : null;

  const storeMenu: RowMenuItem[] = [];
  if (canManage && !isDeleted) {
    storeMenu.push({ key: "edit", label: "Edit store details", icon: IconEdit, onSelect: () => setEditingDetails(true) });
    storeMenu.push({ key: "invite", label: "Resend owner invite", icon: IconSend, onSelect: () => setConfirmInvite(true) });
  }
  if (client.domain) {
    storeMenu.push({ key: "copy-link", label: "Copy store link", icon: IconLink, onSelect: () => void copyStoreLink() });
  }
  if (canManage) {
    if (isDeleted) {
      storeMenu.push({ key: "restore", label: "Restore store", icon: IconPower, onSelect: () => setAction("restore") });
    } else if (isSuspended) {
      storeMenu.push({ key: "reactivate", label: "Reactivate store", icon: IconPower, onSelect: () => setAction("reactivate") });
      storeMenu.push({ key: "category", label: "Change suspension category", icon: IconPause, onSelect: () => setAction("category") });
    } else {
      storeMenu.push({ key: "suspend", label: "Suspend store", icon: IconPause, destructive: true, onSelect: () => setAction("suspend") });
    }
    if (!isDeleted && isOwner) {
      storeMenu.push({ key: "delete", label: "Delete store", icon: IconDelete, destructive: true, onSelect: () => setAction("delete") });
    }
  }

  // Billing & plan: Change plan, then ⋯ with the subscription actions (04 S-03d header actions).
  const subActions = subscriptionActionsFor(subscription, canManageBilling);
  const openBilling = (dialog: BillingDialog) => () => setBillingDialog(dialog);
  const billingMenu: RowMenuItem[] = [];
  if (canManageBilling) {
    if (isPhone && subActions.plan) billingMenu.push({ key: "plan", label: "Change plan", icon: IconPlans, onSelect: openBilling("plan") });
    if (subActions.payment) billingMenu.push({ key: "payment", label: "Record payment", icon: IconPayments, onSelect: openBilling("payment") });
    billingMenu.push({ key: "credit", label: "Issue credit", icon: IconBilling, onSelect: openBilling("credit") });
    billingMenu.push({ key: "refund", label: "Record refund", icon: IconPayments, onSelect: openBilling("refund") });
    if (subActions.pastDue) billingMenu.push({ key: "pastDue", label: "Mark past due", icon: IconTime, onSelect: openBilling("pastDue") });
    if (subActions.trial) billingMenu.push({ key: "trial", label: "Extend trial", icon: IconTime, onSelect: openBilling("trial") });
    if (subActions.activate) {
      billingMenu.push({ key: "activate", label: "Activate without payment", icon: IconPower, onSelect: openBilling("activate") });
    }
    if (subActions.reactivate) {
      billingMenu.push({ key: "reactivate", label: "Reactivate subscription", icon: IconPower, onSelect: openBilling("reactivate") });
    }
    if (subActions.cancel) {
      billingMenu.push({ key: "cancel", label: "Cancel subscription", icon: IconDelete, destructive: true, onSelect: openBilling("cancel") });
    }
  }

  const headerActions =
    active === "billing" ? (
      <>
        {logIn}
        {canManageBilling && subActions.plan && !isPhone ? (
          <UiButton variant="secondary" onPress={openBilling("plan")}>
            Change plan
          </UiButton>
        ) : null}
        {billingMenu.length ? <RowMenu items={billingMenu} label={`Billing actions for ${client.storeName}`} size="md" /> : null}
      </>
    ) : (
      <>
        {storeMenu.length ? <RowMenu items={storeMenu} label={`Actions for ${client.storeName}`} size="md" /> : null}
        {logIn}
      </>
    );

  // Meta line: owner name · owner email · domain ↗ (as live; leaving out missing parts is Check first 05 #24).
  const metaLine = (
    <span className="wrap-anywhere">
      {`${client.ownerName} · ${client.ownerEmail}`}
      {client.domain ? (
        <>
          {" · "}
          <a href={`https://${client.domain}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            {client.domain} ↗
          </a>
        </>
      ) : null}
    </span>
  );

  return (
    <div className="mx-auto max-w-content" style={stickyTopStyle}>
      <PageHeader
        type="detail"
        back={back}
        title={<span className="wrap-anywhere">{client.storeName}</span>}
        badges={
          <>
            <Chip tone={status.tone}>{status.label}</Chip>
            <Chip tone={payment.tone}>{payment.label}</Chip>
          </>
        }
        description={metaLine}
        actions={headerActions}
      />

      {/* PRD-024 FR-4.4 (D9): migrated stores get their owner contact by hand in Store details. */}
      {contactGaps.isMissingEmail && !isDeleted ? (
        <InlineNotice
          className="mb-4"
          action={
            active === "details" ? undefined : (
              <ButtonLink to={hrefOf("details")} variant="tertiary" size="sm">
                Add it in Store details
              </ButtonLink>
            )
          }
        >
          This store has no owner email. Billing emails and owner invites need it
          {contactGaps.isMissingPhone ? "; SMS and WhatsApp reminders also need the owner's phone." : "."}
        </InlineNotice>
      ) : null}

      <SettingsShell
        aria-label="Store sections"
        groups={menuGroups}
        activeKey={active}
        menuWidth="sm"
        stickyClassName="top-[calc(var(--zc-sticky-header-h,4.5rem)+1rem)]"
      >
        {/* Only the section content crossfades; the menu never re-renders its animation (01 §8.2). */}
        <div key={active} className="animate-rise-in">
          <PaneHeader title={meta.title} description={meta.description} />

          <div className="flex min-w-0 flex-col gap-4">
            {active === "overview" ? (
              <>
                <OnboardingCard client={client} />
                <ClientOverviewTab client={client} subscription={subscription} />
              </>
            ) : null}

            {active === "details" ? <StoreDetailsCard client={client} goLiveHref={hrefOf("go-live")} /> : null}

            {active === "go-live" ? <StoreGoLiveCard client={client} /> : null}

            {active === "billing" ? (
              <StoreBillingSection
                client={client}
                subscription={subscription}
                defaultGracePeriodDays={defaultGracePeriodDays}
                onSaveGracePeriod={onSaveGracePeriod}
                onCreateCustomPlan={openBilling("customPlan")}
                lifecycleHref={hrefOf("lifecycle")}
              />
            ) : null}

            {active === "usage" ? <ClientUsageHistory tenantId={client.id} /> : null}

            {active === "analytics" ? <ClientAnalyticsCard client={client} /> : null}

            {active === "ai" ? <ClientAiCard client={client} /> : null}

            {active === "activity" ? <ClientActivityCard tenantId={client.id} /> : null}

            {active === "lifecycle" ? <StoreLifecycleCard client={client} onDeleted={() => navigate("/stores")} /> : null}
          </div>
        </div>
      </SettingsShell>

      <ConfirmModal
        isOpen={confirmInvite}
        onClose={() => setConfirmInvite(false)}
        onConfirm={() => void sendOwnerInvite()}
        title="Resend the owner invite?"
        description={`We'll email ${client.ownerEmail} a new link to set the password for ${client.storeName}.`}
        confirmLabel="Send invite"
        confirmColor="primary"
      />

      {editingDetails ? <StoreDetailsDialog client={client} onClose={() => setEditingDetails(false)} /> : null}

      <StoreActionDialog client={client} action={action} onClose={() => setAction(null)} onDeleted={() => navigate("/stores")} />

      {/* Billing & plan pop-ups, opened from the header menu and the Plan and subscription card. */}
      <SubscriptionDialogs
        client={client}
        subscription={subscription}
        dialog={
          billingDialog === "credit" || billingDialog === "refund" || billingDialog === "customPlan" ? null : billingDialog
        }
        onClose={() => setBillingDialog(null)}
      />
      <IssueCreditDialog
        isOpen={billingDialog === "credit"}
        client={client}
        onClose={() => setBillingDialog(null)}
        onDone={refreshBilling}
      />
      <RecordRefundDialog
        isOpen={billingDialog === "refund"}
        client={client}
        onClose={() => setBillingDialog(null)}
        onDone={refreshBilling}
      />
      <PlanEditorModal
        isOpen={billingDialog === "customPlan"}
        tenantId={client.id}
        tenantName={client.storeName}
        onClose={() => setBillingDialog(null)}
      />
    </div>
  );
}
