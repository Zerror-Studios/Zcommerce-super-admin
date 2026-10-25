import { useTenantSyncRows } from "../../hooks/use-platform-analytics";
import { errorPreview } from "../../lib/analytics-health";
import type { Client } from "../../types";
import { AnalyticsHealthChip } from "../analytics/AnalyticsHealthChip";
import { RerunSyncButton } from "../analytics/RerunSyncButton";
import {
  Card,
  ErrorState,
  Skeleton,
  Tooltip,
  cx,
  formatCount,
  formatDate,
  formatDateTime,
  formatPercent,
  toneTextClasses,
} from "../ui";

export interface ClientAnalyticsCardProps {
  client: Client;
  className?: string;
}

/**
 * Store detail › Analytics (PRD-012 FR-8.3): the store's GA4 connection(s)
 * from the sync-monitor rollup (health, data through, last sync, sessions)
 * with "Re-run sync" for manage roles, plus the 30-day traffic figures the
 * usage snapshot already carries. Nothing here reads the tenant database.
 */
export function ClientAnalyticsCard({ client, className }: ClientAnalyticsCardProps) {
  /* ----- Queries & Mutations ----- */
  const api = useTenantSyncRows(client.id);
  const rows = api.data;

  return (
    <Card
      title="Analytics"
      description="Google Analytics 4 sync for this store, from the platform's sync summary"
      className={className}
    >
      <dl className="mb-4 grid grid-cols-3 gap-4">
        <Metric label="Sessions · 30d" value={formatCount(client.sessions30d)} />
        <Metric label="Page views · 30d" value={formatCount(client.pageViews30d)} />
        <Metric
          label="Conversion · 30d"
          value={client.sessions30d > 0 ? formatPercent(client.conversionRate30d) : "—"}
        />
      </dl>

      {api.error ? (
        <ErrorState inline title="Couldn't load the sync status." onRetry={() => void api.refetch()} />
      ) : api.loading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <p className="text-body text-fg-muted">
          No analytics app installed. The store connects Google Analytics 4 from its Apps hub.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {rows.map((row) => {
            const preview = errorPreview(row.lastError);
            return (
              <li key={row.connectionId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AnalyticsHealthChip health={row.health} />
                    <span className="text-body text-fg">Property {row.propertyId}</span>
                  </div>
                  <p className="mt-1 text-caption text-fg-muted">
                    Data through <span className="num">{formatDate(row.dataThrough)}</span> · Last synced{" "}
                    <span className="num">{formatDateTime(row.lastSuccessAt)}</span>
                    {row.backfillTotal > 0 && row.backfillDone < row.backfillTotal ? (
                      <>
                        {" "}· History {formatCount(row.backfillDone)} / {formatCount(row.backfillTotal)} months
                      </>
                    ) : null}
                  </p>
                  {preview ? (
                    <Tooltip content={<span className="block max-w-sm whitespace-pre-wrap break-words">{row.lastError}</span>}>
                      <p className={cx("mt-1 max-w-md truncate text-caption", toneTextClasses.danger)}>{preview}</p>
                    </Tooltip>
                  ) : null}
                </div>
                <RerunSyncButton row={row} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-subtitle font-semibold text-fg num">{value}</dd>
    </div>
  );
}
