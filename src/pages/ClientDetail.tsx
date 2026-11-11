import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClientActivityCard } from "../components/clients/ClientActivityCard";
import { ClientAiCard } from "../components/clients/ClientAiCard";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { IssueCreditDialog, RecordRefundDialog } from "../components/clients/ClientPlatformBilling";
import { ClientUsageHistory } from "../components/clients/ClientUsageHistory";
import { OnboardingCard } from "../components/clients/OnboardingCard";
import { StoreAppsTab } from "../components/clients/StoreAppsTab";
import { StoreBillingSection } from "../components/clients/StoreBillingSection";
import { InlineNotice } from "../components/clients/StoreDetailParts";
import { StoreDetailsCard, StoreDetailsDialog } from "../components/clients/StoreDetailsCard";
import { StoreGoLiveCard } from "../components/clients/StoreGoLiveCard";
import { StoreSetupCard } from "../components/clients/StoreSetupCard";
import { StoreHistoryCard } from "../components/clients/StoreHistoryCard";
import { StoreLifecycleCard } from "../components/clients/StoreLifecycleCard";
import { StoreProfileCard } from "../components/clients/StoreProfileCard";
import { StoreTabsPrefetch } from "../components/clients/StoreTabsPrefetch";
import { StoreTeamTab } from "../components/clients/StoreTeamTab";
import {
  SubscriptionDialogs,
  subscriptionActionsFor,
  type SubscriptionDialog,
} from "../components/clients/SubscriptionActions";
import { planShortName, storeStatusBadge } from "../components/clients/stores-list/store-list.util";
import { StoreActionDialog, type StoreAction } from "../components/clients/storeActions";
import { logInToStore, storeLoginIntentProps } from "../components/clients/storeLogin";
import { useStoreBillingRefresh } from "../components/clients/useStoreBillingRefresh";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { SkelChip, SkelLine } from "../components/common/SkeletonBits";
import { PageHeader } from "../components/common/PageHeader";
import { useDocumentTitle } from "../components/layout/document-title";
import { PlanEditorModal } from "../components/settings/PlanEditorModal";
import { PLATFORM_TENANT, RESEND_OWNER_INVITE } from "../graphql/tenants";
import { useTenantProfile } from "../hooks/use-tenant-profile";
import { subscriptionsOf, toClient } from "../lib/api-adapters";
import { findLatestSubscription } from "../lib/subscription-lookup.util";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { ownerContactGaps } from "../lib/owner-contact.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformSettings } from "../providers/SettingsProvider";
import { toasts } from "../copy";
import type { PlatformTenant } from "../types/platform-api";
import {
  IconBilling,
  IconDelete,
  IconEdit,
  IconExternalArrow,
  IconLink,
  IconMessages,
  IconPause,
  IconPayments,
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
  IconTile,
  SegmentedSwitch,
  toast,
  toastError,
  type RowMenuItem,
} from "../components/ui";

// ─── Tabs ────────────────────────────────────────────────────────────────────

/**
 * The store page's tabs (design v2 §7, boards 60–66), one URL each (/stores/:id/:tab). The 11 sections of the old
 * two-pane card live inside them: Profile, Go live and Performance on Overview; History on Activity log; Usage
 * history on AI usage; Analytics (GA4 sync) on Apps; Store details and Lifecycle on Settings.
 */
type StoreTab = "overview" | "billing" | "team" | "apps" | "ai" | "activity" | "settings";

const STORE_TABS: { key: StoreTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "billing", label: "Billing" },
  { key: "team", label: "Team" },
  { key: "apps", label: "Apps" },
  { key: "ai", label: "AI usage" },
  { key: "activity", label: "Activity log" },
  { key: "settings", label: "Settings" },
];

