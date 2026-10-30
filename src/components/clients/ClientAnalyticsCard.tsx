import { useTenantSyncRows } from "../../hooks/use-platform-analytics";
import { errorPreview } from "../../lib/analytics-health";
import type { Client } from "../../types";
import { AnalyticsHealthChip } from "../analytics/AnalyticsHealthChip";
import { RerunSyncButton } from "../analytics/RerunSyncButton";
import {
  Card,
  ErrorState,
  KpiStrip,
  Skeleton,
  StatCard,
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
}

/**
 * Store detail › Analytics (PRD-012 FR-8.3, 04 S-03f): the 30-day traffic figures from the usage snapshot as a
 * 3-cell KPI strip, then the store's GA4 connection from the sync-monitor rollup (health badge, property, data
 * through, last sync) with "Re-run sync" in the card header for manage roles. Nothing here reads the tenant
 * database.
 */
export function ClientAnalyticsCard({ client }: ClientAnalyticsCardProps) {
  const api = useTenantSyncRows(client.id);
  const rows = api.data;
  // One connection is the normal case: its re-run goes in the card header; several keep one button per row.
  const single = rows.length === 1 ? rows[0] : null;

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip>
        <StatCard bare label="Sessions · 30d" value={formatCount(client.sessions30d)} deltaLabel={null} />
        <StatCard bare label="Page views · 30d" value={formatCount(client.pageViews30d)} deltaLabel={null} />
        <StatCard
          bare
          label="Conversion · 30d"
          value={client.sessions30d > 0 ? formatPercent(client.conversionRate30d) : "—"}
          deltaLabel={null}
        />
      </KpiStrip>

      <Card
        title="Google Analytics 4"
        description="From the platform's sync summary."
        actions={single ? <RerunSyncButton row={single} /> : undefined}
      >
        {api.error ? (
          <ErrorState inline title="Couldn't load the sync status." onRetry={() => void api.refetch()} />
        ) : api.loading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
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
                      <span className="text-body font-medium text-fg">Property {row.propertyId}</span>
                    </div>
                    <p className="mt-1 text-label text-fg-muted">
                      Data through <span className="num">{formatDate(row.dataThrough)}</span> · Last synced{" "}
                      <span className="num">{formatDateTime(row.lastSuccessAt)}</span>
                      {row.backfillTotal > 0 && row.backfillDone < row.backfillTotal ? (
                        <>
                          {" "}· History {formatCount(row.backfillDone)} / {formatCount(row.backfillTotal)} months
                        </>
                      ) : null}
                    </p>
                    {preview ? (
                      <Tooltip content={<span className="block max-w-sm whitespace-pre-wrap wrap-break-word">{row.lastError}</span>}>
                        <p className={cx("mt-1 max-w-md truncate text-label", toneTextClasses.danger)}>{preview}</p>
                      </Tooltip>
                    ) : null}
                  </div>
                  {single ? null : <RerunSyncButton row={row} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
