import { useState } from "react";
import type { Client, Subscription } from "../../types";
import { getPlanLabel } from "../../lib/display-labels.util";
import { getStoreHealth } from "../../lib/storeHealth";
import { healthFactorRows } from "../../lib/health-factors.util";
import { NO_PREVIOUS_SALES_COPY } from "../../lib/store-sales";
import { formatDate } from "../../lib/utils";
import { storeInsight } from "../../lib/aiSamples";
import { AiInsightCard, Card, Chip, HealthScore, KpiStrip, StatCard, formatMoney, formatRange, getHealthBand, useAiEnabled } from "../ui";
import { ClientPerformanceCard } from "./ClientPerformanceCard";
import { ClientUsageTab } from "./ClientUsageTab";
import { NotesCard } from "./NotesCard";
import { KeyValue, KeyValueGrid } from "./StoreDetailParts";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
}

/** 50/50 rows of the Overview; they stack when the content column is under 640px (04 S-03a). */
const pairRowClass = "grid grid-cols-1 items-start gap-4 @min-[40rem]:grid-cols-2";

/**
 * Store detail › Overview (04 S-03a): KPI strip (4 cells) · Performance (chart 220px) · Health | Plan usage ·
 * Profile | Notes.
 */
export function ClientOverviewTab({ client, subscription }: ClientOverviewTabProps) {
  const health = getStoreHealth(client);
  // PRD-024 FR-2.1: null growth = nothing sold in the previous 30 days; no change to show.
  const growthUnknown = client.growthPercent == null;
  // PRD-024 FR-1.7: snapshot figures say when they were taken.
  const measured = client.hasUsage !== false;
  const asOf = measured && client.usageAsOf ? ` · as of ${formatDate(client.usageAsOf)}` : "";
  // Insight card (AI flag), written from this store's own payment and health data.
  const aiEnabled = useAiEnabled();
  const [insightDismissed, setInsightDismissed] = useState(false);
  const insight = aiEnabled && !insightDismissed ? storeInsight(client, subscription) : null;
  const band = getHealthBand(health.score);

  return (
    <div className="@container flex flex-col gap-4">
      {/* The strip picks kpi-xl or kpi-l by its own width (01 §7.13); at 724px the cells take kpi-l. */}
      <KpiStrip>
        {/* PRD-024 FR-1.7 (B-03): "—" without a usage snapshot; "as of" its date otherwise. */}
        <StatCard
          bare
          label="Store sales · 30d"
          value={measured ? client.revenue : "—"}
          format="money"
          delta={!measured || growthUnknown ? null : client.growthPercent}
          deltaLabel={
            !measured
              ? "No usage snapshot yet"
              : growthUnknown
                ? `${NO_PREVIOUS_SALES_COPY}${asOf}`
                : `vs previous 30 days${asOf}`
          }
        />
        <StatCard
          bare
          label="Orders · 30d"
          value={measured ? client.orders30d : "—"}
          deltaLabel={measured ? (asOf ? asOf.replace(" · ", "") : null) : "No usage snapshot yet"}
        />
        <StatCard bare label="Health" value={health.score} deltaLabel={band.label} />
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

      <div className={pairRowClass}>
        <Card
          title="Health"
          description="Out of 100, from account, orders, growth, billing and activity."
          actions={<HealthScore score={health.score} variant="compact" />}
          className="h-full"
        >
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
        </Card>

        <ClientUsageTab client={client} className="h-full" />
      </div>

      <div className={pairRowClass}>
        <Card title="Profile" className="h-full">
          <KeyValueGrid columns={2}>
            <KeyValue label="Owner">{client.ownerName}</KeyValue>
            <KeyValue label="Email">
              {client.ownerEmail ? (
                <a href={`mailto:${client.ownerEmail}`} className="text-brand hover:underline">
                  {client.ownerEmail}
                </a>
              ) : null}
            </KeyValue>
            <KeyValue label="Plan">{getPlanLabel(subscription?.plan ?? client.plan)}</KeyValue>
            <KeyValue label="Joined">{formatDate(client.joinedDate)}</KeyValue>
            <KeyValue label="Renewal">{subscription?.renewalDate ? formatDate(subscription.renewalDate) : null}</KeyValue>
            <KeyValue label="Monthly fee">
              <span className="num">{formatMoney(client.mrr, { whole: true })}</span>
            </KeyValue>
          </KeyValueGrid>
        </Card>

        <NotesCard client={client} className="h-full" />
      </div>
    </div>
  );
}
