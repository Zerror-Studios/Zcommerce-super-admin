import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { coupons as initialCoupons } from "../lib/mockData";
import type { Coupon } from "../types";
import { IconAdd } from "../components/ui/icons";
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

export function Settings() {
  const { section } = useParams<{ section: string }>();
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [createOpen, setCreateOpen] = useState(false);

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
    </div>
  );
}
