import { useState, type ReactNode } from "react";
import type { Client, Subscription } from "../../types";
import { getPlanLabel } from "../../lib/display-labels.util";
import { getStoreHealth } from "../../lib/storeHealth";
import { healthFactorRows } from "../../lib/health-factors.util";
import { billingStateView } from "../../lib/platform-billing.util";
import { NO_PREVIOUS_SALES_COPY } from "../../lib/store-sales";
import { formatDate } from "../../lib/utils";
import { storeInsight } from "../../lib/aiSamples";
import {
  AiLine,
  Avatar,
  Button,
  ButtonLink,
  Card,
  Chip,
  HealthScore,
  SummaryPanel,
  formatCount,
  formatMoney,
  formatPercent,
  getHealthBand,
  useAiEnabled,
  type SummaryCell,
  type Tone,
} from "../ui";
import { ClientActivityCard } from "./ClientActivityCard";
import { ClientPerformanceCard } from "./ClientPerformanceCard";
import { NotesCard } from "./NotesCard";
import { ConnectedAppsCard } from "./StoreAppsTab";
import { StoreHealthCard } from "./StoreHealthCard";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
}

/** Main column + 26rem side column once the content is 64rem wide; one column below (§10 detail pages). */
const columnsClass = "grid grid-cols-1 items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_26rem]";

/** The word in a health row's chip (board 60: Good, Failing…); the server's factor text sits on the right. */
const TONE_WORDS: Partial<Record<Tone, string>> = {
  success: "Good",
  warning: "Watch",
  danger: "Failing",
  info: "Note",
};

/** One label/value row with a line between rows (the board's Plan & billing card). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line-subtle py-2.5 text-body">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg wrap-anywhere">{children ?? <span className="text-fg-subtle">Not set</span>}</dd>
    </div>
  );
}

/** wa.me wants the number in digits only, with the country code. */
const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

/**
 * Store detail › Overview (design v2 §7, board 60-SA-Store): the store insight as an insight line (contextual AI,
 * `aiSamples`), the summary panel (Sales · 30d, Orders · 30d, Products, Health), then the main column (Store
 * health, the nightly health signals, connected apps, the latest activity, the Performance chart) and the side
 * column (Plan & billing, Owner, Notes for the team). The page adds the setup checklist, Go live and Profile
 * sections around it. Plan usage against the limits is on the Billing tab (board 61 "Plan limits").
 *
 * Backend gaps (hidden): Customers and subscribers, products live of total, AI questions of the plan's.
 */
