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
import { storeProfileOptionLabel } from "../../lib/store-profile.util";
import { useTenantProfile } from "../../hooks/use-tenant-profile";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformStoreSetupCheck } from "../../types/platform-api";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  Chip,
  ProgressRing,
  SummaryPanel,
  formatCount,
  formatMoney,
  formatPercent,
  getHealthBand,
  type SummaryCell,
} from "../ui";
import { IconTip } from "../ui/icons";
import { SkelChip, SkelLine } from "../common/SkeletonBits";
import { NotesCard } from "./NotesCard";
import { lastSyncOf, useStoreApps } from "./use-store-apps";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
  /** The collapsible Setup card (and provisioning), placed after Store health (board 60). */
  setup?: ReactNode;
  /** Go live (domain and checklist), shown under Setup until the store is live. */
  goLive?: ReactNode;
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

/** "Mumbai, Maharashtra" / "Asia/Kolkata · INR": the parts that are set, or null for "Not set". */
const joinSet = (separator: string, ...parts: (string | null | undefined)[]) => {
  const set = parts.map((part) => part?.trim()).filter(Boolean);
  return set.length ? set.join(separator) : null;
};

/** wa.me wants the number in digits only, with the country code. */
const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

const knownEmail = (value: string | undefined) => (value && value.includes("@") ? value : null);

/** The one thing to do, as a plain line with a tip icon (the AI orb is only for real AI output). */
function NextStepLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-card border border-line bg-surface px-3.5 py-2.5">
      <IconTip aria-hidden className="size-4 shrink-0 text-fg-muted" />
      <p className="min-w-0 flex-1 text-label text-fg">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

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
 * Store detail › Overview (design v2 §7, board 60-SA-Store; round 2 §6.3): the one thing to do and "Schedule a call",
 * the summary panel (Sales · 30d, Orders, Products live, Customers), then the main column (Store health: ring + Setup
 * complete, Selling regularly, Team signs in, Payments, Google Analytics with Good / Failing / Stale chips; Setup as a
 * collapsible card; Go live until the store is live) and the side column (Store details, Plan & billing, Owner with
 * Email / WhatsApp, Notes for the team).
 *
 * Kept to what matters at a glance (owner, 2026-11-26): no activity list (Activity log tab), connected apps (Apps
 * tab), performance chart (AI usage tab, with Usage history) or the nightly health-signals card (Store health already
 * reads the same snapshot). The store's details and profile are edited in Settings. Plan usage against the limits is on the Billing tab (board 61 "Plan limits").
 *
 * Customers: the nightly usage snapshot's count (PRD-036 round 2 gaps); "—" until a snapshot has counted them.
 */
export function ClientOverviewTab({ client, subscription, setup, goLive }: ClientOverviewTabProps) {
  const { can } = useAuth();
  const health = getStoreHealth(client);
  // PRD-024 FR-2.1: null growth = nothing sold in the previous 30 days; no change to show.
  const growth = client.growthPercent;
  // PRD-024 FR-1.7: snapshot figures say when they were taken.
  const measured = client.hasUsage !== false;
  const asOf = measured && client.usageAsOf ? `As of ${formatDate(client.usageAsOf)}` : undefined;
  const todo = oneThingToDo(client, subscription);
  const band = getHealthBand(health.score);
  const productLimit = client.planRef?.limits.products ?? null;
  const staffLimit = client.planRef?.limits.staff ?? null;
  const billing = billingStateView(subscription, formatDate);
  const base = `/stores/${client.id}`;
  const ownerEmail = knownEmail(client.ownerEmail);
  // Category, location and account manager (PRD-025 profile; the same cached read as the header's city).
  const profileRead = useTenantProfile(client.id);
  const profile = profileRead.tenant?.profile ?? null;
  const profileLoading = profileRead.loading;

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
        // Rule-based (payments, health, sales, setup), not AI output: a plain tip line, no orb or AI colours.
        <NextStepLine
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
        </NextStepLine>
      ) : null}

      <SummaryPanel cells={cells} storageKey="store:overview" aria-label={`${client.storeName} summary`} />

      <div className={columnsClass}>
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Store health"
            description={healthLoading ? <SkelLine text="text-label" className="w-56" /> : storeHealthLine(band.label, healthRows)}
            leading={
              // Round 3 F4: one number in the ring (the score), not the score drawn over the ring's own "NN%".
              <ProgressRing value={health.score} label={`Store health ${health.score} of 100`} center={health.score} />
            }
          >
            {/* Loading pass: the real rows (labels are known) with the verdict chip and detail as placeholders. */}
            <dl className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle" aria-busy={healthLoading || undefined}>
              {healthRows.map((row) => (
                <div key={row.key} className="flex items-center gap-4 py-2.5">
                  <dt className="flex min-w-0 flex-1 items-center gap-4 text-body text-fg">
                    <span className="w-20 shrink-0">
                      {healthLoading ? (
                        <SkelChip />
                      ) : (
                        <Chip tone={row.tone} dot={false}>
                          {row.word}
                        </Chip>
                      )}
                    </span>
                    <span className="min-w-0 truncate">{row.label}</span>
                  </dt>
                  <dd className="min-w-0 truncate text-right text-label text-fg-muted" title={healthLoading ? undefined : row.detail}>
                    {healthLoading ? <SkelLine text="text-label" className="ml-auto w-24" /> : row.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {setup}

          {goLive}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Store details"
            actions={
              <ButtonLink variant="ghost" size="sm" to={`${base}/settings`}>
                Edit
              </ButtonLink>
            }
          >
            <dl className="flex flex-col" aria-busy={profileLoading || undefined}>
              <Row label="Web address">
                {client.domain ? (
                  <a href={`https://${client.domain}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {client.domain}
                  </a>
                ) : null}
              </Row>
              <Row label="Category">
                {profileLoading ? <SkelLine text="text-body" className="ml-auto w-20" /> : profile?.category ? storeProfileOptionLabel(profile.category) : null}
              </Row>
              <Row label="Location">
                {profileLoading ? <SkelLine text="text-body" className="ml-auto w-24" /> : joinSet(", ", profile?.city, profile?.state)}
              </Row>
              <Row label="Region and currency">{joinSet(" · ", client.timezone, client.currency)}</Row>
              {client.gstin ? (
                <Row label="GSTIN">
                  <span className="num">{client.gstin}</span>
                </Row>
              ) : null}
              <Row label="Account manager">
                {profileLoading ? <SkelLine text="text-body" className="ml-auto w-24" /> : (profile?.accountManager?.name ?? null)}
              </Row>
              <Row label={client.liveAt ? "Live since" : "Planned go-live"}>
                {client.liveAt
                  ? formatDate(client.liveAt)
                  : profileLoading
                    ? <SkelLine text="text-body" className="ml-auto w-20" />
                    : profile?.plannedLiveAt
                      ? formatDate(profile.plannedLiveAt)
                      : null}
              </Row>
            </dl>
          </Card>

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
