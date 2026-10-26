import type { ReactNode } from "react";
import type { Client, Subscription } from "../../types";
import { getPlanLabel } from "../../lib/display-labels.util";
import { getStoreHealth } from "../../lib/storeHealth";
import { healthFactorRows } from "../../lib/health-factors.util";
import { NO_PREVIOUS_SALES_COPY } from "../../lib/store-sales";
import { formatDate } from "../../lib/utils";
import { AiInsightCard, Card, Chip, HealthScore, KpiStrip, StatCard, formatMoney, formatRange, getHealthBand, useAiEnabled } from "../ui";
import { useState } from "react";
import { storeInsight } from "../../lib/aiSamples";
import { ClientPerformanceCard } from "./ClientPerformanceCard";
import { ClientUsageTab } from "./ClientUsageTab";
import { NotesCard } from "./NotesCard";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
  /**
   * Store detail is a two-column editor (docs/design/08-fixes-and-screens.md §2.14): "main" renders the KPIs,
   * insight, performance, health and plan usage; "rail" renders Profile and Notes for the side column.
   */
  part: "main" | "rail";
}

/** Store detail › Overview (docs/design/04-super-admin.md §3.4): KPIs → Insight → Performance → Health → Plan usage (main); Profile and Notes (rail). */
export function ClientOverviewTab({ client, subscription, part }: ClientOverviewTabProps) {
  const health = getStoreHealth(client);
  // PRD-024 FR-2.1: null growth = nothing sold in the previous 30 days; no change to show.
  const growthUnknown = client.growthPercent == null;
  // PRD-024 FR-1.7: snapshot figures say when they were taken.
  const measured = client.hasUsage !== false;
  const asOf = measured && client.usageAsOf ? ` · as of ${formatDate(client.usageAsOf)}` : "";
  // Insight card (AI flag), written from this store's own payment and health data.
  const aiEnabled = useAiEnabled();
  const [insightDismissed, setInsightDismissed] = useState(false);
  const insight = aiEnabled && !insightDismissed
    ? storeInsight(client, subscription)
    : null;

  if (part === "rail") {
    return (
      <>
        <Card title="Profile">
          <dl className="flex flex-col gap-3">
            <ProfileRow label="Owner">{client.ownerName}</ProfileRow>
            <ProfileRow label="Email">
              <a href={`mailto:${client.ownerEmail}`} className="break-all text-brand hover:underline">
                {client.ownerEmail}
              </a>
            </ProfileRow>
            <ProfileRow label="Plan">{getPlanLabel(subscription?.plan ?? client.plan)}</ProfileRow>
            <ProfileRow label="Joined">{formatDate(client.joinedDate)}</ProfileRow>
            <ProfileRow label="Renewal">
              {subscription?.renewalDate ? formatDate(subscription.renewalDate) : <span className="text-fg-subtle">—</span>}
            </ProfileRow>
            <ProfileRow label="Monthly fee">
              <span className="num">{formatMoney(client.mrr, { whole: true })}</span>
            </ProfileRow>
          </dl>
        </Card>

        <NotesCard client={client} />
      </>
    );
  }

  return (
    // Main column: numbers → insight → performance → health and plan usage side by side on wide screens.
    <>
      <KpiStrip>
        {/* PRD-024 FR-1.7 (B-03): "—" without a usage snapshot; "as of" its date otherwise. */}
        <StatCard
          bare
          label="Store sales · 30d"
          value={measured ? client.revenue : "—"}
          format="money"
          delta={!measured || growthUnknown ? null : client.growthPercent}
          deltaLabel={
            !measured ? (
              "No usage snapshot yet"
            ) : growthUnknown ? (
              `${NO_PREVIOUS_SALES_COPY}${asOf}`
            ) : (
              `vs previous 30 days${asOf}`
            )
          }
        />
        <StatCard
          bare
          label="Orders · 30d"
          value={measured ? client.orders30d : "—"}
          deltaLabel={measured ? (asOf ? asOf.replace(" · ", "") : null) : "No usage snapshot yet"}
        />
        <StatCard
          bare
          label="Health"
          value={health.score}
          deltaLabel={getHealthBand(health.score).label}
        />
        <StatCard bare label="Monthly fee" value={client.mrr} format="money" deltaLabel={`${getPlanLabel(client.plan)} plan`} />
      </KpiStrip>

      {insight ? (
        <AiInsightCard
          title={insight.title}
          body={insight.body}
          source={`Based on this store's payments, orders and activity, ${formatRange(new Date(new Date().getTime() - 30 * 86_400_000), new Date())}`}
          onDismiss={() => setInsightDismissed(true)}
        />
      ) : null}

      {/* PRD-024 FR-1.12 (P-03): the store's monthly usage snapshots (platformUsage). */}
      <ClientPerformanceCard tenantId={client.id} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Title and description like every card; the score is a compact chip beside the title (so it never
            wraps between title and description). Then one row per area the server scores, each factor as a
            coloured status. */}
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              Health
              <HealthScore score={health.score} variant="compact" />
            </span>
          }
          description="Out of 100, from account, orders, growth, billing and activity."
          className="h-full"
        >
          <div className="flex flex-col">
            <dl className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle">
              {healthFactorRows(health.factors).map((row) => (
                <div key={row.factor} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-label text-fg-muted">{row.area}</dt>
                  <dd>
                    <Chip tone={row.tone}>{row.factor}</Chip>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <ClientUsageTab client={client} className="h-full" />
      </div>
    </>
  );
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-label text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-body text-fg wrap-anywhere">{children}</dd>
    </div>
  );
}
