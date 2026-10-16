import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { SubscriptionReportsTab } from "../components/billing/SubscriptionReportsTab";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { TransactionsTab } from "../components/payments/TransactionsTab";
import { transactions } from "../lib/mockData";

/** Subscriptions › Collections (route "subscriptions", unchanged), Transactions and Payment reminders. */
const sections = ["subscriptions", "transactions", "reminders"] as const;

type BillingSection = (typeof sections)[number];

export function Billing() {
  const { section } = useParams<{ section: string }>();

  const active = useMemo(() => {
    if (!section || !(sections as readonly string[]).includes(section)) return null;
    return section as BillingSection;
  }, [section]);

  if (!active) {
    return <Navigate to="/billing/subscriptions" replace />;
  }

  // Collections renders its own header: its date control and export share state with the report.
  if (active === "subscriptions") return <SubscriptionReportsTab />;

  if (active === "reminders") {
    return (
      <div>
        <PageHeader title="Payment reminders" description="Remind stores before their plan renews or when a payment is overdue." />
        <AutomationSettingsTab />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        count={transactions.length}
        description="Payments across Stripe and Razorpay"
      />
      <TransactionsTab transactions={transactions} />
    </div>
  );
}
