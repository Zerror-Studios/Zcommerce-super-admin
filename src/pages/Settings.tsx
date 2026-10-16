import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { ShortcutsDialog } from "../components/layout/AppShell";
import { coupons as initialCoupons } from "../lib/mockData";
import type { Coupon } from "../types";
import { IconAdd, IconExpand, IconKeyboard, IconPercent, IconTime } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";

/** Settings › Discounts and Settings › Payment reminders (route "automation", unchanged). */
const sections = {
  discounts: {
    title: "Discounts",
    description: undefined,
  },
  automation: {
    title: "Payment reminders",
    description: "Remind stores before their plan renews or when a payment is overdue.",
  },
} as const;

type SettingsSection = keyof typeof sections;

interface SettingsRow {
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** A page to open; rows without one open the keyboard shortcuts dialog. */
  link?: string;
}

// Grouped list, same pattern as Merchant Admin Settings.
const settingsGroups: { title: string; items: SettingsRow[] }[] = [
  {
    title: "Billing",
    items: [
      { title: "Discounts", desc: "Discount codes stores can apply to their plan.", icon: IconPercent, link: "/settings/discounts" },
      { title: "Payment reminders", desc: sections.automation.description, icon: IconTime, link: "/settings/automation" },
    ],
  },
  {
    title: "Account",
    items: [{ title: "Keyboard shortcuts", desc: "Keys for search, the sidebar and other quick actions.", icon: IconKeyboard }],
  },
];

// Each setting is its own card, three per row on wide screens (two on tablets, one on phones).
const rowClasses =
  "flex h-full w-full items-start gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors duration-instant hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none";

function SettingsIndex() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
                {group.items.map(({ title, desc, icon: Icon, link }) => {
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
                        <button type="button" onClick={() => setShortcutsOpen(true)} className={rowClasses}>
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
    </div>
  );
}

export function Settings() {
  const { section } = useParams<{ section: string }>();
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [createOpen, setCreateOpen] = useState(false);

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
    </div>
  );
}
