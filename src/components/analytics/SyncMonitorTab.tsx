import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSyncMonitor } from "../../hooks/use-platform-analytics";
import { backfillPercent, errorPreview } from "../../lib/analytics-health";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import type { SyncMonitorRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { IconApps, IconCheck, IconRefresh } from "../ui/icons";
import {
  Button,
  EmptyState,
  ErrorState,
  KpiStrip,
  StatCard,
  Tooltip,
  cx,
  formatCount,
  formatDate,
  formatDateTime,
  formatPercent,
  toneTextClasses,
  type DataTableColumn,
  type RowMenuItem,
} from "../ui";
import { AnalyticsHealthChip } from "./AnalyticsHealthChip";
import { RerunPendingChip, RerunSyncButton, RerunSyncDialog } from "./RerunSyncButton";
import {
  TableCard,
  TwoLine,
  type AnalyticsTabProps,
} from "./analytics-shared";
import { storeHref } from "./analytics-tab.util";

const MS_PER_SECOND = 1000;

/** "850 ms" under a second, otherwise "1.2 s", for the p95 run duration. */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < MS_PER_SECOND) return `${Math.round(ms)} ms`;
  return `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

/** Fixed 700 → Store 260px at 960px. */
const failingColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "health", label: "Health", width: 150, skeleton: "badge" },
  { key: "failures", label: "Failures in a row", width: 100 },
  { key: "lastSuccess", label: "Last success", width: 150 },
  { key: "quota", label: "Quota paused until", width: 150 },
  { key: "action", label: "Action", width: 150, mobile: "hide" },
];

const backfillColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "progress", label: "Progress", width: 220 },
  { key: "dataThrough", label: "Data through", width: 110 },
  { key: "lastRun", label: "Last run", width: 150 },
  { key: "action", label: "Action", width: 150, mobile: "hide" },
];

/** Fixed 676 → Store 284px at 960px. */
const installationColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "health", label: "Health", width: 110, skeleton: "badge" },
  { key: "lastRun", label: "Last run", width: 150 },
  { key: "runs", label: "Runs · 24h", width: 100 },
  { key: "sessions", label: "Sessions · 7d / 30d", width: 150 },
  { key: "dataThrough", label: "Data through", width: 110, hideWhen: "narrow" },
];

function StoreCell({ row }: { row: SyncMonitorRow }) {
  return <TwoLine main={row.name} sub={`Property ${row.propertyId}`} />;
}

function BackfillCell({ row }: { row: SyncMonitorRow }) {
  const percent = backfillPercent(row.backfillDone, row.backfillTotal);
  if (percent == null) return <span className="text-fg-subtle">—</span>;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-label text-fg-muted num">
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

/** The action column: the xs "Re-run sync" button; clicks don't open the store. */
function ActionCell({ row }: { row: SyncMonitorRow }) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <RerunSyncButton row={row} size="xs" />
    </div>
  );
}

/**
 * Analytics › Sync monitor (04 S-05e, PRD-012 FR-8.3): the analytics sync runs of the last 24 hours, the
 * connections that are failing or quota-paused, history imports in progress, then every installation.
 * "Re-run sync" asks the scheduler for an incremental run (`platform:tenants:manage`). Everything comes from
 * the master `analytics_sync_summary` the worker writes.
 */
export function SyncMonitorTab({ tabRow }: AnalyticsTabProps) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [rerunning, setRerunning] = useState<SyncMonitorRow | null>(null);

  const api = useSyncMonitor();
  const data = api.data;
  const summary = data?.summary;
  const needsAttention = (summary?.error ?? 0) + (summary?.quotaPaused ?? 0);
  const openStore = (row: SyncMonitorRow) => navigate(storeHref(row.tenantId));

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.refetch();
    } catch {
      // The error state below says so.
    } finally {
      setRefreshing(false);
    }
  };

  const installationActions = (row: SyncMonitorRow): RowMenuItem[] => {
    if (row.rerunRequestedAt) {
      return [{ key: "rerun", label: "Re-run pending", icon: IconRefresh, disabled: true, description: `Requested ${formatDateTime(row.rerunRequestedAt)}` }];
    }
    return [{ key: "rerun", label: "Re-run sync", icon: IconRefresh, onSelect: () => setRerunning(row) }];
  };

  const healthWithError = (row: SyncMonitorRow) => {
    const preview = errorPreview(row.lastError, 24);
    return (
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <AnalyticsHealthChip health={row.health} />
        {preview ? (
          <Tooltip content={<span className="block max-w-sm whitespace-pre-wrap break-words">{row.lastError}</span>}>
            <span className={cx("block max-w-full truncate text-caption", toneTextClasses.danger)}>{preview}</span>
          </Tooltip>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      {tabRow(
        <Button
          variant="secondary"
          size="sm"
          startIcon={<IconRefresh aria-hidden />}
          isLoading={refreshing}
          onPress={() => void refresh()}
        >
          Refresh
        </Button>,
      )}

      {api.error ? (
        <ErrorState title="Couldn't load the sync monitor." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : (
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
            <StatCard bare isLoading={api.loading} label="Importing history" value={summary?.backfilling ?? 0} deltaLabel="Backfills in progress" />
            <StatCard
              bare
              isLoading={api.loading}
              label="Run time · p95"
              value={formatDuration(summary?.durationMsP95 ?? 0)}
              deltaLabel={`${formatCount(summary?.quotaTokensToday ?? 0)} quota tokens today`}
            />
          </KpiStrip>

          <TableCard<SyncMonitorRow>
            title="Failing"
            description="Connections in error, or with a failed run in the last 24 hours"
            aria-label="Failing connections"
            columns={failingColumns}
            rows={data?.failing ?? []}
            getRowKey={(row) => row.connectionId}
            isLoading={api.loading}
            rowHeight="tall"
            onRowAction={openStore}
            emptyContent={<EmptyState icon={IconCheck} title="Nothing failing" description="Every connection synced on its last run." />}
            renderCell={(row, key) => {
              switch (key) {
                case "store":
                  return <StoreCell row={row} />;
                case "health":
                  return healthWithError(row);
                case "failures":
                  return (
                    <span className={cx("num", row.consecutiveFailures > 0 && toneTextClasses.danger)}>{formatCount(row.consecutiveFailures)}</span>
                  );
                case "lastSuccess":
                  return <span className="num">{formatDateTime(row.lastSuccessAt)}</span>;
                case "quota":
                  return <span className="num">{formatDateTime(row.quotaPausedUntil)}</span>;
                case "action":
                  return <ActionCell row={row} />;
                default:
                  return null;
              }
            }}
          />

          <TableCard<SyncMonitorRow>
            title="Backfills in progress"
            description="History imports since the app was connected"
            aria-label="Backfills in progress"
            columns={backfillColumns}
            rows={data?.backfills ?? []}
            getRowKey={(row) => row.connectionId}
            isLoading={api.loading}
            rowHeight="tall"
            onRowAction={openStore}
            emptyContent={<EmptyState icon={IconRefresh} title="No imports running" description="No history imports running." />}
            renderCell={(row, key) => {
              switch (key) {
                case "store":
                  return <StoreCell row={row} />;
                case "progress":
                  return <BackfillCell row={row} />;
                case "dataThrough":
                  return <span className="num">{formatDate(row.dataThrough)}</span>;
                case "lastRun":
                  return <span className="num">{formatDateTime(row.lastRunAt)}</span>;
                case "action":
                  return <ActionCell row={row} />;
                default:
                  return null;
              }
            }}
          />

          <TableCard<SyncMonitorRow>
            title="All installations"
            aria-label="All analytics installations"
            columns={installationColumns}
            rows={data?.installations ?? []}
            getRowKey={(row) => row.connectionId}
            isLoading={api.loading}
            rowHeight="tall"
            onRowAction={openStore}
            rowActions={canManage ? installationActions : undefined}
            rowActionsLabel={(row) => `Actions for ${row.name}`}
            emptyContent={
              <EmptyState
                icon={IconApps}
                title="No installations yet"
                description="Stores that connect Google Analytics 4 appear here with their sync runs."
              />
            }
            renderCell={(row, key) => {
              switch (key) {
                case "store":
                  return <StoreCell row={row} />;
                case "health":
                  return row.rerunRequestedAt ? <RerunPendingChip requestedAt={row.rerunRequestedAt} /> : <AnalyticsHealthChip health={row.health} />;
                case "lastRun":
                  return (
                    <div className="min-w-0">
                      <p className="truncate num">{formatDateTime(row.lastRunAt)}</p>
                      <p className="truncate text-label text-fg-muted num">last success {formatDateTime(row.lastSuccessAt)}</p>
                    </div>
                  );
                case "runs":
                  return (
                    <span className="num">
                      {formatCount(row.runs24hCompleted)}
                      {row.runs24hFailed > 0 ? <span className={toneTextClasses.danger}> · {formatCount(row.runs24hFailed)} failed</span> : null}
                    </span>
                  );
                case "sessions":
                  return (
                    <span className="num">
                      {formatCount(row.sessions7d)} / {formatCount(row.sessions30d)}
                    </span>
                  );
                case "dataThrough":
                  return <span className="num">{formatDate(row.dataThrough)}</span>;
                default:
                  return null;
              }
            }}
          />
        </div>
      )}

      <RerunSyncDialog row={rerunning} onClose={() => setRerunning(null)} />
    </div>
  );
}
