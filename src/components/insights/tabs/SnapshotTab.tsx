/**
 * One snapshot tab (backend PRD-026 FR-7.3, guide §1, §4, §7): Money,
 * Retention, Platform health, Usage, Merchant sales or AI cost.
 *
 * - The page passes the snapshot of the chosen period (`platformMetrics`).
 *   Before the first snapshot the tab says when it runs; a tab whose
 *   section didn't come back for this viewer explains why (guide §2).
 * - KPI cells (OK / SMALL_SAMPLE / UNAVAILABLE, as `MetricCard`): the first
 *   four in the summary panel, the rest in white "lite" rows of four
 *   (design v2 §4.2), then
 *   breakdown cards, then the tab's store lists (each row links to the
 *   store; risk reasons as tags; lifecycle as a chip).
 * - Merchant sales says when sales are known only from a date (`gmv`'s
 *   reason); TODAY's sales are UNAVAILABLE from the server as they are.
 */

import { Link } from "react-router-dom";

import { Card, Chip, EmptyState, ErrorState, Skeleton, SummaryPanel, Tooltip, type SummaryCell } from "../../ui";
import { IconLock } from "../../ui/icons";
import { toneTextClasses } from "../../ui/tones";
import { TableCard } from "../../analytics/analytics-shared";
import { useSummaryKey } from "../../../hooks/use-summary-key";
import {
  FIRST_SNAPSHOT_COPY,
  findMetric,
  lifecycleLabel,
  lifecycleTone,
  metricHelp,
  riskReasonLabel,
} from "../../../lib/platform-insights.util";
import type {
  PlatformMetric,
  PlatformMetricsSnapshot,
  PlatformMetricsStoreRow,
} from "../../../types/platform-insights";
import { MetricBreakdown } from "./SnapshotBreakdowns";
import {
  chunkCells,
  daysText,
  isTabAvailable,
  listValueText,
  metricSummaryText,
  SUMMARY_CELLS,
  snapshotTabConfig,
  splitMetrics,
  tabMetrics,
  type SnapshotListConfig,
  type SnapshotTab as SnapshotTabKey,
} from "./snapshot-tabs.util";

export interface SnapshotTabProps {
  tab: SnapshotTabKey;
  snapshot: PlatformMetricsSnapshot | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

// ─── Store lists ──────────────────────────────────────────────────────────

function StoreListCard({ config, rows }: { config: SnapshotListConfig; rows: PlatformMetricsStoreRow[] }) {
  const columns = [
    { key: "store", label: "Store" },
    { key: "status", label: "Status", width: 140 },
    ...(config.value !== "none"
      ? [{ key: "value", label: config.value === "currency" ? "Amount" : "Change", width: 140, align: "end" as const }]
      : []),
    ...(config.daysLabel ? [{ key: "days", label: config.daysLabel, width: 170 }] : []),
    ...(config.risk ? [{ key: "risk", label: "Warning signs", width: 360 }] : []),
    ...(config.detail ? [{ key: "detail", label: "Detail", width: 240 }] : []),
  ];
  return (
    <TableCard<PlatformMetricsStoreRow>
      title={config.title}
      description={config.description}
      aria-label={config.title}
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.tenantId}
      renderCell={(row, key) => {
        switch (key) {
          case "store":
            return (
              <Link to={`/stores/${row.tenantId}`} className="font-medium text-fg hover:underline">
                {row.name}
              </Link>
            );
          case "status":
            return row.status ? (
              <Chip tone={lifecycleTone(row.status)}>{lifecycleLabel(row.status)}</Chip>
            ) : (
              "—"
            );
          case "value":
            return <span className="num">{listValueText(row.value, config.value)}</span>;
          case "days":
            return <span className="num">{daysText(row.days)}</span>;
          case "risk":
            return (
              <div className="flex flex-wrap items-center gap-1">
                <Tooltip content="Risk score: the sum of the warning signs' points">
                  <span className="mr-1 font-medium num">{row.score ?? 0}</span>
                </Tooltip>
                {(row.reasons ?? []).map((reason) => (
                  <Chip key={reason} tone="warning" dot={false}>
                    {riskReasonLabel(reason)}
                  </Chip>
                ))}
              </div>
            );
          case "detail":
            return <span className="text-fg-muted">{row.detail ?? "—"}</span>;
          default:
            return null;
        }
      }}
      emptyContent={<EmptyState compact description="No stores in this list for the period." />}
    />
  );
}

