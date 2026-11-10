import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NeedsYouAiCard, NeedsYouBillingCard, NeedsYouOnboardingCard } from "../components/insights/home/NeedsYouCards";
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
  heroAttentionLine,
  heroDate,
  pastDueOf,
  storeCounts,
  summaryCells,
} from "../lib/sa-home.util";
import { LoadHold } from "../components/common/LoadHold";
import { useLoadView } from "../hooks/use-load-view";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformAttention, usePlatformMetrics } from "../hooks/use-platform-insights";
import type { PlatformMetricsPeriod } from "../types/platform-insights";

/**
 * Home (design v2 §7, board 02-V4-SA-Home; backend PRD-026 FR-7.1).
 *
 * The hero (date, Create store, "Good morning, ‹name›", the
 * orb with this week's line, chips for stores · live, GMV change and
 * payments past due, period tabs) → the summary panel (GMV, Subscriptions
 * with past due in red, Store health, and Uptime, which shows checkout
 * failures until uptime is monitored) → three equal action cards (round 2
 * §6.1: Zcom AI · Urgent, Billing, Onboarding) → Recent activity in
 * sentences → "Last updated · Refresh now". Hero: Announce + Create store,
 * and the line from the attention engine.
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
  // Round 2 §6.1: the line comes from the attention engine (rules + Zcom AI summary, money due, setup, risk).
  const summary = loading ? "" : heroAttentionLine(data);

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
  // Loading pass (2026-11-10): no skeleton for a fast answer (first 200ms keep the frame, invisible); cached
  // numbers show at once while cache-and-network refreshes them.
  const summaryView = useLoadView(summaryLoading, false);
  const cardsView = useLoadView(loading, data != null);

  const showBilling = loading || data?.moneyDue != null;

  return (
    <div className="flex w-full flex-col gap-4">
      <HomeHero
        date={heroDate()}
        name={greetingName(user?.name)}
        actions={
          // Round 2 §6.1 (board 02): Announce (glass) + Create store (on-dark). Round 3 F7: Announce uses the shared
          // glass button (white 14% fill, 1px white 24% border), not the faint chip.
          <>
            <Link to="/support/announcements" className="zc-btn-glass">
              Announce
            </Link>
            {can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
              <Button variant="on-dark" size="sm" onPress={() => navigate("/stores/new")}>
                Create store
              </Button>
            ) : null}
          </>
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
          <LoadHold hold={summaryView.hold}>
            <SummaryPanel cells={cells} isLoading={summaryView.skeleton} storageKey={`${user?.id ?? "me"}:home`} aria-label="Platform summary" />
          </LoadHold>

          {/* Round 2 §6.1: three equal action cards a row from 1024px (two on tablet, the third spans), one on phone. */}
          <div
            className={cx(
              showBilling ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:max-lg:[&>:last-child]:col-span-2" : "grid grid-cols-1 gap-4 md:grid-cols-2",
              cardsView.hold && "invisible",
            )}
          >
            <NeedsYouAiCard summary={data?.whatNeedsAttention ?? null} storeNames={storeNames} isLoading={cardsView.skeleton} />
            {showBilling ? <NeedsYouBillingCard moneyDue={data?.moneyDue ?? null} isLoading={cardsView.skeleton} /> : null}
            <NeedsYouOnboardingCard development={data?.development ?? null} atRiskCount={data?.atRisk.totalCount ?? 0} isLoading={cardsView.skeleton} />
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
