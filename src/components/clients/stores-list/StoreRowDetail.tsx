/**
 * Stores › a row opened in place (design v2 §1A "SA Stores", §7, board 59): four small cards under the row:
 * Sales · 30 days, the store's numbers, its apps, and what to do (the store insight with the orb, or the warning
 * signs), with Message owner and Open store. A store in setup also gets its setup and go-live links, which is
 * where today's onboarding actions live (setup checklist, provisioning retry, domain and Mark live).
 *
 * Read only when the row opens: the apps come from `platformIntegrationHealth` (one call per opened row; audit
 * Q13, keep it off `PlatformTenants`). Everything else is already on the loaded store.
 *
 * Backend gaps (hidden, not faked): the board's daily sales bars (only monthly snapshots exist), Customers, and
 * products live of total (one products figure).
 */

import { Link } from "react-router-dom";
import { getAppProviderLabel } from "../../../lib/display-labels.util";
import { storeInsight } from "../../../lib/aiSamples";
import { NO_PREVIOUS_SALES_COPY } from "../../../lib/store-sales";
import { getStoreHealth } from "../../../lib/storeHealth";
import type { Client, Subscription } from "../../../types";
import { IntegrationStatusChip } from "../../analytics/AnalyticsHealthChip";
import {
  Button,
  ButtonLink,
  Orb,
  Skeleton,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  getHealthBand,
  toneTextClasses,
  useAiEnabled,
} from "../../ui";
import { IconMessages, IconNextPage } from "../../ui/icons";
import { lastSyncOf, needsAttention, useStoreApps } from "../use-store-apps";
import { isInSetup } from "./stores-tabs.util";

const APPS_SHOWN = 3;

export interface StoreRowDetailProps {
  client: Client;
  subscription?: Subscription;
  /** Why the store is at risk, in words ("Payment owed · Warning signs: no orders in 14 days"). */
  riskText?: string;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-4">
      <h3 className="text-label text-fg-muted">{title}</h3>
      {children}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-body">
      <span className="text-fg-muted">{label}</span>
      <span className="num font-medium text-fg">{value}</span>
    </div>
  );
}

function AppsCard({ client }: { client: Client }) {
  const apps = useStoreApps(client);
  const appsHref = `/stores/${client.id}/apps`;
  const sorted = [...apps.rows].sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));
  const lastSync = lastSyncOf(apps.rows);
  return (
    <DetailCard title="Apps">
      {apps.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      ) : apps.error ? (
        <p className="text-label text-fg-muted">Couldn&apos;t load the apps.</p>
      ) : sorted.length === 0 ? (
        <p className="text-label text-fg-muted">No apps connected yet.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {sorted.slice(0, APPS_SHOWN).map((row) => (
              <li key={row.connectionId} className="flex items-center justify-between gap-3 text-body">
                <span className="min-w-0 truncate text-fg">{getAppProviderLabel(row.provider)}</span>
                <IntegrationStatusChip status={row.status} />
              </li>
            ))}
          </ul>
          <p className="text-label text-fg-muted">
            {sorted.length > APPS_SHOWN ? (
              <Link to={appsHref} className="text-brand hover:underline">
                {formatCount(sorted.length - APPS_SHOWN)} more
              </Link>
            ) : null}
            {sorted.length > APPS_SHOWN && lastSync ? " · " : null}
            {lastSync ? <span className="num">Last sync {formatDate(lastSync)}</span> : null}
          </p>
        </>
      )}
    </DetailCard>
  );
}

export function StoreRowDetail({ client, subscription, riskText }: StoreRowDetailProps) {
  const base = `/stores/${client.id}`;
  const measured = client.hasUsage !== false;
  const health = getStoreHealth(client);
  const band = getHealthBand(health.score);
  const limits = client.planRef?.limits;
  const aiEnabled = useAiEnabled();
  const insight = aiEnabled ? storeInsight(client, subscription) : null;
  const setup = isInSetup(client);
  const growth = client.growthPercent;

  const ofLimit = (used: number | null | undefined, limit: number | null | undefined) =>
    used == null ? "—" : limit ? `${formatCount(used)} of ${formatCount(limit)}` : formatCount(used);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <DetailCard title="Sales · last 30 days">
        <p className="num text-title-2 text-fg">{measured ? formatMoney(client.revenue, { whole: true }) : "—"}</p>
        <p className="text-label text-fg-muted num">
          {!measured
            ? "No usage snapshot yet"
            : growth == null
              ? NO_PREVIOUS_SALES_COPY
              : `${growth >= 0 ? "Up" : "Down"} ${formatPercent(Math.abs(growth))} on the 30 days before`}
        </p>
        <Figure label="Orders · 30d" value={measured ? formatCount(client.orders30d) : "—"} />
        {measured && client.usageAsOf ? (
          <p className="text-label text-fg-subtle num">As of {formatDate(client.usageAsOf)}</p>
        ) : null}
      </DetailCard>

      <DetailCard title="Store">
        <Figure label="Products" value={measured ? ofLimit(client.usage.products, limits?.products) : "—"} />
        <Figure label="Team" value={measured ? ofLimit(client.staffCount, limits?.staff) : "—"} />
        <Figure
          label="Health"
          value={
            <span className={band.tone === "success" ? undefined : toneTextClasses[band.tone === "danger" ? "danger" : "warning"]}>
              {health.score} · {band.label}
            </span>
          }
        />
      </DetailCard>

      <AppsCard client={client} />

      {/* The insight-line fill (§4.8) as a small card: light blue, the orb, one finding, then the next step. */}
      <section className="flex min-w-0 flex-col gap-3 rounded-card border border-ai-line-border bg-[image:var(--zc-ai-line-bg)] p-4">
        <div className="flex items-start gap-2">
          {insight ? <Orb /> : null}
          <div className="min-w-0 text-body">
            {insight ? (
              <>
                <p className="font-medium text-fg">{insight.title}</p>
                <p className="text-fg-muted">{insight.body}</p>
              </>
            ) : setup ? (
              <>
                <p className="font-medium text-fg">Still in setup.</p>
                <p className="text-fg-muted">Finish the checklist and verify the domain to go live.</p>
              </>
            ) : riskText ? (
              <>
                <p className="font-medium text-fg">Needs a look.</p>
                <p className="text-fg-muted">{riskText}</p>
              </>
            ) : (
              <p className="text-fg-muted">Nothing needs doing right now.</p>
            )}
          </div>
        </div>
        {setup ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-label">
            <Link to={`${base}/overview#setup`} className="text-brand hover:underline">
              Setup checklist
            </Link>
            <Link to={`${base}/overview#go-live`} className="text-brand hover:underline">
              Go live
            </Link>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {client.ownerEmail ? (
            <Button
              variant="secondary"
              size="sm"
              startIcon={<IconMessages aria-hidden />}
              onPress={() => {
                window.location.href = `mailto:${client.ownerEmail}`;
              }}
            >
              Message owner
            </Button>
          ) : null}
          <ButtonLink to={`${base}/overview`} variant="primary" size="sm" endIcon={<IconNextPage aria-hidden />}>
            Open store
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