// ─── Summary cells ────────────────────────────────────────────────────────

/** A metric as a summary cell; its definition and formula stay on the label's tooltip. */
function metricCell(metric: PlatformMetric, threshold: number | null | undefined): SummaryCell {
  const text = metricSummaryText(metric, threshold);
  const help = metricHelp(metric);
  return {
    key: metric.key,
    label: help ? (
      <Tooltip content={<span className="whitespace-pre-line">{help}</span>} placement="top-start">
        <span className="cursor-help border-b border-dashed border-current">{metric.label}</span>
      </Tooltip>
    ) : (
      metric.label
    ),
    value: text.value,
    note: text.note ?? undefined,
    tone: text.tone,
  };
}

// ─── Tab ──────────────────────────────────────────────────────────────────

export function SnapshotTab({ tab, snapshot, loading, error, onRetry }: SnapshotTabProps) {
  const config = snapshotTabConfig(tab);
  const summaryKey = useSummaryKey(`analytics-${tab}`);

  if (loading && !snapshot) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-card-lg" />
        <Skeleton className="h-64 w-full rounded-card-lg" />
      </div>
    );
  }
  if (error && !snapshot) {
    return <ErrorState title="Couldn't load the platform snapshot." onRetry={onRetry} />;
  }
  if (!snapshot) {
    return (
      <Card>
        <EmptyState title="No snapshot yet" description={FIRST_SNAPSHOT_COPY} />
      </Card>
    );
  }
  if (!isTabAvailable(snapshot, tab)) {
    return (
      <Card>
        <EmptyState
          icon={IconLock}
          title={`${config.label} isn't available to your role`}
          description="Ask a platform owner for access."
        />
      </Card>
    );
  }

  const { cells, breakdowns } = splitMetrics(tabMetrics(snapshot, tab));
  const threshold = snapshot.smallSampleThreshold;
  const gmv = tab === "merchant-sales" ? findMetric(snapshot.sections, "gmv") : null;

  return (
    <div className="flex flex-col gap-4">
      {gmv?.reason && gmv.status !== "UNAVAILABLE" ? (
        <p role="note" className={`text-label ${toneTextClasses.info}`}>
          {gmv.reason}
        </p>
      ) : null}

      {cells.length ? (
        <SummaryPanel
          cells={cells.slice(0, SUMMARY_CELLS).map((metric) => metricCell(metric, threshold))}
          storageKey={summaryKey}
          aria-label={`${config.label} summary`}
        />
      ) : null}
      {chunkCells(cells.slice(SUMMARY_CELLS), SUMMARY_CELLS).map((row, index) => (
        <SummaryPanel
          key={`lite-${index}`}
          variant="lite"
          cells={row.map((metric) => metricCell(metric, threshold))}
          aria-label={`${config.label}: more figures`}
        />
      ))}

      {breakdowns.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {breakdowns.map((metric) => (
            <div key={metric.key} className={metric.key === "tenureCohorts" ? "lg:col-span-2" : undefined}>
              <MetricBreakdown metric={metric} smallSampleThreshold={threshold} />
            </div>
          ))}
        </div>
      ) : null}

      {config.lists.map((list) => (
        <StoreListCard key={list.key} config={list} rows={snapshot.lists[list.key] ?? []} />
      ))}
    </div>
  );
}

export default SnapshotTab;
