import { useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { InvoicesTab } from "../components/billing/InvoicesTab";
import { SubscriptionReportsTab } from "../components/billing/SubscriptionReportsTab";
import { ReminderLogCard } from "../components/billing/ReminderLogCard";
import { FlaggedPaymentsTab } from "../components/payments/FlaggedPaymentsTab";
import { StalePendingPayments } from "../components/payments/StalePendingPayments";
import { PageHeader } from "../components/common/PageHeader";
import { AutomationSettingsTab } from "../components/settings/AutomationSettingsTab";
import { TransactionsTab } from "../components/payments/TransactionsTab";
import { Card, ErrorState, Tab, Tabs, formatCount, useTableUrlState } from "../components/ui";
import { IconPayments, IconSend } from "../components/ui/icons";
import { toasts } from "../copy";
import { usePayments } from "../hooks/use-platform-reports";
import { splitParam } from "../lib/store-table.util";

/**
 * Subscriptions › Collections (route "subscriptions", unchanged), Invoices (PRD-017 FR-4.3), Transactions and
 * Payment reminders. Transactions has three tabs (owner 2026-10-29: one place for payments): All payments,
 * Flagged (PRD-016 FR-19) and Stuck in suspended stores (PRD-018 FR-1.8), as ?view=flagged / ?view=stuck.
 * The old /billing/flagged and /billing/stuck URLs open those tabs.
 */
const sections = ["subscriptions", "invoices", "transactions", "reminders"] as const;
const OLD_TRANSACTION_TABS: Record<string, TransactionView> = { flagged: "flagged", stuck: "stuck" };

type TransactionView = "all" | "flagged" | "stuck";

const TRANSACTION_VIEWS: Record<TransactionView, { label: string; description?: string }> = {
  all: { label: "All payments" },
  flagged: {
    label: "Flagged",
    description:
      "Payments that couldn't settle an invoice on their own. Apply, mark refunded or dismiss each one, with a note.",
  },
  stuck: {
    label: "Stuck in suspended stores",
    description:
      "Shopper payments in suspended stores still pending 48 hours after they were opened. The enquiry job keeps checking them; follow up with the provider if one stays here.",
  },
};

type BillingSection = (typeof sections)[number];

/** `section` is set by routes outside /billing (Payment reminders lives at /reminders). */
export function Billing({ section: sectionProp }: { section?: string } = {}) {
  const params = useParams<{ section: string }>();
  const section = sectionProp ?? params.section;
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: TransactionView = viewParam === "flagged" || viewParam === "stuck" ? viewParam : "all";
  // PRD-005 FR-5.2: platform payments (payment_log), read only on Transactions.
  // PRD-024 FR-1.6 (B-01): search and status from the URL are applied by the server.
  const table = useTableUrlState();
  const statusFilter = useMemo(() => splitParam(table.filters.status), [table.filters.status]);
  const payments = usePayments({
    skip: section !== "transactions" || view !== "all",
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

  if (section && OLD_TRANSACTION_TABS[section]) {
    return <Navigate to={`/billing/transactions?view=${OLD_TRANSACTION_TABS[section]}`} replace />;
  }
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

  // All payments · Flagged · Stuck, in the table's toolbar row (owner 2026-10-29), like Collections' old tabs.
  const transactionTabs = (
    <Tabs
      aria-label="Transactions view"
      selectedKey={view}
      // A new tab starts clean: its own search, filters and page.
      onSelectionChange={(key) => setSearchParams(key === "all" ? {} : { view: String(key) })}
      classNames={{ base: "h-full min-w-0 max-w-full", tabList: "h-full border-b-0", tab: "h-full" }}
    >
      {(Object.keys(TRANSACTION_VIEWS) as TransactionView[]).map((key) => (
        <Tab key={key} title={TRANSACTION_VIEWS[key].label} />
      ))}
    </Tabs>
  );

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconPayments aria-hidden />}
        section="green"
        title="Transactions"
        count={view === "all" && !payments.loading ? payments.totalCount : undefined}
        description={
          TRANSACTION_VIEWS[view].description ??
          (payments.loading
            ? "What stores paid Zcom for their plans"
            : `${formatCount(statusCounts.success)} paid · ${formatCount(statusCounts.pending)} due · ${formatCount(statusCounts.failed)} failed · ${formatCount(statusCounts.refunded)} refunded`)
        }
      />
      {view === "flagged" ? (
        <FlaggedPaymentsTab tabs={transactionTabs} />
      ) : view === "stuck" ? (
        <Card padding="none" className="overflow-hidden">
          <StalePendingPayments tabs={transactionTabs} />
        </Card>
      ) : payments.error ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex min-h-[52px] border-b border-line px-4">{transactionTabs}</div>
          <ErrorState title="Couldn't load transactions." description={toasts.genericError} onRetry={() => void payments.refetch()} />
        </Card>
      ) : (
        <TransactionsTab
          tabs={transactionTabs}
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
