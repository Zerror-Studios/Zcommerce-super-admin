import { useQuery } from "@apollo/client";
import type { ReactNode } from "react";
import type { Client, Subscription } from "../../types";
import { PLATFORM_TENANT_HEALTH } from "../../graphql/store-profile";
import { PLATFORM_STORE_SETUP } from "../../graphql/tenants";
import { clientPlanName } from "../../lib/plan-identity.util";
import { getStoreHealth } from "../../lib/storeHealth";
import { healthFactorRows } from "../../lib/health-factors.util";
import { billingStateView } from "../../lib/platform-billing.util";
import { NO_PREVIOUS_SALES_COPY } from "../../lib/store-sales";
import { storeSetupDoneCount } from "../../lib/store-setup.util";
import { latestHealthSnapshot, type HealthSnapshotLike } from "../../lib/tenant-health.util";
import { setupFromIssues, storeHealthLine, storeHealthRows } from "../../lib/store-health-rows.util";
import { formatDate } from "../../lib/utils";
import { storeInsight } from "../../lib/aiSamples";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformStoreSetupCheck } from "../../types/platform-api";
import {
  AiLine,
  Avatar,
  Button,
  ButtonLink,
  Card,
  Chip,
  ProgressRing,
  Skeleton,
  SummaryPanel,
  formatCount,
  formatMoney,
  formatPercent,
  getHealthBand,
  useAiEnabled,
  type SummaryCell,
} from "../ui";
import { ClientActivityCard } from "./ClientActivityCard";
import { ClientPerformanceCard } from "./ClientPerformanceCard";
import { NotesCard } from "./NotesCard";
import { ConnectedAppsCard } from "./StoreAppsTab";
import { StoreHealthCard } from "./StoreHealthCard";
import { lastSyncOf, useStoreApps } from "./use-store-apps";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
  /** The collapsible Setup card (and provisioning), placed after Activity (board 60). */
  setup?: ReactNode;
}

/** Main column + 26rem side column once the content is 64rem wide; one column below (§10 detail pages). */
const columnsClass = "grid grid-cols-1 items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_26rem]";

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

const knownEmail = (value: string | undefined) => (value && value.includes("@") ? value : null);

/**
 * The AI banner's one thing to do (board 60): a payment problem first (the server's health issues: payment app
 * retiring, failed or expired payments), then the store insight (overdue, critical health, falling sales), then
 * unfinished setup. Null when there is nothing to do.
 */
function oneThingToDo(client: Client, subscription: Subscription | undefined): { title: string; body: string } | null {
  const issues = client.health?.issues ?? [];
  const owner = client.ownerName && client.ownerName !== "—" ? client.ownerName.split(/\s+/)[0] : "the owner";
  const payment = issues.find((issue) => /payment|unpaid/i.test(issue) && !/^setup\b/i.test(issue));
  if (payment) return { title: payment.replace(/\.$/, ""), body: `A short call with ${owner} to sort out payments would help.` };
  const insight = storeInsight(client, subscription);
  if (insight) return insight;
  const setup = setupFromIssues(issues);
  if (setup && setup.done < setup.total) {
    return { title: `Setup is ${setup.done} of ${setup.total}`, body: `A setup call with ${owner} usually gets the rest done in one go.` };
  }
  return null;
}

/**
 * Store detail › Overview (design v2 §7, board 60-SA-Store; round 2 §6.3): the AI banner with the one thing to do
 * and "Schedule a call", the summary panel (Sales · 30d, Orders, Products live, Customers), then the main column
 * (Store health: ring + Setup complete, Selling regularly, Team signs in, Payments, Google Analytics with Good /
 * Failing / Stale chips; Connected apps; Activity; Setup as a collapsible card) and the side column (Plan & billing,
 * Owner with Email / WhatsApp, Notes for the team). Below the board's blocks: the nightly health signals and the
 * Performance chart (kept from v2). Plan usage against the limits is on the Billing tab (board 61 "Plan limits").
 *
 * Customers: the nightly usage snapshot's count (PRD-036 round 2 gaps); "—" until a snapshot has counted them.
 */
