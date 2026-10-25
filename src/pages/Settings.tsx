import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { LoadMoreFooter } from "../components/common/LoadMoreFooter";
import { BillingRulesSettings } from "../components/settings/BillingRulesSettings";
import { TeamSettings } from "../components/settings/TeamSettings";
import { AuditLogSettings } from "../components/settings/AuditLogSettings";
import { PageHeader } from "../components/common/PageHeader";
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
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { ErrorState, Skeleton, toastError } from "../components/ui";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { toasts } from "../copy";
import type { Coupon } from "../types";
import { IconAdd, IconBilling, IconExpand, IconKeyboard, IconLock, IconLogout, IconPercent, IconUser } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";

/** Settings › Discounts. Payment reminders moved to Subscriptions (/settings/automation redirects there). */
const sections = {
  discounts: {
    title: "Discounts",
    description: undefined,
  },
  "billing-rules": {
    title: "Billing rules",
    description: "Grace period, health thresholds and the renewal reminder schedule.",
  },
  team: {
    title: "Team",
    description: "Zerror staff who can sign in to this console, and what they can do.",
  },
  audit: {
    title: "Audit log",
    description: "Every change made from this console, newest first.",
  },
} as const;

type SettingsSection = keyof typeof sections;

interface SettingsRow {
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** A page to open; rows without one run `action`. */
  link?: string;
  action?: "shortcuts" | "logout-all";
}

// Grouped list, same pattern as Merchant Admin Settings.
const settingsGroups: { title: string; items: SettingsRow[] }[] = [
  {
    title: "Subscriptions",
    items: [
      { title: "Discounts", desc: "Discount codes stores can apply to their plan.", icon: IconPercent, link: "/settings/discounts" },
      { title: "Billing rules", desc: "Grace period, health thresholds and reminder schedule.", icon: IconBilling, link: "/settings/billing-rules" },
    ],
  },
  {
    title: "Account",
    items: [
      { title: "Team", desc: "Invite Zerror staff, change roles, reset two-step verification.", icon: IconUser, link: "/settings/team" },
      { title: "Audit log", desc: "Who changed what, and when.", icon: IconLock, link: "/settings/audit" },
      { title: "Keyboard shortcuts", desc: "Keys for search, the sidebar and other quick actions.", icon: IconKeyboard, action: "shortcuts" },
      // PRD-014 PLT-13: platformLogoutAll (a lost laptop, a shared browser).
      { title: "Sign out everywhere", desc: "End your sessions on every device, this one included.", icon: IconLogout, action: "logout-all" },
    ],
  },
];

// Each setting is its own card, three per row on wide screens (two on tablets, one on phones).
const rowClasses =
  "flex h-full w-full items-start gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors duration-instant hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none";

function SettingsIndex() {
  const { signOutEverywhere } = useAuth();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  const onRowAction = (action: SettingsRow["action"]) => {
    if (action === "logout-all") setLogoutAllOpen(true);
    else setShortcutsOpen(true);
  };

  const confirmLogoutAll = () => {
    signOutEverywhere().catch((error) => {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    });
  };

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="space-y-6">
        {settingsGroups.map((group) => (
          <section key={group.title} aria-labelledby={`settings-${group.title}`}>
            <h2 id={`settings-${group.title}`} className="mb-2 text-label font-semibold text-fg-muted">
              {group.title}
            </h2>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map(({ title, desc, icon: Icon, link, action }) => {
                  const content: ReactNode = (
                    <>
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium text-fg">{title}</p>
                        <p className="mt-0.5 text-label text-fg-muted">{desc}</p>
                      </div>
                      <IconExpand aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                    </>
                  );
                  return (
                    <li key={title}>
                      {link ? (
                        <Link to={link} className={rowClasses}>
                          {content}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => onRowAction(action)} className={rowClasses}>
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

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

export function Settings() {
  const { section } = useParams<{ section: string }>();
  const { can } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  // PRD-005 FR-7.2: platform discounts live on the server
  const apiCoupons = useCoupons();
  const [createCoupon] = useMutation(CREATE_PLATFORM_COUPON);
  const [updateCoupon] = useMutation(UPDATE_PLATFORM_COUPON);
  const [deactivateCoupon] = useMutation(DEACTIVATE_PLATFORM_COUPON);
  const coupons = apiCoupons.data;
  const canManageCoupons = can(PLATFORM_PERMISSIONS.COUPONS_MANAGE);
  const canManageUsers = can(PLATFORM_PERMISSIONS.USERS_MANAGE);
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

  const active = useMemo(() => {
    if (!section || !(section in sections)) return null;
    return section as SettingsSection;
  }, [section]);

  if (!section) return <SettingsIndex />;
  // Unknown sections (including the old /settings/account) go back to the list.
  if (!active) return <Navigate to="/settings" replace />;

  const meta = sections[active];

  return (
    <div>
      <PageHeader
        back={{ href: "/settings", label: "Settings" }}
        title={meta.title}
        count={active === "discounts" ? apiCoupons.totalCount : undefined}
        description={meta.description}
        actions={
          active === "discounts" && canManageCoupons ? (
            <UiButton
              variant="primary"
              startIcon={<IconAdd aria-hidden />}
              onPress={() => setCreateOpen(true)}
            >
              Create discount
            </UiButton>
          ) : active === "team" && canManageUsers ? (
            <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
              Invite member
            </UiButton>
          ) : undefined
        }
      />

      {/* Discounts: loading and error states before the table (review C-M1). */}
      {active === "discounts" && apiCoupons.error ? (
        <ErrorState
          title="Couldn't load the discounts."
          description={toasts.genericError}
          onRetry={() => void apiCoupons.refetch()}
        />
      ) : active === "discounts" && apiCoupons.loading ? (
        <div className="space-y-3 p-4" role="status" aria-label="Loading discounts">
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

      {active === "billing-rules" ? <BillingRulesSettings /> : null}

      {active === "team" ? <TeamSettings createOpen={createOpen} onCreateOpenChange={setCreateOpen} /> : null}
      {active === "audit" ? <AuditLogSettings /> : null}

    </div>
  );
}
