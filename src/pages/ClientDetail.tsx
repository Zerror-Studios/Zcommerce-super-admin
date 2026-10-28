import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useMemo, useState, type ComponentType, type Key } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ClientActivityCard } from "../components/clients/ClientActivityCard";
import { ClientAiCard } from "../components/clients/ClientAiCard";
import { ClientAnalyticsCard } from "../components/clients/ClientAnalyticsCard";
import { ClientBillingTab } from "../components/clients/ClientBillingTab";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { ClientPlatformBilling } from "../components/clients/ClientPlatformBilling";
import { ReminderLogCard } from "../components/billing/ReminderLogCard";
import { ClientUsageHistory } from "../components/clients/ClientUsageHistory";
import { OnboardingCard } from "../components/clients/OnboardingCard";
import { StoreDetailsCard } from "../components/clients/StoreDetailsCard";
import { StoreGoLiveCard } from "../components/clients/StoreGoLiveCard";
import { StoreLifecycleCard } from "../components/clients/StoreLifecycleCard";
import { SubscriptionActions } from "../components/clients/SubscriptionActions";
import { StoreActionDialog, type StoreAction } from "../components/clients/storeActions";
import { logInToStore } from "../components/clients/storeLogin";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { PageHeader } from "../components/common/PageHeader";
import { PLATFORM_TENANT, RESEND_OWNER_INVITE } from "../graphql/tenants";
import { subscriptionsOf, toClient } from "../lib/api-adapters";
import { findLatestSubscription } from "../lib/subscription-lookup.util";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { ownerContactGaps } from "../lib/owner-contact.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { paymentState, storeLifecycle } from "../lib/storeStatus";
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
  IconGlobe,
  IconHome,
  IconLogin,
  IconMore,
  IconPlans,
  IconPower,
  IconStore,
  IconTime,
} from "../components/ui/icons";
import {
  Button as UiButton,
  Card,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  PaneHeader,
  PaneList,
  TwoPaneCard,
  menuItemDangerClasses,
  toastError,
  type PaneGroup,
} from "../components/ui";

// ─── Sections ────────────────────────────────────────────────────────────────

/** The store page's sections, one per URL (/stores/:id/:section), laid out like Settings. */
type StoreSection =
  | "overview"
  | "details"
  | "go-live"
  | "billing"
  | "subscription"
  | "usage"
  | "analytics"
  | "ai"
  | "activity"
  | "lifecycle";

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
    description: "Name, contacts, GSTIN, timezone and currency. The domain changes in Go live.",
    icon: IconStore,
  },
  // PRD-018 FR-4
  "go-live": {
    title: "Go live",
    description: "Domain verification and the go-live checklist.",
    icon: IconGlobe,
  },
  // PRD-016 FR-26, PRD-017 FR-4.2, PRD-024 FR-3.9
  billing: {
    title: "Billing",
    description: "Payment status, the grace period, invoices, credits, billing history and the reminders sent.",
    icon: IconBilling,
  },
  subscription: {
    title: "Subscription",
    description: "Change the plan and run the subscription actions for this store.",
    icon: IconPlans,
  },
  // PRD-014 PLT-13
  usage: {
    title: "Usage history",
    description: "The daily usage snapshots, the last one in each month.",
    icon: IconChartBar,
  },
  // PRD-012 FR-8.3
  analytics: {
    title: "Analytics",
    description: "Analytics health and how recent this store's data is.",
    icon: IconAnalytics,
  },
  // PRD-021 FR-6.4
  ai: {
    title: "ZCOM AI",
    description: "Pause ZCOM AI, override its limits, grant questions and see the most-asked questions.",
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
    description: "Suspend, reactivate, delete or restore this store.",
    icon: IconPower,
  },
};

/** Left pane groups. */
const sectionGroups: { label: string; keys: StoreSection[] }[] = [
  { label: "Store", keys: ["overview", "details", "go-live"] },
  { label: "Billing", keys: ["billing", "subscription", "usage"] },
  { label: "Insights", keys: ["analytics", "ai", "activity"] },
  { label: "Manage", keys: ["lifecycle"] },
];

const DEFAULT_SECTION: StoreSection = "overview";

