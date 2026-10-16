import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { coupons as initialCoupons } from "../lib/mockData";
import type { Coupon } from "../types";
import { IconAdd, IconExpand, IconKeyboard } from "../components/ui/icons";
import { Button as UiButton, Card } from "../components/ui";
import { ShortcutsDialog } from "../components/layout/AppShell";

/** Settings › Discounts, Payment reminders (route "automation", unchanged) and Account. */
const sections = {
  discounts: {
    title: "Discounts",
    description: undefined,
  },
  automation: {
    title: "Payment reminders",
    description: "Remind stores before their plan renews or when a payment is overdue.",
  },
  account: {
    title: "Account",
    description: undefined,
  },
} as const;

type SettingsSection = keyof typeof sections;

export function Settings() {
  const { section } = useParams<{ section: string }>();
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [createOpen, setCreateOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const active = useMemo(() => {
    if (!section || !(section in sections)) return null;
    return section as SettingsSection;
  }, [section]);

  if (!active) {
    return <Navigate to="/settings/discounts" replace />;
  }

  const meta = sections[active];

  return (
    <div>
      <PageHeader
        title={meta.title}
        count={active === "discounts" ? coupons.length : undefined}
        description={meta.description}
        actions={
          active === "discounts" ? (
            <UiButton
              variant="primary"
              startIcon={<IconAdd aria-hidden />}
              onPress={() => setCreateOpen(true)}
            >
              Create discount
            </UiButton>
          ) : undefined
        }
      />

      {active === "discounts" ? (
        <CouponsTab
          coupons={coupons}
          onCreate={(coupon) => setCoupons((prev) => [coupon, ...prev])}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
        />
      ) : null}

      {active === "automation" ? <AutomationSettingsTab /> : null}

      {active === "account" ? (
        <div className="max-w-content-form">
          <Card padding="none" className="overflow-hidden">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-instant hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
            >
              <IconKeyboard aria-hidden className="size-4 shrink-0 text-fg-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-fg">Keyboard shortcuts</p>
                <p className="truncate text-label text-fg-muted">Keys for search, the sidebar and other quick actions.</p>
              </div>
              <IconExpand aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            </button>
          </Card>
          <ShortcutsDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