export function ClientOverviewTab({ client, subscription }: ClientOverviewTabProps) {
  const health = getStoreHealth(client);
  // PRD-024 FR-2.1: null growth = nothing sold in the previous 30 days; no change to show.
  const growth = client.growthPercent;
  // PRD-024 FR-1.7: snapshot figures say when they were taken.
  const measured = client.hasUsage !== false;
  const asOf = measured && client.usageAsOf ? `As of ${formatDate(client.usageAsOf)}` : undefined;
  // Insight line (AI flag), written from this store's own payment and health data.
  const aiEnabled = useAiEnabled();
  const [insightDismissed, setInsightDismissed] = useState(false);
  const insight = aiEnabled && !insightDismissed ? storeInsight(client, subscription) : null;
  const band = getHealthBand(health.score);
  const productLimit = client.planRef?.limits.products ?? null;
  const staffLimit = client.planRef?.limits.staff ?? null;
  const billing = billingStateView(subscription, formatDate);
  const base = `/stores/${client.id}`;

  // PRD-024 FR-1.7 (B-03): "—" without a usage snapshot; "as of" its date otherwise.
  const cells: SummaryCell[] = [
    {
      key: "sales",
      label: "Sales · 30d",
      value: measured ? formatMoney(client.revenue, { whole: true }) : "—",
      note: !measured
        ? "No usage snapshot yet"
        : growth == null
          ? NO_PREVIOUS_SALES_COPY
          : `${growth >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(growth))} vs the 30 days before`,
      tone: measured && growth != null && growth <= -20 ? "warning" : "default",
    },
    {
      key: "orders",
      label: "Orders · 30d",
      value: measured ? formatCount(client.orders30d) : "—",
      note: measured ? asOf : "No usage snapshot yet",
      chart: measured ? { kind: "dots" } : undefined,
    },
    {
      key: "products",
      label: "Products",
      value: measured ? (
        productLimit ? (
          <>
            {formatCount(client.usage.products)} <span className="text-body font-normal opacity-70">of {formatCount(productLimit)}</span>
          </>
        ) : (
          formatCount(client.usage.products)
        )
      ) : (
        "—"
      ),
      note: measured
        ? productLimit
          ? "Allowed on the plan"
          : client.usage.products === 0
            ? "No products yet"
            : undefined
        : "No usage snapshot yet",
      tone: measured && client.usage.products === 0 ? "warning" : "default",
      chart: measured && productLimit ? { kind: "ring", percent: Math.round((client.usage.products / productLimit) * 100) } : undefined,
    },
    {
      key: "health",
      label: "Health",
      value: (
        <>
          {health.score} <span className="text-body font-normal opacity-70">of 100</span>
        </>
      ),
      note: band.label,
      tone: band.tone === "danger" ? "danger" : band.tone === "warning" ? "warning" : "default",
      chart: { kind: "segments", filled: Math.round(health.score / 10) },
    },
  ];

  return (
    <div className="@container flex flex-col gap-4">
      {insight ? (
        <AiLine
          action={
            <Button variant="tertiary" size="sm" onPress={() => setInsightDismissed(true)}>
              Dismiss
            </Button>
          }
        >
          <span className="font-semibold">{insight.title}.</span> {insight.body}
        </AiLine>
      ) : null}

      <SummaryPanel cells={cells} storageKey="store:overview" aria-label={`${client.storeName} summary`} />

      <div className={columnsClass}>
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Store health"
            description={`${band.label}. Out of 100, from account, orders, growth, billing and activity.`}
            actions={<HealthScore score={health.score} />}
          >
            <dl className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle">
              {healthFactorRows(health.factors).map((row) => (
                <div key={row.factor} className="flex items-center gap-4 py-2.5">
                  <dt className="flex min-w-0 flex-1 items-center gap-4 text-body text-fg">
                    <span className="w-20 shrink-0">
                      <Chip tone={row.tone}>{TONE_WORDS[row.tone] ?? row.area}</Chip>
                    </span>
                    <span className="min-w-0 truncate">{row.area}</span>
                  </dt>
                  <dd className="shrink-0 text-label text-fg-muted">{row.factor}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* PRD-025 FR-5, FR-6.3: the nightly snapshot's store-health signals (the old Analytics section). */}
          <StoreHealthCard tenantId={client.id} />

          <ConnectedAppsCard client={client} />

          {/* PRD-024 FR-1.12: the latest console changes to this store; the full list is on Activity log. */}
          <ClientActivityCard tenantId={client.id} variant="compact" logHref={`${base}/activity`} />

          {/* PRD-024 FR-1.12 (P-03): the store's monthly usage snapshots (platformUsage). */}
          <ClientPerformanceCard tenantId={client.id} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Plan & billing"
            actions={
              <ButtonLink variant="tertiary" size="sm" to={`${base}/billing`}>
                Change plan
              </ButtonLink>
            }
          >
            <dl className="flex flex-col">
              <Row label="Plan">
                {getPlanLabel(subscription?.plan ?? client.plan)}
                {subscription?.billingCycle ? ` · ${subscription.billingCycle === "YEARLY" ? "yearly" : "monthly"}` : ""}
              </Row>
              <Row label="Billing">
                <Chip tone={billing.tone}>{billing.label}</Chip>
              </Row>
              <Row label="Monthly fee">
                <span className="num">{formatMoney(client.mrr, { whole: true })}</span>
              </Row>
              <Row label="Renewal">{subscription?.renewalDate ? formatDate(subscription.renewalDate) : null}</Row>
              <Row label="Seats">
                {measured && client.staffCount != null ? (
                  <span className="num">
                    {formatCount(client.staffCount)}
                    {staffLimit ? ` of ${formatCount(staffLimit)}` : ""}
                  </span>
                ) : null}
              </Row>
              <Row label="Joined">{formatDate(client.joinedDate)}</Row>
            </dl>
          </Card>

          <Card title="Owner">
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={client.ownerName || client.storeName} size="lg" className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-fg">{client.ownerName || "Not set"}</p>
                  <p className="truncate text-label text-fg-muted">{client.ownerEmail || "No email"}</p>
                  {client.ownerPhone ? <p className="truncate text-label text-fg-muted num">{client.ownerPhone}</p> : null}
                </div>
              </div>
              {client.ownerEmail || client.ownerPhone ? (
                <div className="grid grid-cols-2 gap-2">
                  {client.ownerEmail ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        window.location.href = `mailto:${client.ownerEmail}`;
                      }}
                    >
                      Email
                    </Button>
                  ) : null}
                  {client.ownerPhone ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        window.open(whatsappHref(client.ownerPhone ?? ""), "_blank", "noopener,noreferrer");
                      }}
                    >
                      WhatsApp
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <NotesCard client={client} />
        </div>
      </div>
    </div>
  );
}
