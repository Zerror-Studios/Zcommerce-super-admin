import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NeedsYouAiCard, NeedsYouBillingCard, NeedsYouStoresCard } from "../components/insights/home/NeedsYouCards";
import { RecentActivityCard } from "../components/insights/home/RecentActivityCard";
import { SnapshotHeader } from "../components/insights/SnapshotHeader";
import { Button, ErrorState, HomeHero, SummaryPanel, cx } from "../components/ui";
import { toasts } from "../copy";
import { knownStoreNames } from "../lib/home-attention.util";
import { findMetric } from "../lib/platform-insights.util";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import {
  SA_HOME_COMPARISON,
  SA_HOME_DEFAULT_PERIOD,
  SA_HOME_PERIODS,
  greetingName,
  healthSummary,
  heroChips,
  heroDate,
  heroSummary,
  pastDueOf,
  storeCounts,
  summaryCells,
} from "../lib/sa-home.util";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformAttention, usePlatformMetrics } from "../hooks/use-platform-insights";
import type { PlatformMetricsPeriod } from "../types/platform-insights";

/**
 * Home (design v2 §7, board 02-V4-SA-Home; backend PRD-026 FR-7.1).
 *
 * The hero (date · Platform, Create store, "Good morning, ‹name›", the
 * orb with this week's line, chips for stores · live, GMV change and
 * payments past due, period tabs) → the summary panel (GMV, Subscriptions
 * with past due in red, Store health, and Uptime, which shows checkout
 * failures until uptime is monitored) → three Needs you cards (Zcom AI's
 * What needs attention, Billing's money due this week, Stores at risk and
 * in setup) → Recent activity → "Last updated · Refresh now".
 *
 * The period tabs pick the snapshot period for GMV and its chip; the rest
 * is live (money due), this month (MRR) or fixed (checkout failures, 7
 * days). Every number is the server's; the page only averages the loaded
 * stores' health scores. No "Ask AI" here: the bottom bar is the one place.
 */
export function Home() {
  const { clients, loading: clientsLoading, totalCount } = useClients();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const [period, setPeriod] = useState<PlatformMetricsPeriod>(SA_HOME_DEFAULT_PERIOD);

  const attention = usePlatformAttention();
  const metrics = usePlatformMetrics(period);
  const data = attention.data;
  const loading = attention.loading;
  const firstRun = !loading && !attention.error && data != null && !data.computedAt;
  const storeNames = useMemo(() => knownStoreNames(data), [data]);

  const snapshot = metrics.data;
  const sections = snapshot?.sections;
  const gmv = findMetric(sections, "gmv");
  const pastDue = pastDueOf(data?.moneyDue);
  const stores = useMemo(() => (clientsLoading ? null : storeCounts(clients)), [clients, clientsLoading]);
  const health = useMemo(() => healthSummary(clients), [clients]);

  const chips = heroChips({ stores, gmv, pastDue, comparison: SA_HOME_COMPARISON[period] });
  const summary = loading
    ? ""
    : heroSummary({ pastDue, atRisk: data?.atRisk.totalCount ?? 0, inSetup: data?.development.totalCount ?? 0 });

  const cells = summaryCells({
    gmv,
    orders: findMetric(sections, "orders"),
    activeStores: snapshot?.activeStores ?? data?.activeStores ?? null,
    mrr: data?.thisMonth.mrr ?? null,
    collected: data?.thisMonth.collected ?? null,
    pastDue,
    health,
    totalStores: totalCount,
    uptime: findMetric(sections, "uptimePct"),
    checkoutFailures: findMetric(sections, "checkoutFailures7d"),
    paymentFailures: findMetric(sections, "paymentFailures7d"),
    metricsError: metrics.error != null,
  });
  const summaryLoading = (metrics.loading && !snapshot) || loading || clientsLoading;

  const showBilling = loading || data?.moneyDue != null;

  return (
    <div className="flex w-full flex-col gap-4">
      <HomeHero
        date={heroDate()}
        name={greetingName(user?.name)}
        actions={
          // Announce (board 02) waits for an Announcements feature: there is no data for it yet.
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <Button variant="glass" size="sm" onPress={() => navigate("/stores/new")}>
              Create store
            </Button>
          ) : undefined
        }
        summary={summary}
        chips={chips}
        periods={SA_HOME_PERIODS}
        period={period}
        onPeriodChange={setPeriod}
        periodLabel="Show sales for"
      />

      {attention.error ? (
        <ErrorState
          title="Couldn't load the platform numbers."
          description={toasts.genericError}
          onRetry={() => void attention.refetch()}
          className="rounded-card-lg border border-line bg-surface py-10"
        />
      ) : (
        <>
          <SummaryPanel cells={cells} isLoading={summaryLoading} storageKey={`${user?.id ?? "me"}:home`} aria-label="Platform summary" />

          {/* v2 §10: three cards a row from 1024px, two on tablet (the third spans the row), one on phone. */}
          <div
            className={cx(
              "grid grid-cols-1 gap-4 md:grid-cols-2",
              showBilling && "lg:grid-cols-3 md:max-lg:[&>:last-child]:col-span-2",
            )}
          >
            <NeedsYouAiCard summary={data?.whatNeedsAttention ?? null} storeNames={storeNames} isLoading={loading} />
            {showBilling ? <NeedsYouBillingCard moneyDue={data?.moneyDue ?? null} isLoading={loading} /> : null}
            <NeedsYouStoresCard atRisk={data?.atRisk ?? null} development={data?.development ?? null} isLoading={loading} />
          </div>
        </>
      )}

      {/* PRD-014 UX-27: the audit log needs audit:read (not billing or support roles). */}
      {can(PLATFORM_PERMISSIONS.AUDIT_READ) ? <RecentActivityCard /> : null}

      {attention.error ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SnapshotHeader computedAt={data?.computedAt ?? null} stale={data?.stale ?? false} />
          {/* Before the first snapshot the header names when it runs; money due is read live meanwhile. */}
          {firstRun ? <span className="text-caption text-fg-subtle">Money due is live.</span> : null}
        </div>
      )}
    </div>
  );
}
