import { useMemo, useState, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { BillingRulesSettings, type BillingRulesCard } from "../components/settings/BillingRulesSettings";
import { TeamSettings } from "../components/settings/TeamSettings";
import { AuditLogSettings } from "../components/settings/AuditLogSettings";
import { PageHeader } from "../components/common/PageHeader";
import { ShortcutsList } from "../components/layout/AppShell";
import { useMutation } from "@apollo/client";
import { CREATE_PLATFORM_COUPON } from "../graphql/billing";
import { toCouponInput } from "../lib/api-report-adapters";
import { useCoupons } from "../hooks/use-platform-reports";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
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
  type PaneGroup,
} from "../components/ui";
import { toasts } from "../copy";
import type { Coupon } from "../types";
import {
  IconAdd,
  IconBilling,
  IconKeyboard,
  IconLock,
  IconPayments,
  IconPercent,
  IconSettings,
  IconStoreHealth,
  IconUser,
} from "../components/ui/icons";

// ─── Sections ────────────────────────────────────────────────────────────────

/**
 * Settings as one two-pane card (docs/design/09-settings-and-scale.md §1, §1.7). Each section keeps its URL
 * (/settings/:section). The old Billing rules page is split into Payment gateway, Grace period and reminders, and Health thresholds
 * by moving its cards; /settings/billing-rules is Grace period and reminders. Payment reminders moved to Subscriptions
 * (/settings/automation redirects there, see App.tsx).
 */
type SettingsSection = "payment-gateway" | "billing-rules" | "health" | "discounts" | "team" | "audit" | "shortcuts";

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
    description: "Extra days before a store is suspended, and when renewal reminders go out.",
    icon: IconBilling,
    cards: ["grace", "reminders"],
  },
  health: {
    title: "Health thresholds",
    description: "When Collections flags a store as at risk.",
    icon: IconStoreHealth,
    cards: ["health"],
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
  shortcuts: {
    title: "Keyboard shortcuts",
    description: "Keys for search, the sidebar and other quick actions.",
    icon: IconKeyboard,
  },
};

const DEFAULT_SECTION: SettingsSection = "payment-gateway";

/** Left pane groups (§1.7: Billing · Team · System). */
const groupOrder: { label: string; keys: SettingsSection[] }[] = [
  { label: "Billing", keys: ["payment-gateway", "billing-rules", "health", "discounts"] },
  { label: "Team", keys: ["team"] },
  { label: "System", keys: ["audit", "shortcuts"] },
];

function isSection(value: string | undefined): value is SettingsSection {
  return value != null && value in sections;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Settings() {
  const { section } = useParams<{ section: string }>();
  const { can } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  // PRD-005 FR-7.2: platform discounts live on the server (read only on Discounts).
  const apiCoupons = useCoupons({ skip: section !== "discounts" });
  const [createCoupon] = useMutation(CREATE_PLATFORM_COUPON);
  const coupons = apiCoupons.data;
  const canManageCoupons = can(PLATFORM_PERMISSIONS.COUPONS_MANAGE);
  const canManageUsers = can(PLATFORM_PERMISSIONS.USERS_MANAGE);
  // Resolves true once the server has the code, so the dialog only says "created" then.
  const onCreate = async (coupon: Coupon): Promise<boolean> => {
    try {
      await createCoupon({ variables: { input: toCouponInput(coupon) } });
      await apiCoupons.refetch();
      return true;
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
      return false;
    }
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
          const text = `${sections[key].title} ${sections[key].description}${key === "shortcuts" ? " hotkeys" : ""}`;
          return text.toLowerCase().includes(term);
        })
        .map((key) => {
          const Icon = sections[key].icon;
          return {
            key,
            label: sections[key].title,
            icon: <Icon aria-hidden />,
            href: `/settings/${key}`,
            meta: key === "discounts" && coupons.length > 0 ? formatCount(coupons.length) : undefined,
          };
        }),
    }));
  }, [coupons.length, query]);

  // Unknown sections (including the old /settings/account) go back to the list.
  if (section && !isSection(section)) return <Navigate to="/settings" replace />;

  const meta = sections[active];

  const primary =
    active === "discounts" && canManageCoupons ? (
      <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
        Create discount
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
        section="blue"
        title="Settings"
        description="Billing rules, the team and the audit trail for the Zcom platform"
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
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
            canCreate={canManageCoupons}
          />
        ) : null}

        {active === "team" ? <TeamSettings createOpen={createOpen} onCreateOpenChange={setCreateOpen} /> : null}
        {active === "audit" ? <AuditLogSettings /> : null}
        {active === "shortcuts" ? <ShortcutsList /> : null}
      </TwoPaneCard>
    </div>
  );
}
