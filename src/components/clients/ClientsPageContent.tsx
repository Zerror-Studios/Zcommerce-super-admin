import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../../types";
import { toasts } from "../../copy";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { getStoreHealth } from "../../lib/storeHealth";
import { storeLifecycleEnum, storeLifecycleKey, graceDaysFor } from "../../lib/storeStatus";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { PageHeader } from "../common/PageHeader";
import { IconAdd, IconStore } from "../ui/icons";
import {
  Button,
  ErrorState,
  SummaryPanel,
  cx,
  formatCount,
  formatMoney,
  getHealthBand,
  toneTextClasses,
  type RowMenuItem,
  type SummaryCell,
} from "../ui";
import { StoresTable } from "./stores-list/StoresTable";
import { paymentBadge, paymentKindEnum, planShortName } from "./stores-list/store-list.util";
import { isInSetup } from "./stores-list/stores-tabs.util";

export interface ClientsPageContentProps {
  clients: Client[];
}

/** Plans in the summary: the two biggest by store count ("1 Growth · 2 Starter"), the rest as "+N more". */
const PLANS_SHOWN = 2;

/**
 * Stores (design v2 §7, board 59; small charts: sales bars, health dots, plan ring, past-due segments): ink title tile, "Stores 3", the line "2 live · 1 in setup · 1 needs payment",
 * **Create store** + ⋯ (Export, Choose columns, Deleted stores); the summary panel (Sales · 30 days, Average
 * health, Plans, Past due), then the toolbar and the stores table. Every number comes from the loaded stores.
 */