function isStoreSection(value: string | undefined): value is StoreSection {
  return value != null && value in storeSections;
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Store detail (docs/design/04-super-admin.md §3.4, header C), laid out like Settings (owner, 2026-10-28): the
 * header with the store's actions, then one two-pane card (09 §1) with the sections on the left and the chosen
 * one on the right. Each section keeps its URL (/stores/:id/:section); /stores/:id is Overview. Sections the
 * user can't see (AI, Subscription, Lifecycle by permission; Go live once deleted) go back to Overview.
 */
export function ClientDetail() {
  const { id, section } = useParams<{ id: string; section: string }>();
  const navigate = useNavigate();
  const { getClient, updateClient, plans, subscriptions, loading, error, refetch } = useClients();
  // Read through the provider so the page re-renders when the server settings arrive.
  const { settings } = usePlatformSettings();
  const { can, user } = useAuth();
  const [action, setAction] = useState<StoreAction | null>(null);
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [resendOwnerInvite] = useMutation<{ resendOwnerInvite: boolean }>(RESEND_OWNER_INVITE);
  // Client-side mirror of the backend guard (review C-M5): the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const canManageBilling = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canReadAi = can(PLATFORM_PERMISSIONS.AI_READ);

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
      <div>
        <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Loading store…" />
      </div>
    );
  }

  // The list failed to load: say so, don't claim the store doesn't exist.
  if (!client && error) {
    return (
      <div>
        <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Store" />
        <ErrorState title="Couldn't load the store." description={toasts.genericError} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Store not found" />
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

  const lifecycle = storeLifecycle(client);
  const payment = paymentState(subscription);
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
    subscription: canManageBilling,
    usage: true,
    analytics: true,
    ai: canReadAi,
    activity: true,
    lifecycle: canManage,
  };
  const base = `/stores/${client.id}`;

  if (section && !(isStoreSection(section) && visible[section])) return <Navigate to={base} replace />;

  const active: StoreSection = isStoreSection(section) ? section : DEFAULT_SECTION;
  const meta = storeSections[active];
  const paneGroups: PaneGroup[] = sectionGroups.map((group) => ({
    label: group.label,
    items: group.keys
      .filter((key) => visible[key])
      .map((key) => {
        const Icon = storeSections[key].icon;
        return {
          key,
          label: storeSections[key].title,
          icon: <Icon aria-hidden />,
          href: `${base}/${key}`,
        };
      }),
  }));

  // PRD-024 FR-1.4 (D-04): resolves true only once the server saved it; a failure is shown (review C-L6).
  const onSaveGracePeriod = (days: number | undefined): Promise<boolean> =>
    updateClient(client.id, { gracePeriodDays: days }).then(
      () => true,
      (error: unknown) => {
        const message = mutationFailureCopy(error);
        if (message) toastError(message);
        return false;
      },
    );

  const onMenuAction = (key: Key) => {
    if (
      key === "suspend" ||
      key === "reactivate" ||
      key === "delete" ||
      key === "restore" ||
      key === "category"
    ) {
      setAction(key);
    } else if (key === "resend-invite") setConfirmInvite(true);
  };

  // PRD-014 PLT-07: a fresh set-password email for the owner (tenants:manage).
  const sendOwnerInvite = async () => {
    try {
      await resendOwnerInvite({ variables: { tenantId: client.id } });
      addToast({ title: `Invite sent to ${client.ownerEmail}.` });
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    }
  };

  return (
    <div>
      <PageHeader
        type="detail"
        back={{ href: "/stores", label: "Stores" }}
        title={<span className="wrap-anywhere">{client.storeName}</span>}
        badges={
          <>
            <Chip tone={lifecycle.tone}>{lifecycle.label}</Chip>
            <Chip tone={payment.tone}>{payment.label}</Chip>
          </>
        }
        description={
          <span className="wrap-anywhere">
            {`${client.ownerName} · ${client.ownerEmail}`}
            {client.domain ? (
              <>
                {" · "}
                <a
                  href={`https://${client.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  {client.domain}
                </a>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            {canManage ? (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <IconButton aria-label="More actions" showTooltip={false}>
                  <IconMore aria-hidden className="size-4" />
                </IconButton>
              </DropdownTrigger>
              <DropdownMenu aria-label={`Actions for ${client.storeName}`} onAction={onMenuAction}>
                {isDeleted ? (
                  <DropdownSection aria-label="Store">
                    <DropdownItem key="restore">Restore store</DropdownItem>
                  </DropdownSection>
                ) : (
                  <>
                    <DropdownSection showDivider aria-label="Store">
                      <DropdownItem key={isSuspended ? "reactivate" : "suspend"}>
                        {isSuspended ? "Reactivate store" : "Suspend store"}
                      </DropdownItem>
                      {isSuspended ? <DropdownItem key="category">Change suspension category</DropdownItem> : null}
                    </DropdownSection>
                    <DropdownSection showDivider={isOwner} aria-label="Owner">
                      <DropdownItem key="resend-invite">Resend owner invite</DropdownItem>
                    </DropdownSection>
                    {isOwner ? (
                      <DropdownSection aria-label="Danger">
                        <DropdownItem key="delete" className={menuItemDangerClasses}>
                          Delete store
                        </DropdownItem>
                      </DropdownSection>
                    ) : null}
                  </>
                )}
              </DropdownMenu>
            </Dropdown>
            ) : null}
            {canImpersonate && !isDeleted ? (
              <UiButton variant="primary" startIcon={<IconLogin aria-hidden />} onPress={() => void logInToStore(client)}>
                Log in
              </UiButton>
            ) : null}
          </>
        }
      />

      {/* PRD-024 FR-4.4 (D9): migrated stores get their owner contact by hand in Store details. */}
      {contactGaps.isMissingEmail && !isDeleted ? (
        <div role="status" className="mb-4 rounded-lg border border-line bg-tone-warning-soft px-4 py-3 text-label text-fg">
          <p className="font-medium">This store has no owner email.</p>
          <p className="mt-0.5 text-fg-muted">
            Resend owner invite and the billing emails need it
            {contactGaps.isMissingPhone ? ", and SMS or WhatsApp reminders need the owner phone" : ""}.{" "}
            <Link to={`${base}/details`} className="font-medium text-brand hover:underline">
              Add it in Store details
            </Link>
          </p>
        </div>
      ) : null}

      {/* Two-pane card like Settings (09 §1): the sections on the left, the chosen one on the right. Below
          1024px the list is the page and a section shows alone with a back link. */}
      <TwoPaneCard
        showDetail={section != null}
        back={{ href: base, label: client.storeName }}
        list={<PaneList aria-label="Store sections" groups={paneGroups} activeKey={active} />}
      >
        <PaneHeader title={meta.title} description={meta.description} />

        <div className="flex min-w-0 flex-col gap-4">
          {active === "overview" ? (
            <>
              <OnboardingCard client={client} />
              <ClientOverviewTab part="main" client={client} subscription={subscription} />
              {/* Profile and Notes (the old side rail). */}
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <ClientOverviewTab part="rail" client={client} subscription={subscription} />
              </div>
            </>
          ) : null}

          {active === "details" ? <StoreDetailsCard client={client} goLiveHref={`${base}/go-live`} /> : null}

          {active === "go-live" ? <StoreGoLiveCard client={client} /> : null}

          {active === "billing" ? (
            <>
              {/* Payment status and the grace period (the old side rail). */}
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <ClientBillingTab
                  part="rail"
                  client={client}
                  subscription={subscription}
                  defaultGracePeriodDays={defaultGracePeriodDays}
                  onSaveGracePeriod={onSaveGracePeriod}
                  canEdit={canManage}
                />
              </div>
              <ClientPlatformBilling client={client} subscription={subscription} />
              <ClientBillingTab
                part="main"
                client={client}
                subscription={subscription}
                defaultGracePeriodDays={defaultGracePeriodDays}
                onSaveGracePeriod={onSaveGracePeriod}
                canEdit={canManage}
              />
              <ReminderLogCard tenantId={client.id} />
            </>
          ) : null}

          {active === "subscription" ? (
            <SubscriptionActions client={client} subscription={subscription} plans={plans} />
          ) : null}

          {active === "usage" ? <ClientUsageHistory tenantId={client.id} /> : null}

          {active === "analytics" ? <ClientAnalyticsCard client={client} /> : null}

          {active === "ai" ? <ClientAiCard client={client} /> : null}

          {active === "activity" ? <ClientActivityCard tenantId={client.id} /> : null}

          {active === "lifecycle" ? (
            <StoreLifecycleCard client={client} onDeleted={() => navigate("/stores")} />
          ) : null}
        </div>
      </TwoPaneCard>

      <ConfirmModal
        isOpen={confirmInvite}
        onClose={() => setConfirmInvite(false)}
        onConfirm={() => void sendOwnerInvite()}
        title="Resend the owner invite?"
        description={`We'll email ${client.ownerEmail} a new link to set the password for ${client.storeName}.`}
        confirmLabel="Send invite"
        confirmColor="primary"
      />

      <StoreActionDialog
        client={client}
        action={action}
        onClose={() => setAction(null)}
        onDeleted={() => navigate("/stores")}
      />
    </div>
  );
}
