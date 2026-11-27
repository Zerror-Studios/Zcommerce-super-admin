/**
 * Super Admin › Messaging (backend PRD-050 FR-1.10, FR-1.11, D19): the MSG91
 * side of every store's email, in three tabs kept in `?tab=`:
 * - Work queue: the steps ZCOM can't do by API yet, with values to copy, the
 *   per-type form, Done and Reject (the console feed's MESSAGING_TASK_NEW
 *   links here);
 * - Accounts: each store's MSG91 account, credentials saved (never shown),
 *   domain, and sending on/off (read-only; the owner's CLI switches it);
 * - Rates: per channel and purpose, and the add_client API switch;
 * - Balances: every store's prepaid message balance, lowest first, with its
 *   ledger, top-ups and "Grant or correct" (FR-4.6);
 * - Top-up requests: Record payment (bank reference) and Withdraw (FR-4.6);
 *   the feed's MESSAGING_TOPUP_REQUESTED / MESSAGING_BALANCE_EMPTY alerts
 *   link to this tab and Balances (D20);
 * - Usage check: each month's MSG91 email count against ours, per store and
 *   for the parent account, with "Run again" (D20; the feed's
 *   MESSAGING_USAGE_MISMATCH alert links here with `?month=`).
 * Reads need platform:messaging:read; every change platform:messaging:manage.
 */
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { MessagingAccountsTab } from "../components/messaging/MessagingAccountsTab";
import { MessagingBalancesTab } from "../components/messaging/MessagingBalancesTab";
import { MessagingQueueTab } from "../components/messaging/MessagingQueueTab";
import { MessagingRatesTab } from "../components/messaging/MessagingRatesTab";
import { MessagingReconciliationTab } from "../components/messaging/MessagingReconciliationTab";
import { MessagingTopUpsTab } from "../components/messaging/MessagingTopUpsTab";
import { Card, EmptyState, SegmentedSwitch } from "../components/ui";
import { IconLock } from "../components/ui/icons";
import { messagingAbilities } from "../lib/platform-messaging.util";
import { useAuth } from "../providers/AuthProvider";

const TABS = [
  { value: "queue", label: "Work queue" },
  { value: "accounts", label: "Accounts" },
  { value: "rates", label: "Rates" },
  { value: "balances", label: "Balances" },
  { value: "top-ups", label: "Top-up requests" },
  { value: "reconciliation", label: "Usage check" },
] as const;

type MessagingTab = (typeof TABS)[number]["value"];

function isMessagingTab(value: string | null): value is MessagingTab {
  return TABS.some((tab) => tab.value === value);
}

export function Messaging() {
  const { can } = useAuth();
  const abilities = messagingAbilities(can);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: MessagingTab = isMessagingTab(requested) ? requested : "queue";

  const header = (
    <PageHeader title="Messaging" description="MSG91 accounts for every store's email: the ops queue, accounts, rates and message balances" />
  );

  if (!abilities.read) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={IconLock} title="Messaging isn't available to your role" description="Ask a platform owner for messaging access." />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-4">
        <SegmentedSwitch<MessagingTab>
          variant="underline"
          ariaLabel="Messaging sections"
          items={TABS.map((item) => ({ value: item.value, label: item.label }))}
          value={tab}
          onChange={(next) =>
            setParams(
              (previous) => {
                const updated = new URLSearchParams(previous);
                if (next === "queue") updated.delete("tab");
                else updated.set("tab", next);
                return updated;
              },
              { replace: true },
            )
          }
        />
        {tab === "queue" ? <MessagingQueueTab canManage={abilities.manage} /> : null}
        {tab === "accounts" ? <MessagingAccountsTab canManage={abilities.manage} /> : null}
        {tab === "rates" ? <MessagingRatesTab canManage={abilities.manage} /> : null}
        {tab === "balances" ? <MessagingBalancesTab canManage={abilities.manage} /> : null}
        {tab === "top-ups" ? <MessagingTopUpsTab canManage={abilities.manage} /> : null}
        {tab === "reconciliation" ? <MessagingReconciliationTab canManage={abilities.manage} /> : null}
      </div>
    </>
  );
}
