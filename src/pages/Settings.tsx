import { useMemo, useState, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { LoadMoreFooter } from "../components/common/LoadMoreFooter";
import { BillingRulesSettings, type BillingRulesCard } from "../components/settings/BillingRulesSettings";
import { PlansSettings } from "../components/settings/PlansSettings";
import { TeamSettings } from "../components/settings/TeamSettings";
import { AuditLogSettings } from "../components/settings/AuditLogSettings";
import { PageHeader } from "../components/common/PageHeader";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { ShortcutsDialog } from "../components/layout/AppShell";
import { useMutation } from "@apollo/client";
import {
  CREATE_PLATFORM_COUPON,
  DEACTIVATE_PLATFORM_COUPON,
  UPDATE_PLATFORM_COUPON,
} from "../graphql/billing";
import { toCouponInput, toCouponUpdateInput } from "../lib/api-report-adapters";
import type { CouponWrite } from "../lib/coupon-form.util";
import { useCoupons } from "../hooks/use-platform-reports";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { splitParam } from "../lib/store-table.util";
import { useAuth } from "../providers/AuthProvider";
import {
  Button as UiButton,
  ErrorState,
  PaneHeader,
  PaneList,
  SearchInput,
  Skeleton,
  TwoPaneCard,
  formatCount,
  toastError,
  useTableUrlState,
  type PaneGroup,
} from "../components/ui";
import { toasts } from "../copy";
import type { Coupon } from "../types";
import {
  IconAdd,
  IconBilling,
  IconKeyboard,
  IconLock,
  IconLogout,
  IconPayments,
  IconPercent,
  IconPlans,
  IconSettings,
  IconStoreHealth,
  IconUser,
} from "../components/ui/icons";

// ─── Sections ────────────────────────────────────────────────────────────────

/**
 * Settings as one two-pane card (docs/design/09-settings-and-scale.md §1, §1.7). Each section keeps its URL
 * (/settings/:section). The old Billing rules page is split into Payment gateway, Grace period and reminders, and Health thresholds
 * by moving its cards; /settings/billing-rules is Grace period and reminders, plus the plan-limit mode, overdue payments and
 * the jobs (PRD-016). Payment reminders moved to Subscriptions (/settings/automation redirects there, see App.tsx).
 */
type SettingsSection = "payment-gateway" | "billing-rules" | "health" | "plans" | "discounts" | "team" | "audit";

/** Pane rows that open a dialog instead of a section. */
type SettingsAction = "shortcuts" | "logout-all";

interface SectionMeta {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** The billing-rules cards this section shows. */
  cards?: BillingRulesCard[];
}

const sections: Record<SettingsSection, SectionMeta> = {
  "payment-gateway": {
    title: "Payment gateway",
    description: "How stores pay Zcom for their plans.",
    icon: IconPayments,
    cards: ["provider"],
  },
  "billing-rules": {
    title: "Grace period and reminders",
    description: "Extra days before a store is suspended, when renewal reminders go out, plan limits and overdue payments.",
    icon: IconBilling,
    cards: ["grace", "reminders", "entitlements", "dunning", "jobs"],
  },
  health: {
    title: "Health thresholds",
    description: "When Collections flags a store as at risk.",
    icon: IconStoreHealth,
    cards: ["health"],
  },
  // PRD-017 FR-4.1
  plans: {
    title: "Plans",
    description: "What stores can buy: every version of every plan, and the stores on it.",
    icon: IconPlans,
  },
  discounts: {
    title: "Discounts",
    description: "Discount codes stores can apply to their plan.",
    icon: IconPercent,
  },
  team: {
    title: "Admins",
    description: "Zerror staff who can sign in to this console, and what they can do.",
    icon: IconUser,
  },
  audit: {
    title: "Audit log",
    description: "Every change made from this console, newest first.",
    icon: IconLock,
  },
};

const actions: Record<SettingsAction, { label: string; keywords: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }> = {
  shortcuts: { label: "Keyboard shortcuts", keywords: "keyboard shortcuts keys", icon: IconKeyboard },
  // PRD-014 PLT-13: platformLogoutAll (a lost laptop, a shared browser).
  "logout-all": { label: "Sign out everywhere", keywords: "sign out everywhere sessions devices logout", icon: IconLogout },
};

const DEFAULT_SECTION: SettingsSection = "payment-gateway";

/** Left pane groups (§1.7: Billing · Team · System). Keyboard shortcuts and Sign out everywhere open dialogs. */
const groupOrder: { label: string; keys: (SettingsSection | SettingsAction)[] }[] = [
  { label: "Billing", keys: ["payment-gateway", "billing-rules", "health", "plans", "discounts"] },
  { label: "Team", keys: ["team"] },
  { label: "System", keys: ["audit", "shortcuts", "logout-all"] },
];

function isSection(value: string | undefined): value is SettingsSection {
  return value != null && value in sections;
}

function isAction(value: string): value is SettingsAction {
  return value in actions;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Settings() {
  const { section } = useParams<{ section: string }>();
  const { can, signOutEverywhere } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [query, setQuery] = useState("");
  // PRD-005 FR-7.2: platform discounts live on the server (read only on Discounts).
  // PRD-024 FR-3.5 (B-07): the Discounts table's search and status (in the URL) filter on the server.
  const couponTable = useTableUrlState();
  const couponStatuses = useMemo(() => splitParam(couponTable.filters.status), [couponTable.filters.status]);
  const couponsFiltered = couponTable.search.trim() !== "" || couponStatuses.length > 0;
  const apiCoupons = useCoupons({
    skip: section !== "discounts",
    search: couponTable.search,
    statuses: couponStatuses,
  });
  const [createCoupon] = useMutation(CREATE_PLATFORM_COUPON);
  const [updateCoupon] = useMutation(UPDATE_PLATFORM_COUPON);
  const [deactivateCoupon] = useMutation(DEACTIVATE_PLATFORM_COUPON);
  const coupons = apiCoupons.data;
  const couponCount = apiCoupons.totalCount;
  const canManageCoupons = can(PLATFORM_PERMISSIONS.COUPONS_MANAGE);
  const canManageUsers = can(PLATFORM_PERMISSIONS.USERS_MANAGE);
  const canManagePlans = can(PLATFORM_PERMISSIONS.PLANS_MANAGE);
  // PRD-014 UX-24: resolve only after the server answers, so the form can
  // stay open with the error (a duplicate code is a CONFLICT on `code`).
  const onCreate = async (coupon: CouponWrite) => {
    await createCoupon({
      variables: { input: toCouponInput({ ...coupon, id: "", redemptions: 0 }) },
    });
    // The code exists now; a failed list refresh must not look like a failed create.
    await apiCoupons.refetch().catch(() => undefined);
  };
  // Update and deactivate return the coupon, which Apollo normalises by id.
  const onUpdate = async (id: string, patch: Partial<Coupon>) => {
    await updateCoupon({ variables: { id, input: toCouponUpdateInput(patch) } });
  };
  const onDeactivate = async (id: string) => {
    await deactivateCoupon({ variables: { id } });
  };

  const confirmLogoutAll = () => {
    signOutEverywhere().catch((error) => {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    });
  };

  const active: SettingsSection = isSection(section) ? section : DEFAULT_SECTION;

  // Search settings filters the section list (§1.6; there is no field-level index yet).
  const groups = useMemo<PaneGroup[]>(() => {
    const term = query.trim().toLowerCase();
    return groupOrder.map((group) => ({
      label: group.label,
      items: group.keys
        .filter((key) => {
          if (!term || group.label.toLowerCase().includes(term)) return true;
          const text = isAction(key) ? actions[key].keywords : `${sections[key].title} ${sections[key].description}`;
          return text.toLowerCase().includes(term);
        })
        .map((key) => {
          if (isAction(key)) {
            const Icon = actions[key].icon;
            return { key, label: actions[key].label, icon: <Icon aria-hidden /> };
          }
          const Icon = sections[key].icon;
          return {
            key,
            label: sections[key].title,
            icon: <Icon aria-hidden />,
            href: `/settings/${key}`,
            // A filtered count would read as the total: show it only unfiltered.
            meta: key === "discounts" && couponCount > 0 && !couponsFiltered ? formatCount(couponCount) : undefined,
          };
        }),
    }));
  }, [couponCount, couponsFiltered, query]);

  // Unknown sections (including the old /settings/account) go back to the list.
  if (section && !isSection(section)) return <Navigate to="/settings" replace />;

  const meta = sections[active];

  const primary =
    active === "discounts" && canManageCoupons ? (
      <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
        Create discount
      </UiButton>
    ) : active === "plans" && canManagePlans ? (
      <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
        Create plan
      </UiButton>
    ) : active === "team" && canManageUsers ? (
      <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
        Invite member
      </UiButton>
    ) : undefined;

  return (
    <div>
      <PageHeader
        type="page"
        icon={<IconSettings aria-hidden />}
        section="slate"
        title="Settings"
        description="Billing rules, plans, the team and the audit trail for the Zcom platform"
        actions={
          <SearchInput
            placement="header"
            placeholder="Search settings"
            value={query}
            onValueChange={setQuery}
            onClear={() => setQuery("")}
          />
        }
      />

      <TwoPaneCard
        showDetail={section != null}
        back={{ href: "/settings", label: "Settings" }}
        list={
          <PaneList
            aria-label="Settings sections"
            groups={groups}
            activeKey={active}
            onSelect={(key) => {
              if (key === "shortcuts") setShortcutsOpen(true);
              else if (key === "logout-all") setLogoutAllOpen(true);
            }}
            emptyContent={`No settings match "${query.trim()}".`}
          />
        }
      >
        <PaneHeader title={meta.title} description={meta.description} actions={primary} />

        {meta.cards ? <BillingRulesSettings key={active} cards={meta.cards} /> : null}

        {/* Discounts: loading and error states before the table (review C-M1). */}
        {active === "discounts" && apiCoupons.error ? (
          <ErrorState
            title="Couldn't load the discounts."
            description={toasts.genericError}
            onRetry={() => void apiCoupons.refetch()}
          />
        ) : active === "discounts" && apiCoupons.loading ? (
          <div className="space-y-3" role="status" aria-label="Loading discounts">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : active === "discounts" ? (
          <CouponsTab
            coupons={coupons}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDeactivate={onDeactivate}
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
            canCreate={canManageCoupons}
            footer={
              <LoadMoreFooter
                shown={coupons.length}
                total={apiCoupons.totalCount}
                hasMore={apiCoupons.hasMore}
                loading={apiCoupons.loadingMore}
                onLoadMore={apiCoupons.loadMore}
                noun="discounts"
              />
            }
          />
        ) : null}

        {active === "plans" ? <PlansSettings createOpen={createOpen} onCreateOpenChange={setCreateOpen} /> : null}
        {active === "team" ? <TeamSettings createOpen={createOpen} onCreateOpenChange={setCreateOpen} /> : null}
        {active === "audit" ? <AuditLogSettings /> : null}
      </TwoPaneCard>

      <ShortcutsDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ConfirmModal
        isOpen={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        onConfirm={confirmLogoutAll}
        title="Sign out everywhere?"
        description="Every session you have on any device ends now, including this one. You sign in again here."
        confirmLabel="Sign out everywhere"
        confirmColor="danger"
      />
    </div>
  );
}
