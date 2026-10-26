import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useSyncMonitor } from "../../hooks/use-platform-analytics";
import { backfillPercent, errorPreview } from "../../lib/analytics-health";
import type { SyncMonitorRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { IconApps, IconRefresh } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  EmptyState,
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
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import { AnalyticsHealthChip } from "./AnalyticsHealthChip";
import { RerunSyncButton } from "./RerunSyncButton";

const MS_PER_SECOND = 1000;

const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

const right = "block text-right num";

/** "850 ms" under a second, otherwise "1.2 s", for the p95 run duration. */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < MS_PER_SECOND) return `${Math.round(ms)} ms`;
  return `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

function StoreCell({ row }: { row: SyncMonitorRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap font-medium text-fg">{row.name}</p>
      <p className="truncate text-caption text-fg-subtle">Property {row.propertyId}</p>
    </div>
  );
}

function ErrorCell({ error }: { error: string | null }) {
  const preview = errorPreview(error);
  if (!preview) return <span className="text-fg-subtle">—</span>;
  return (
    <Tooltip content={<span className="block max-w-sm whitespace-pre-wrap break-words">{error}</span>}>
      <span className={cx("block max-w-xs truncate text-caption", toneTextClasses.danger)}>{preview}</span>
    </Tooltip>
  );
}

function BackfillCell({ row }: { row: SyncMonitorRow }) {
  const percent = backfillPercent(row.backfillDone, row.backfillTotal);
  if (percent == null) return <span className="text-fg-subtle">—</span>;
  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <span className="text-caption text-fg-muted num">
        {formatCount(row.backfillDone)} / {formatCount(row.backfillTotal)} months · {formatPercent(percent, 0)}
      </span>
      <div
        role="progressbar"
        aria-label={`History import for ${row.name}`}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Analytics › Sync monitor (PRD-012 FR-8.3): the analytics sync runs of the
 * last 24 hours, the connections that are failing or quota-paused, history
 * imports in progress, then every installation. "Re-run sync" asks the
 * scheduler for an incremental run (`platform:tenants:manage`). Everything
 * comes from the master `analytics_sync_summary` the worker writes.
 */
export function SyncMonitorTab() {
  const navigate = useNavigate();

  /* ----- Queries & Mutations ----- */
  const api = useSyncMonitor();
  const data = api.data;
  const summary = data?.summary;
  const openStore = (tenantId: string) => navigate(`/stores/${tenantId}`);
  const needsAttention = (summary?.error ?? 0) + (summary?.quotaPaused ?? 0);

  // Stop the row click (open the store) from firing under the action button.
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <div>
      <PageHeader
        title="Sync monitor"
        description="Analytics sync runs in the last 24 hours, failing connections and history imports."
        actions={
          <UiButton variant="ghost" startIcon={<IconRefresh aria-hidden />} onPress={() => void api.refetch()}>
            Refresh
          </UiButton>
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load the sync monitor." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <div className="space-y-4">
        <KpiStrip>
          <StatCard
            bare
            isLoading={api.loading}
            label="Installations"
            value={summary?.installations ?? 0}
            deltaLabel={`${formatCount(summary?.healthy ?? 0)} synced on the last run`}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Runs · 24h"
            value={(summary?.runs24hCompleted ?? 0) + (summary?.runs24hFailed ?? 0)}
            deltaLabel={
              <span className={cx((summary?.runs24hFailed ?? 0) > 0 && toneTextClasses.danger)}>
                {formatCount(summary?.runs24hFailed ?? 0)} failed
              </span>
            }
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Needs attention"
            value={needsAttention}
            valueTone={needsAttention > 0 ? "danger" : "default"}
            deltaLabel={`${formatCount(summary?.error ?? 0)} failing · ${formatCount(summary?.quotaPaused ?? 0)} quota paused`}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Importing history"
            value={summary?.backfilling ?? 0}
            deltaLabel="Backfills in progress"
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Run time · p95"
            value={formatDuration(summary?.durationMsP95 ?? 0)}
            deltaLabel={`${formatCount(summary?.quotaTokensToday ?? 0)} quota tokens today`}
          />
        </KpiStrip>

        <Card title="Failing" description="Connections in error, or with a failed run in the last 24 hours" padding="none" className="overflow-hidden">
          {api.loading ? (
            <TableSkeleton />
          ) : (
            <Table aria-label="Failing connections" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Store</TableColumn>
                <TableColumn>Health</TableColumn>
                <TableColumn align="end">Failures in a row</TableColumn>
                <TableColumn>Last success</TableColumn>
                <TableColumn>Quota paused until</TableColumn>
                <TableColumn>Last error</TableColumn>
                <TableColumn align="end">Action</TableColumn>
              </TableHeader>
              <TableBody
                items={data?.failing ?? []}
                emptyContent={<EmptyState compact description="Every connection synced on its last run." />}
              >
                {(row) => (
                  <TableRow key={row.connectionId} className="cursor-pointer" onClick={() => openStore(row.tenantId)}>
                    <TableCell><StoreCell row={row} /></TableCell>
                    <TableCell><AnalyticsHealthChip health={row.health} /></TableCell>
                    <TableCell>
                      <span className={cx(right, row.consecutiveFailures > 0 && toneTextClasses.danger)}>{formatCount(row.consecutiveFailures)}</span>
                    </TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.lastSuccessAt)}</span></TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.quotaPausedUntil)}</span></TableCell>
                    <TableCell><ErrorCell error={row.lastError} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end" onClick={stop}>
                        <RerunSyncButton row={row} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="Backfills in progress" description="History imports since the app was connected" padding="none" className="overflow-hidden">
          {api.loading ? (
            <TableSkeleton />
          ) : (
            <Table aria-label="Backfills in progress" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Store</TableColumn>
                <TableColumn>Progress</TableColumn>
                <TableColumn>Data through</TableColumn>
                <TableColumn>Last run</TableColumn>
                <TableColumn align="end">Action</TableColumn>
              </TableHeader>
              <TableBody
                items={data?.backfills ?? []}
                emptyContent={<EmptyState compact description="No history imports running." />}
              >
                {(row) => (
                  <TableRow key={row.connectionId} className="cursor-pointer" onClick={() => openStore(row.tenantId)}>
                    <TableCell><StoreCell row={row} /></TableCell>
                    <TableCell><BackfillCell row={row} /></TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDate(row.dataThrough)}</span></TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.lastRunAt)}</span></TableCell>
                    <TableCell>
                      <div className="flex justify-end" onClick={stop}>
                        <RerunSyncButton row={row} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="All installations" padding="none" className="overflow-hidden">
          {api.loading ? (
            <TableSkeleton />
          ) : (
            <Table aria-label="All analytics installations" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Store</TableColumn>
                <TableColumn>Health</TableColumn>
                <TableColumn>Last run</TableColumn>
                <TableColumn>Last success</TableColumn>
                <TableColumn align="end">Runs · 24h</TableColumn>
                <TableColumn align="end">Sessions · 7d</TableColumn>
                <TableColumn align="end">Sessions · 30d</TableColumn>
                <TableColumn>Data through</TableColumn>
                <TableColumn align="end">Action</TableColumn>
              </TableHeader>
              <TableBody
                items={data?.installations ?? []}
                emptyContent={
                  <EmptyState
                    icon={IconApps}
                    title="No installations yet"
                    description="Stores that connect Google Analytics 4 appear here with their sync runs."
                  />
                }
              >
                {(row) => (
                  <TableRow key={row.connectionId} className="cursor-pointer" onClick={() => openStore(row.tenantId)}>
                    <TableCell><StoreCell row={row} /></TableCell>
                    <TableCell><AnalyticsHealthChip health={row.health} /></TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.lastRunAt)}</span></TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDateTime(row.lastSuccessAt)}</span></TableCell>
                    <TableCell>
                      <span className={right}>
                        {formatCount(row.runs24hCompleted)}
                        {row.runs24hFailed > 0 ? (
                          <span className={toneTextClasses.danger}> · {formatCount(row.runs24hFailed)} failed</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell><span className={right}>{formatCount(row.sessions7d)}</span></TableCell>
                    <TableCell><span className={right}>{formatCount(row.sessions30d)}</span></TableCell>
                    <TableCell><span className="whitespace-nowrap num">{formatDate(row.dataThrough)}</span></TableCell>
                    <TableCell>
                      <div className="flex justify-end" onClick={stop}>
                        <RerunSyncButton row={row} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
