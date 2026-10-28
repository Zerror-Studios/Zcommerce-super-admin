import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { InvoicesTab } from "../components/billing/InvoicesTab";
import { SubscriptionReportsTab } from "../components/billing/SubscriptionReportsTab";
import { ReminderLogCard } from "../components/billing/ReminderLogCard";
import { FlaggedPaymentsTab } from "../components/payments/FlaggedPaymentsTab";
import { StalePendingPayments } from "../components/payments/StalePendingPayments";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { TransactionsTab } from "../components/payments/TransactionsTab";
import { Card, ErrorState, formatCount, useTableUrlState } from "../components/ui";
import { IconFlag, IconPayments, IconSend, IconTime } from "../components/ui/icons";
import { toasts } from "../copy";
import { usePayments } from "../hooks/use-platform-reports";
import { splitParam } from "../lib/store-table.util";

/**
 * Subscriptions › Collections (route "subscriptions", unchanged), Invoices (PRD-017 FR-4.3), Transactions,
 * Flagged payments (PRD-016 FR-19), Stuck store payments (PRD-018 FR-1.8) and Payment reminders.
 */
const sections = ["subscriptions", "invoices", "transactions", "flagged", "stuck", "reminders"] as const;

type BillingSection = (typeof sections)[number];

export function Billing() {
  const { section } = useParams<{ section: string }>();
  // PRD-005 FR-5.2: platform payments (payment_log), read only on Transactions.
  // PRD-024 FR-1.6 (B-01): search and status from the URL are applied by the server.
  const table = useTableUrlState();
  const statusFilter = useMemo(() => splitParam(table.filters.status), [table.filters.status]);
  const payments = usePayments({
    skip: section !== "transactions",
    search: table.search,
    statuses: statusFilter,
  });

  // The live line under the title (header A): the server's counts per status (PRD-024 FR-3.5),
  // over every payment matching the search, whatever status filter is applied.
  const statusCounts = payments.statusCounts;

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
        <PageHeader
          type="list"
          icon={<IconSend aria-hidden />}
          section="green"
          title="Payment reminders"
          description="Remind stores before their plan renews or when a payment is overdue."
        />
        <AutomationSettingsTab />
        {/* PRD-024 FR-3.9: what the reminders actually did. */}
        <div className="mt-4">
          <ReminderLogCard />
        </div>
      </div>
    );
  }

  // Invoices renders its own header: the due-date picker shares state with the table (like Collections).
  if (active === "invoices") return <InvoicesTab />;

  if (active === "flagged") {
    return (
      <div>
        <PageHeader
          type="list"
          icon={<IconFlag aria-hidden />}
          section="green"
          title="Flagged payments"
          description="Payments that couldn't settle an invoice on their own. Apply, mark refunded or dismiss each one, with a note."
        />
        <FlaggedPaymentsTab />
      </div>
    );
  }

  if (active === "stuck") {
    return (
      <div>
        <PageHeader
          type="list"
          icon={<IconTime aria-hidden />}
          section="green"
          title="Stuck store payments"
          description="Shopper payments in suspended stores still pending 48 hours after they were opened. The enquiry job keeps checking them; follow up with the provider if one stays here."
        />
        <Card padding="none" className="overflow-hidden">
          <StalePendingPayments />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconPayments aria-hidden />}
        section="green"
        title="Transactions"
        count={payments.loading ? undefined : payments.totalCount}
        description={
          payments.loading
            ? "What stores paid Zcom for their plans"
            : `${formatCount(statusCounts.success)} paid · ${formatCount(statusCounts.pending)} due · ${formatCount(statusCounts.failed)} failed · ${formatCount(statusCounts.refunded)} refunded`
        }
      />
      {payments.error ? (
        <ErrorState title="Couldn't load transactions." description={toasts.genericError} onRetry={() => void payments.refetch()} />
      ) : (
        <TransactionsTab
          transactions={payments.data}
          isLoading={payments.loading}
          paging={{
            total: payments.totalCount,
            hasMore: payments.hasMore,
            loading: payments.loadingMore,
            onLoadMore: payments.loadMore,
          }}
        />
      )}
    </div>
  );
}
