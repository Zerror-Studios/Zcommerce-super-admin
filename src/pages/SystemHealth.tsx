import { useQuery } from "@apollo/client";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { SkelChip, SkelLine } from "../components/common/SkeletonBits";
import { durationLabel } from "../components/support/support.util";
import {
  CellText,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  SummaryPanel,
  cardFrameClasses,
  cx,
  formatRelative,
  type DataTableColumn,
  type RowMenuItem,
  type SummaryCell,
  type Tone,
} from "../components/ui";
import { IconChartBar, IconStoreHealth } from "../components/ui/icons";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { PLATFORM_SYSTEM_HEALTH } from "../graphql/system-health";

interface Metric {
  available: boolean;
  value: number | null;
  reason: string | null;
}

interface SyncRow {
  tenantId: string;
  storeName: string;
  storeSlug: string;
  provider: string;
  health: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

interface WebhookRow {
  provider: string;
  received7d: number;
  failed7d: number;
  failed24h: number;
  storesAffected: number;
  lastFailedAt: string | null;
}

interface ProviderRow {
  provider: string;
  installs: number;
  errors: number;
  lastError: string | null;
  failedWebhooks7d: number;
  state: string;
}

const STATE_TONE: Record<string, Tone> = { UP: "success", DEGRADED: "warning", DOWN: "danger", NOT_USED: "neutral", UNKNOWN: "neutral" };
const STATE_LABEL: Record<string, string> = { UP: "Up", DEGRADED: "Some failing", DOWN: "Down", NOT_USED: "Not used", UNKNOWN: "Unknown" };
const SYNC_TONE: Record<string, Tone> = { OK: "success", ERROR: "danger", QUOTA_PAUSED: "warning", BACKFILLING: "info", NOT_CONNECTED: "neutral" };
const SYNC_LABEL: Record<string, string> = { OK: "Syncing", ERROR: "Failing", QUOTA_PAUSED: "Paused (quota)", BACKFILLING: "Backfilling", NOT_CONNECTED: "Not connected" };

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

const SYNC_COLUMNS: DataTableColumn<SyncRow>[] = [
  { key: "store", label: "Store", mobile: "primary" },
  { key: "health", label: "Google Analytics sync", width: 190, skeleton: "badge", mobile: "badge" },
  { key: "last", label: "Last good sync", width: 150, mobile: "meta" },
  { key: "error", label: "Last error", width: 280, hideWhen: "narrow" },
];

const WEBHOOK_COLUMNS: DataTableColumn<WebhookRow>[] = [
  { key: "provider", label: "Provider", mobile: "primary" },
  { key: "failed24h", label: "Failed 24 h", width: 120, align: "end", mobile: "value" },
  { key: "failed7d", label: "Failed 7 days", width: 130, align: "end" },
  { key: "received7d", label: "Received 7 days", width: 150, align: "end", hideWhen: "narrow" },
  { key: "stores", label: "Stores hit", width: 110, align: "end", hideWhen: "narrow" },
];

/**
 * Super Admin › System health (board 70, round 2 §6.4): uptime, queue lag, failed webhooks, Google Analytics sync per
 * store and payment provider status, read from data Zcom already keeps (`platformSystemHealth`). Nothing measures
 * uptime, page speed or error rate yet, so those say "Not measured" with the reason instead of a number.
 */
/**
 * Analytics Level 1 §3.7: the old Analytics › System item is gone; its integration, sync and platform-health views
 * keep their URLs and open from this page's ⋯ (they need report access, like every Analytics view).
 */
const SYSTEM_VIEWS: { key: string; label: string; href: string }[] = [
  { key: "integrations", label: "Open Integration health", href: "/analytics/integrations" },
  { key: "sync", label: "Open Sync monitor", href: "/analytics/sync" },
  { key: "health", label: "Open Platform health (snapshot)", href: "/analytics/health" },
];

export function SystemHealth() {
  const { can } = useAuth();
  const more: RowMenuItem[] | undefined = can(PLATFORM_PERMISSIONS.REPORTS_READ)
    ? SYSTEM_VIEWS.map((view) => ({ ...view, icon: IconChartBar }))
    : undefined;
  const { data, loading, error, refetch } = useQuery(PLATFORM_SYSTEM_HEALTH, { fetchPolicy: "cache-and-network", pollInterval: 60_000 });
  const health = data?.platformSystemHealth;
  const uptime: Metric | undefined = health?.uptime;
  const providers: ProviderRow[] = health?.paymentProviders ?? [];
  const failing = providers.filter((row) => row.state === "DOWN" || row.state === "DEGRADED");

  const cells: SummaryCell[] = [
    {
      key: "uptime",
      label: "Uptime",
      value: uptime?.available && uptime.value != null ? `${uptime.value}%` : "Not measured",
      note: uptime?.available ? undefined : "No uptime monitor is connected yet",
    },
    {
      key: "queue",
      label: "Queue lag",
      value: health ? (health.queue.lagSeconds ? durationLabel(health.queue.lagSeconds * 1000) : "None") : "—",
      note: health ? `${health.queue.pending} waiting · ${health.queue.failed} failed (platform events)` : undefined,
      tone: health?.queue.lagging ? "warning" : "default",
    },
    {
      key: "webhooks",
      label: "Failed webhooks",
      value: health?.webhooks.failed24h ?? "—",
      note: health ? `Last 24 h · ${health.webhooks.failed7d} in 7 days` : undefined,
      tone: health?.webhooks.failed24h ? "danger" : "default",
    },
    {
      key: "payments",
      label: "Payment providers",
      value: health ? (failing.length ? `${failing.length} failing` : "All up") : "—",
      note: health ? `${providers.length} in use` : undefined,
      tone: failing.some((row) => row.state === "DOWN") ? "danger" : failing.length ? "warning" : "default",
    },
  ];

  if (error && !health) {
    return (
      <>
        <PageHeader title="System health" icon={<IconStoreHealth aria-hidden />} more={more} moreLabel="More system health views" />
        <ErrorState title="Couldn't load system health." onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="System health"
        icon={<IconStoreHealth aria-hidden />}
        description={health ? `Webhooks, queues, syncs and payment providers · updated ${formatRelative(health.generatedAt)}` : "Webhooks, queues, syncs and payment providers"}
        more={more}
        moreLabel="More system health views"
      />
      <div className="space-y-6">
        <SummaryPanel cells={cells} isLoading={loading && !health} storageKey="system-health" aria-label="System health summary" />

        <section className={cx(cardFrameClasses, "overflow-hidden rounded-card-lg")} aria-labelledby="health-payments">
          <div className="px-5 pb-2 pt-5">
            <h2 id="health-payments" className="text-title-3 text-fg">Payment providers</h2>
            <p className="text-label text-fg-muted">From each store's payment app and its webhooks in the last 7 days</p>
          </div>
          {providers.length ? (
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {providers.map((row) => (
                <li key={row.provider} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-fg">Payments · {titleCase(row.provider)}</span>
                    <span className="block truncate text-label text-fg-muted">
                      {row.installs} {row.installs === 1 ? "store" : "stores"} · {row.errors} in error · {row.failedWebhooks7d} failed webhooks
                      {row.lastError ? ` · ${row.lastError}` : ""}
                    </span>
                  </span>
                  <Chip tone={STATE_TONE[row.state] ?? "neutral"}>{STATE_LABEL[row.state] ?? row.state}</Chip>
                </li>
              ))}
            </ul>
          ) : loading && !health ? (
            // Loading pass: provider rows (name, counts line, state chip) instead of "Loading…".
            <ul aria-busy className="divide-y divide-line-subtle border-t border-line-subtle">
              {[0, 1].map((index) => (
                <li key={index} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <SkelLine className="w-40" />
                    <SkelLine text="text-label" className="w-2/3" />
                  </span>
                  <SkelChip />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-5 text-body text-fg-muted">No store has a payment app installed.</p>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="health-sync">
          <div>
            <h2 id="health-sync" className="text-title-3 text-fg">Google Analytics sync per store</h2>
            {health ? (
              <p className="text-label text-fg-muted">
                {`${health.analyticsSync.healthy} syncing · ${health.analyticsSync.failing} failing · ${health.analyticsSync.paused} paused`}
              </p>
            ) : (
              <SkelLine text="text-label" className="w-56" />
            )}
          </div>
          <DataTable<SyncRow>
            aria-label="Google Analytics sync per store"
            columns={SYNC_COLUMNS}
            rows={health?.analyticsSync.stores ?? []}
            getRowKey={(row) => `${row.tenantId}-${row.provider}`}
            isLoading={loading && !health}
            renderCell={(row, key) => {
              if (key === "store")
                return (
                  <Link to={`/stores/${row.tenantId}/overview`} className="font-medium text-fg hover:underline">
                    {row.storeName || row.storeSlug || row.tenantId}
                  </Link>
                );
              if (key === "health") return <Chip tone={SYNC_TONE[row.health] ?? "neutral"}>{SYNC_LABEL[row.health] ?? row.health}</Chip>;
              if (key === "last") return <CellText>{row.lastSuccessAt ? formatRelative(row.lastSuccessAt) : "Never"}</CellText>;
              return <CellText className="text-fg-muted">{row.lastError ?? "—"}</CellText>;
            }}
            emptyContent={<EmptyState icon={IconStoreHealth} title="No store syncs Google Analytics" description="Stores show here once they connect the Google Analytics app." />}
          />
        </section>

        <section className="space-y-3" aria-labelledby="health-webhooks">
          <h2 id="health-webhooks" className="text-title-3 text-fg">Webhooks by provider</h2>
          <DataTable<WebhookRow>
            aria-label="Webhooks by provider"
            columns={WEBHOOK_COLUMNS}
            rows={health?.webhooks.byProvider ?? []}
            getRowKey={(row) => row.provider}
            isLoading={loading && !health}
            renderCell={(row, key) => {
              if (key === "provider") return <CellText>{titleCase(row.provider)}</CellText>;
              if (key === "failed24h") return <span className={row.failed24h ? "font-medium text-tone-danger-text" : undefined}>{row.failed24h}</span>;
              if (key === "failed7d") return <CellText>{row.failed7d}</CellText>;
              if (key === "received7d") return <CellText>{row.received7d}</CellText>;
              return <CellText>{row.storesAffected}</CellText>;
            }}
            emptyContent={<EmptyState icon={IconStoreHealth} title="No webhooks in the last 7 days" />}
          />
        </section>

        <section className={cx(cardFrameClasses, "space-y-2 rounded-card-lg p-5")} aria-labelledby="health-unmeasured">
          <h2 id="health-unmeasured" className="text-title-3 text-fg">Not measured yet</h2>
          <p className="text-body text-fg-muted">
            Uptime, store page speed and error rate need an uptime or real-user monitor, which isn't connected. They show
            here once one is, instead of guessed numbers.
          </p>
          {health?.jobs?.length ? (
            <p className="text-label text-fg-muted">
              Nightly jobs:{" "}
              {health.jobs
                .map((job: { job: string; status: string; startedAt: string | null }) => `${job.job} ${job.status.toLowerCase()}${job.startedAt ? ` ${formatRelative(job.startedAt)}` : ""}`)
                .join(" · ")}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
