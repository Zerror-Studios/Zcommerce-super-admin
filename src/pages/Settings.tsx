import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CouponsTab } from "../components/billing/CouponsTab";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { coupons as initialCoupons } from "../lib/mockData";
import type { Coupon } from "../types";
import { IconAdd } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";

const sections = {
  discounts: {
    title: "Discounts",
    description: "Create and review discount codes for client subscriptions.",
  },
  automation: {
    title: "Automation",
    description:
      "Select stores nearing renewal and send expiry reminder emails.",
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
        description={meta.description}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Settings", href: "/settings/discounts" },
          { label: meta.title },
        ]}
        actions={
          active === "discounts" ? (
            <UiButton
              variant="primary"
              size="sm"
              startIcon={<IconAdd size={14} strokeWidth={2.5} />}
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