export function ClientOverviewTab({ client, subscription, setup }: ClientOverviewTabProps) {
  const { can } = useAuth();
  const health = getStoreHealth(client);
  // PRD-024 FR-2.1: null growth = nothing sold in the previous 30 days; no change to show.
  const growth = client.growthPercent;
  // PRD-024 FR-1.7: snapshot figures say when they were taken.
  const measured = client.hasUsage !== false;
  const asOf = measured && client.usageAsOf ? `As of ${formatDate(client.usageAsOf)}` : undefined;
  const aiEnabled = useAiEnabled();
  const todo = aiEnabled ? oneThingToDo(client, subscription) : null;
  const band = getHealthBand(health.score);
  const productLimit = client.planRef?.limits.products ?? null;
  const staffLimit = client.planRef?.limits.staff ?? null;
  const billing = billingStateView(subscription, formatDate);
  const base = `/stores/${client.id}`;
  const ownerEmail = knownEmail(client.ownerEmail);

  // Store health facts: setup checks, the nightly health snapshot and the analytics app (the same reads the Setup
  // card, the health signals card and Connected apps make, so they come from the Apollo cache).
  const setupQuery = useQuery<{ platformStoreSetup: PlatformStoreSetupCheck[] }>(PLATFORM_STORE_SETUP, {
    variables: { tenantId: client.id },
    skip: !can(PLATFORM_PERMISSIONS.TENANTS_READ),
    fetchPolicy: "cache-and-network",
  });
  const healthQuery = useQuery<{ platformUsage: HealthSnapshotLike[] }>(PLATFORM_TENANT_HEALTH, {
    variables: { tenantId: client.id },
    fetchPolicy: "cache-and-network",
  });
  const apps = useStoreApps(client);
  const checks = setupQuery.data?.platformStoreSetup ?? [];
  const snapshot = latestHealthSnapshot(healthQuery.data?.platformUsage)?.health ?? null;
  const analyticsRows = apps.rows.filter((row) => String(row.provider).toUpperCase() === "GA4");
  // Round 2 D11: what pulls the score down (server `healthIssues`: setup, payment app, expired unpaid orders).
  const issues = client.health?.issues ?? [];
  const factorRows = healthFactorRows(health.factors, issues);
  const healthRows = storeHealthRows({
    setup: checks.length ? { done: storeSetupDoneCount(checks), total: checks.length } : setupFromIssues(issues),
    measured,
    orders30d: client.orders30d,
    ordersTone: factorRows.find((row) => row.area === "Orders")?.tone ?? null,
    logins30d: snapshot?.logins30d,
    staffCount: client.staffCount ?? null,
    paymentFailures7d: snapshot?.paymentFailures7d,
    unpaidExpiries30d: snapshot?.unpaidExpiries30d,
    paymentIssues: issues.filter((issue) => /payment|unpaid/i.test(issue)),
    analyticsLastSync: analyticsRows.length ? lastSyncOf(analyticsRows) : undefined,
  });
  const healthLoading = (setupQuery.loading && !setupQuery.data) || (healthQuery.loading && !healthQuery.data);

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
      label: "Orders",
      value: measured ? formatCount(client.orders30d) : "—",
      note: measured ? (asOf ?? "Last 30 days") : "No usage snapshot yet",
      chart: measured ? { kind: "dots" } : undefined,
    },
    {
      key: "products",
      label: "Products live",
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
      note: measured ? (productLimit ? "Allowed on the plan" : client.usage.products === 0 ? "No products yet" : undefined) : "No usage snapshot yet",
      tone: measured && client.usage.products === 0 ? "warning" : "default",
      chart: measured && productLimit ? { kind: "ring", percent: Math.round((client.usage.products / productLimit) * 100) } : undefined,
    },
    {
      // PRD-036 round 2 gaps: usage.customers from the nightly snapshot
      key: "customers",
      label: "Customers",
      value: client.customers != null ? formatCount(client.customers) : "—",
      note: client.customers != null ? (client.customers === 0 ? "No customers yet" : undefined) : "Not counted yet",
      tone: client.customers === 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="@container flex flex-col gap-4">
      {todo ? (
        <AiLine
          action={
            ownerEmail ? (
              <Button
                variant="primary"
                size="sm"
                onPress={() => {
                  window.location.href = `mailto:${ownerEmail}?subject=${encodeURIComponent(`A quick call about ${client.storeName}`)}`;
                }}
              >
                Schedule a call
              </Button>
            ) : undefined
          }
        >
          <span className="font-semibold">{todo.title}.</span> {todo.body}
        </AiLine>
      ) : null}

      <SummaryPanel cells={cells} storageKey="store:overview" aria-label={`${client.storeName} summary`} />

      <div className={columnsClass}>
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Store health"
            description={healthLoading ? "Checking…" : storeHealthLine(band.label, healthRows)}
            leading={
              // Round 3 F4: one number in the ring (the score), not the score drawn over the ring's own "NN%".
              <ProgressRing value={health.score} label={`Store health ${health.score} of 100`} center={health.score} />
            }
          >
            {healthLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-8 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <dl className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle">
                {healthRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-4 py-2.5">
                    <dt className="flex min-w-0 flex-1 items-center gap-4 text-body text-fg">
                      <span className="w-20 shrink-0">
                        <Chip tone={row.tone} dot={false}>
                          {row.word}
                        </Chip>
                      </span>
                      <span className="min-w-0 truncate">{row.label}</span>
                    </dt>
                    <dd className="min-w-0 truncate text-right text-label text-fg-muted" title={row.detail}>
                      {row.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          <ConnectedAppsCard client={client} />

          {/* PRD-024 FR-1.12: the latest console changes to this store; the full list is on Activity log. */}
          <ClientActivityCard tenantId={client.id} variant="compact" logHref={`${base}/activity`} />

          {setup}

          {/* Kept from v2 (not on board 60): the nightly health signals and the monthly usage chart. */}
          <StoreHealthCard tenantId={client.id} />
          <ClientPerformanceCard tenantId={client.id} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Plan & billing"
            actions={
              <ButtonLink variant="ghost" size="sm" to={`${base}/billing`}>
                Change plan
              </ButtonLink>
            }
          >
            <dl className="flex flex-col">
              <Row label="Plan">
                {clientPlanName(client)}
                {subscription?.billingCycle ? ` · ${subscription.billingCycle === "YEARLY" ? "yearly" : "monthly"}` : ""}
              </Row>
              <Row label="Billing">
                <Chip tone={billing.tone}>{billing.label}</Chip>
              </Row>
              <Row label="Monthly fee">
                {client.mrr > 0 ? <span className="num">{formatMoney(client.mrr, { whole: true })}</span> : "No fee"}
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
                  <p className="truncate text-body font-medium text-fg">{client.ownerName && client.ownerName !== "—" ? client.ownerName : "Not set"}</p>
                  <p className="truncate text-label text-fg-muted">{ownerEmail ?? "No email"}</p>
                  {client.ownerPhone ? <p className="truncate text-label text-fg-muted num">{client.ownerPhone}</p> : null}
                </div>
              </div>
              {ownerEmail || client.ownerPhone ? (
                <div className="grid grid-cols-2 gap-2">
                  {ownerEmail ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        window.location.href = `mailto:${ownerEmail}`;
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