export function ClientsPageContent({ clients }: ClientsPageContentProps) {
  const navigate = useNavigate();
  const { loading, loadingMore, incomplete, pageGuardReached, loadRemaining, error, refetch, totalCount, subscriptions } =
    useClients();
  const { settings } = usePlatformSettings();
  const { can, user } = useAuth();

  const numbers = useMemo(() => {
    const byClient = latestSubscriptionByClient(subscriptions);
    let live = 0;
    let setup = 0;
    let owing = 0;
    let pastDue = 0;
    let dueSoon = 0;
    let sales = 0;
    let selling = 0;
    let healthSum = 0;
    const plans = new Map<string, number>();
    const revenues: number[] = [];
    clients.forEach((client) => {
      const key = storeLifecycleKey(client);
      if (key === storeLifecycleEnum.LIVE) live += 1;
      if (isInSetup(client)) setup += 1;
      const { kind } = paymentBadge(byClient.get(client.id), graceDaysFor(client, settings.gracePeriodDays));
      if (kind === paymentKindEnum.DUE) dueSoon += 1;
      if (kind === paymentKindEnum.GRACE || kind === paymentKindEnum.OVERDUE) pastDue += 1;
      if (kind === paymentKindEnum.DUE || kind === paymentKindEnum.GRACE || kind === paymentKindEnum.OVERDUE) owing += 1;
      if (client.revenue > 0) {
        sales += client.revenue;
        selling += 1;
        revenues.push(client.revenue);
      }
      healthSum += getStoreHealth(client).score;
      const plan = planShortName(client);
      plans.set(plan, (plans.get(plan) ?? 0) + 1);
    });
    const averageHealth = clients.length ? Math.round(healthSum / clients.length) : null;
    const planList = [...plans.entries()].sort((a, b) => b[1] - a[1]);
    // The Sales cell's small bars (board 59): each selling store's sales, smallest first, the biggest ten.
    const salesBars = revenues.sort((a, b) => a - b).slice(-10);
    return { live, setup, owing, pastDue, dueSoon, sales, selling, averageHealth, planList, salesBars };
  }, [clients, settings.gracePeriodDays, subscriptions]);

  const n = (value: number) => <span className="num">{formatCount(value)}</span>;
  // PRD-024 FR-1.6 (B-06): counted from the loaded rows; say so until every store is loaded.
  const partial = clients.length < totalCount;
  const description = (
    <>
      {n(numbers.live)} live · {n(numbers.setup)} in setup · {n(numbers.owing)} {numbers.owing === 1 ? "needs" : "need"} payment
      {partial ? <> in {n(clients.length)} loaded stores</> : null}
    </>
  );

  const healthBand = getHealthBand(numbers.averageHealth);
  const topPlans = numbers.planList.slice(0, PLANS_SHOWN);
  const morePlans = numbers.planList.length - topPlans.length;
  const cells: SummaryCell[] = [
    {
      key: "sales",
      label: "Sales · 30 days",
      value: formatMoney(numbers.sales, { whole: true }),
      note: `${formatCount(numbers.selling)} of ${formatCount(clients.length)} stores selling`,
      chart: numbers.salesBars.length > 1 ? { kind: "bars", values: numbers.salesBars } : undefined,
    },
    {
      key: "health",
      label: "Average health",
      value:
        numbers.averageHealth == null ? (
          "—"
        ) : (
          <>
            {numbers.averageHealth} <span className="text-body font-normal opacity-70">of 100</span>
          </>
        ),
      note: numbers.averageHealth == null ? undefined : healthBand.label,
      tone: healthBand.tone === "danger" ? "danger" : healthBand.tone === "warning" ? "warning" : "default",
      chart: numbers.averageHealth == null ? undefined : { kind: "dots" },
    },
    {
      key: "plans",
      label: "Plans",
      value: topPlans.length ? topPlans.map(([plan, count]) => `${formatCount(count)} ${plan}`).join(" · ") : "—",
      note: morePlans > 0 ? `+${formatCount(morePlans)} more ${morePlans === 1 ? "plan" : "plans"}` : undefined,
      // The share of stores on the biggest plan.
      chart: topPlans.length && clients.length ? { kind: "ring", percent: Math.round((topPlans[0][1] / clients.length) * 100) } : undefined,
    },
    {
      key: "past-due",
      label: "Past due",
      value: `${formatCount(numbers.pastDue)} ${numbers.pastDue === 1 ? "store" : "stores"}`,
      note: numbers.dueSoon ? `${formatCount(numbers.dueSoon)} more due soon` : undefined,
      tone: numbers.pastDue > 0 ? "danger" : "default",
      chart: clients.length
        ? { kind: "segments", filled: Math.min(10, Math.ceil((numbers.pastDue / clients.length) * 10)) }
        : undefined,
    },
  ];

  const header = (more: RowMenuItem[]) => (
    <PageHeader
      type="list"
      icon={<IconStore aria-hidden />}
      title="Stores"
      count={loading ? undefined : formatCount(totalCount)}
      description={loading ? "Every store on Zcom and its plan" : description}
      primaryAction={
        can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
          <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
            Create store
          </Button>
        ) : undefined
      }
      primaryShortLabel="Create"
      more={more}
      moreLabel="More store actions"
    />
  );

  // Pages of 100 load one after another (FE-09); say so while they do, or if one failed.
  const notices: ReactNode = (
    <>
      {!error && loadingMore ? (
        <p role="status" className="mb-3 text-label text-fg-muted">
          Loading stores… {formatCount(clients.length)} of {formatCount(totalCount)}.
        </p>
      ) : null}
      {incomplete ? (
        <p role="status" className={cx("mb-3 text-label", toneTextClasses.warning)}>
          {pageGuardReached
            ? `Showing the first ${formatCount(clients.length)} of ${formatCount(totalCount)} stores.`
            : `Showing ${formatCount(clients.length)} of ${formatCount(totalCount)} stores; the rest couldn't be loaded.`}{" "}
          <button type="button" className="underline" onClick={loadRemaining}>
            {pageGuardReached ? "Load the next 5,000" : "Try again"}
          </button>
        </p>
      ) : null}
    </>
  );

  if (error) {
    return (
      <div>
        {header([])}
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div>
      <StoresTable
        clients={clients}
        isLoading={loading}
        renderHeader={header}
        beforeTable={
          <>
            <SummaryPanel
              cells={cells}
              isLoading={loading}
              storageKey={`${user?.id ?? "me"}:stores`}
              aria-label="Stores summary"
              className="mb-4"
            />
            {notices}
          </>
        }
      />
    </div>
  );
}