/** Old section URLs → the tab, and the spot on it (#hash), that hold them now. Old links keep working. */
const LEGACY_SECTIONS: Record<string, { tab: StoreTab; hash?: string }> = {
  details: { tab: "settings", hash: "details" },
  profile: { tab: "overview", hash: "profile" },
  "go-live": { tab: "overview", hash: "go-live" },
  usage: { tab: "ai", hash: "usage-history" },
  analytics: { tab: "apps", hash: "analytics" },
  history: { tab: "activity", hash: "history" },
  lifecycle: { tab: "settings", hash: "lifecycle" },
  // The Subscription section merged into Billing (04 S-03 change 2); App.tsx redirects it too.
  subscription: { tab: "billing" },
};

const DEFAULT_TAB: StoreTab = "overview";

function isStoreTab(value: string | undefined): value is StoreTab {
  return STORE_TABS.some((tab) => tab.key === value);
}

/** Settings tab: the store's settings + a 22rem side column of careful actions once the content is 64rem wide. */
const settingsColumnsClass = "grid grid-cols-1 items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_22rem]";

/** Sections a #hash points at sit below the sticky header when scrolled to. */
const anchorClass = "scroll-mt-[calc(var(--zc-sticky-header-h,4.5rem)+1rem)]";

function Section({ id, title, description, children }: { id: string; title?: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className={anchorClass}>
      {title ? (
        <div className="mb-3">
          <h2 className="text-title-3 text-fg">{title}</h2>
          {description ? <p className="text-label text-fg-muted">{description}</p> : null}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
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
    // The menu calls /subscriptions "Billing" (v2 §3.1).
    return { href: from?.startsWith("/subscriptions") ? from : "/subscriptions", label: "Billing" };
  }
  return { href: from?.startsWith("/stores") ? from : "/stores", label: "Stores" };
}

/**
 * The store header is sticky from 768px up: table heads in the tabs stick just under it (01 §7.14, 02 §8). The
 * phone top row sits outside the scrolling main, so nothing else offsets it. On phone the header (title, badges,
 * meta line, tabs) scrolls away instead of covering half the screen; tables are cards there, with no sticky head.
 */
const stickyTopStyle = { "--zc-sticky-top": "var(--zc-sticky-header-h, 4.5rem)" } as CSSProperties;
const phoneStickyTopStyle = { "--zc-sticky-top": "0px" } as CSSProperties;

/** "Kesar & Kin" → "KK" for the neutral title tile (§2.1: no coloured or gradient avatars). */
function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((word) => /\w/.test(word))
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?"
  );
}

const sinceFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Store detail (design v2 §7, boards 60–66; round 2 §6.3): the breadcrumb "Stores / Kesar & Kin", the sticky detail
 * header (a neutral initials tile, the store name with status and plan chips, the meta line legal name · domain ·
 * city · on Zcom since, **Message owner** + **Log in to store** ↗ + ⋯) with the underline tabs under it, the missing-owner notice, then the chosen tab. Each tab keeps its URL
 * (/stores/:id/:tab); the old section URLs redirect to the tab and the spot that holds them.
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
  // The list URL the user came from survives tab switches (the page stays mounted between tabs).
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

  // The Stores row menu's "Edit store details" opens /stores/:id/settings?edit=1 (the old /details?edit=1 lands
  // there too): open the Edit pop-up once, then drop the param so a reload or Back doesn't open it again.
  const wantsEdit = section === "settings" && searchParams.get("edit") === "1";
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

  // A #hash (an old section's link, or the Stores row's "Setup checklist") scrolls to its spot on the tab.
  const hash = location.hash.slice(1);
  useEffect(() => {
    if (!hash) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [hash, section]);

  const listedClient = id ? getClient(id) : undefined;
  // PRD-014 FE-09: a store that isn't in the loaded list (a deep link while
  // later pages load) is read on its own; NOT_FOUND means it doesn't exist.
  const single = useQuery<{ platformTenant: PlatformTenant }>(PLATFORM_TENANT, {
    variables: { id },
    skip: !id || !!listedClient || loading,
  });
  const fetchedTenant = listedClient ? undefined : single.data?.platformTenant;
  // PRD-025: the Profile, History and Billing state cards share this read (city for the meta line)
  // through the cache (one extra query per store, kept off the shared tenant fragment).
  const profileRead = useTenantProfile(id ?? "", { skip: !id });
  const city = profileRead.tenant?.profile?.city;
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
  // Round 2 G14: "Kesar & Kin · Stores · Zcom Super admin".
  useDocumentTitle(client?.storeName);

  if (!id) {
    return <Navigate to="/stores" replace />;
  }

  // Old section URLs (/details, /lifecycle, /usage…) open the tab that holds them, at the right spot.
  const legacy = section ? LEGACY_SECTIONS[section] : undefined;
  if (legacy) {
    return <Navigate to={`/stores/${id}/${legacy.tab}${location.search}${legacy.hash ? `#${legacy.hash}` : location.hash}`} replace />;
  }

  // Deep links land here before `platformTenants` has answered: wait, don't say "not found".
  if (!client && (loading || single.loading)) {
    return (
      // Loading pass (2026-11-10): the loaded header's shape (breadcrumb, tile, name, chips, meta) with the real
      // tabs; each tab's own skeleton follows once the store is known.
      <div className="w-full" style={isPhone ? phoneStickyTopStyle : stickyTopStyle} aria-busy>
        <nav aria-label="Breadcrumb" className="mb-1 flex min-w-0 items-center gap-1.5 text-label text-fg-muted">
          <Link to={back.href} className="shrink-0 rounded-sm outline-none hover:text-fg focus-visible:shadow-focus-strong">
            {back.label}
          </Link>
          <span aria-hidden>/</span>
          <SkelLine text="text-label" className="w-28" />
        </nav>
        <PageHeader
          type="detail"
          leading={<span aria-hidden className="zc-skel block size-[var(--zc-title-tile)] rounded-tile" />}
          title={<SkelLine text="text-title-1" className="w-48" />}
          badges={
            <>
              <SkelChip />
              <SkelChip className="w-12" />
            </>
          }
          description={<SkelLine text="text-label" className="w-72 max-w-full" />}
          sticky={!isPhone}
        >
          <SegmentedSwitch<StoreTab>
            ariaLabel="Store sections"
            value={isStoreTab(section) ? section : DEFAULT_TAB}
            onChange={() => undefined}
            items={STORE_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
            className="max-w-full"
          />
        </PageHeader>
      </div>
    );
  }

  // The list failed to load: say so, don't claim the store doesn't exist.
  if (!client && error) {
    return (
      <div className="w-full">
        <PageHeader type="detail" back={back} title="Store" />
        <ErrorState title="Couldn't load the store." description={toasts.genericError} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="w-full">
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
  const isDeleted = client.tenantStatus === "DELETED";
  const contactGaps = ownerContactGaps(client);
  const isSuspended = !isDeleted && client.status === "suspended";
  // Q10 / PRD-018 FR-2.1: only the platform owner deletes a store.
  const isOwner = user?.role === "PLATFORM_OWNER";

  const base = `/stores/${client.id}`;
  // Opened from Subscriptions: every tab keeps "Back to Subscriptions".
  const query = fromSubscriptions ? "?from=subscriptions" : "";
  const hrefOf = (key: StoreTab, spot?: string) => `${base}/${key}${query}${spot ? `#${spot}` : ""}`;

  if (section && !isStoreTab(section)) return <Navigate to={hrefOf(DEFAULT_TAB)} replace />;
  const active: StoreTab = isStoreTab(section) ? section : DEFAULT_TAB;

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

  const messageOwner = () => {
    window.location.href = `mailto:${client.ownerEmail}`;
  };
  const canMessage = !!client.ownerEmail && contactGaps.isMissingEmail !== true;

  // ── Header actions (§4.1: at most one secondary and one primary, then ⋯) ──
  const openAdmin =
    canImpersonate && !isDeleted ? (
      <UiButton
        variant="primary"
        endIcon={<IconExternalArrow aria-hidden />}
        onPress={() => void logInToStore(client)}
        {...storeLoginIntentProps(client)}
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

  // Billing (board 61): Change plan sits in the Current plan card and the other subscription actions in its
  // Adjust card, so the header keeps the same buttons on every tab.
  const subActions = subscriptionActionsFor(subscription, canManageBilling);
  const openBilling = (dialog: BillingDialog) => () => setBillingDialog(dialog);
  const billingMenu: RowMenuItem[] = [];
  if (canManageBilling) {
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

  // Message owner is the secondary; under 1024px the title row moves it into ⋯ with the store menu (v2 §10).
  const messageButton = canMessage ? (
    <UiButton variant="secondary" startIcon={<IconMessages aria-hidden />} onPress={messageOwner}>
      Message owner
    </UiButton>
  ) : null;

  // Meta line (round 2 §6.3, board 60): legal name · domain ↗ · city · on Zcom since, leaving out missing parts.
  // The legal name is PRD-031's business name (`legalName`, PRD-036 round 2 gaps), shown when it differs from the
  // store name. The owner's name and email are in the Owner card.
  const joined = new Date(client.joinedDate);
  const since = Number.isNaN(joined.getTime()) || joined.getTime() === 0 ? null : sinceFormat.format(joined);
  const metaParts: ReactNode[] = [
    client.legalName && client.legalName.trim().toLowerCase() !== client.storeName.trim().toLowerCase() ? client.legalName : null,
    client.domain ? (
      <a key="domain" href={`https://${client.domain}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
        {client.domain} ↗
      </a>
    ) : null,
    city ?? null,
    since ? `on Zcom since ${since}` : null,
  ].filter(Boolean);
  const metaLine = metaParts.length ? (
    <span className="wrap-anywhere">
      {metaParts.map((part, index) => (
        <span key={index}>
          {index > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </span>
  ) : undefined;

  // Round 2 §6.3: Setup is a collapsible card after Activity ("Setup 4 of 11 · Show steps"); a #setup link opens it.
  // Provisioning (OnboardingCard) shows above it until the store is READY.
  const setupSection = (
    <Section id="setup">
      <OnboardingCard client={client} />
      {/* PRD-031 FR-D3: what the store still needs (a new store lands here after Create store). */}
      <StoreSetupCard tenantId={client.id} collapsible defaultOpen={hash === "setup"} />
    </Section>
  );

  return (
    <div className="w-full" style={isPhone ? phoneStickyTopStyle : stickyTopStyle}>
      {/* Round 2 G12 / §6.3: the text breadcrumb "Stores / Kesar & Kin" above the title, no round back button. */}
      <nav aria-label="Breadcrumb" className="mb-1 flex min-w-0 items-center gap-1.5 text-label text-fg-muted">
        <Link to={back.href} className="shrink-0 rounded-sm outline-none hover:text-fg focus-visible:shadow-focus-strong">
          {back.label}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="truncate">
          {client.storeName}
        </span>
      </nav>
      <PageHeader
        type="detail"
        leading={
          <IconTile tone="neutral" size="lg">
            <span className="text-body font-semibold">{initialsOf(client.storeName)}</span>
          </IconTile>
        }
        title={<span className="wrap-anywhere">{client.storeName}</span>}
        badges={
          // Round 2 §6.3 (board 60): status and plan only. The payment state is in Plan & billing and on Billing;
          // the payment app is in Connected apps and the Billing state card.
          <>
            <Chip tone={status.tone}>{status.label}</Chip>
            <Chip tone="neutral" dot={false}>
              {planShortName(client)}
            </Chip>
          </>
        }
        description={metaLine}
        actions={messageButton ?? undefined}
        primaryAction={openAdmin ?? undefined}
        primaryShortLabel="Log in"
        more={storeMenu.length ? storeMenu : undefined}
        moreLabel={`Actions for ${client.storeName}`}
        sticky={!isPhone}
      >
        {/* The tabs (§7): the app's pill switch (owner 2026-11-11: one tab style); each keeps its URL. */}
        <SegmentedSwitch<StoreTab>
          ariaLabel="Store sections"
          value={active}
          onChange={(key) => navigate(hrefOf(key))}
          items={STORE_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
          className="max-w-full"
        />
      </PageHeader>

      {/* PRD-024 FR-4.4 (D9): migrated stores get their owner contact by hand in Store details. */}
      {contactGaps.isMissingEmail && !isDeleted ? (
        <InlineNotice
          className="mb-4"
          action={
            active === "settings" ? undefined : (
              <ButtonLink to={hrefOf("settings", "details")} variant="ghost" size="sm">
                Add it in Settings
              </ButtonLink>
            )
          }
        >
          This store has no owner email. Billing emails and owner invites need it
          {contactGaps.isMissingPhone ? "; SMS and WhatsApp reminders also need the owner's phone." : "."}
        </InlineNotice>
      ) : null}

      {/* Only the tab content crossfades (01 §8.2). */}
      <div key={active} className="flex min-w-0 animate-rise-in flex-col gap-6">
        {active === "overview" ? (
          <>
            <ClientOverviewTab client={client} subscription={subscription} setup={setupSection} />
            {/* PRD-018 FR-4: domain verification, the go-live checklist and Mark live (the old Go live section). */}
            {isDeleted ? null : (
              <Section id="go-live" title="Go live" description="Verify the store's domain and check everything it needs before going live.">
                <StoreGoLiveCard client={client} />
              </Section>
            )}
            {/* PRD-025 FR-6.1: category, source, location, account manager, tags, planned go-live. */}
            <Section id="profile">
              <StoreProfileCard client={client} />
            </Section>
          </>
        ) : null}

        {active === "billing" ? (
          <StoreBillingSection
            client={client}
            subscription={subscription}
            defaultGracePeriodDays={defaultGracePeriodDays}
            onSaveGracePeriod={onSaveGracePeriod}
            onCreateCustomPlan={openBilling("customPlan")}
            onChangePlan={canManageBilling && subActions.plan ? openBilling("plan") : undefined}
            actions={billingMenu}
            lifecycleHref={hrefOf("settings", "lifecycle")}
          />
        ) : null}

        {active === "team" ? <StoreTeamTab client={client} /> : null}

        {active === "apps" ? <StoreAppsTab client={client} /> : null}

        {active === "ai" ? (
          <>
            {/* PRD-021 FR-6.4: status, pause, the per-store limit, use this month and the most-asked questions. */}
            {canReadAi ? (
              <ClientAiCard client={client} />
            ) : (
              <Card>
                <EmptyState icon={IconStore} title="Your role can't see AI usage" description="Ask a platform owner for AI access." />
              </Card>
            )}
            {/* PRD-014 PLT-13: the monthly usage snapshots (the old Usage history section). */}
            <Section id="usage-history" title="Usage history" description="The monthly usage snapshots: the last daily snapshot of each month.">
              <ClientUsageHistory tenantId={client.id} />
            </Section>
          </>
        ) : null}

        {active === "activity" ? (
          <>
            {/* PRD-024 FR-1.12: every change made to this store from the console, newest first. */}
            <ClientActivityCard tenantId={client.id} />
            {/* PRD-025 FR-6.2: the lifecycle history (created, live, suspended…), newest first. */}
            <Section id="history">
              <StoreHistoryCard tenantId={client.id} />
            </Section>
          </>
        ) : null}

        {active === "settings" ? (
          // Board 66: the store's settings on the left, the careful actions on the right.
          <div className="@container">
            <div className={canManage ? settingsColumnsClass : undefined}>
              {/* PRD-017 FR-4.5: name, owner, contacts, GSTIN, time zone and currency; the domain changes in Go live. */}
              <Section id="details">
                <StoreDetailsCard client={client} goLiveHref={hrefOf("overview", "go-live")} />
              </Section>
              {/* PRD-018 FR-1, FR-2: suspend (pause), reactivate, delete or restore, after checking money in flight. */}
              {canManage ? (
                <Section id="lifecycle">
                  <StoreLifecycleCard client={client} onDeleted={() => navigate("/stores")} />
                </Section>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Round 2 §6.3: the other tabs' reads start after the first paint, so a tab opens with its data. */}
      <StoreTabsPrefetch client={client} />

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

      {/* Billing pop-ups, opened from the header menu and the Plan and subscription card. */}
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
