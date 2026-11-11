/**
 * Pieces shared by the Analytics tabs (04 S-05): the chart tooltip, full ₹ axis labels (01 §7.25: never "k",
 * "L" or "Cr"), the change cell, a titled table card built on DataTable, and the tab-row / export hooks the
 * Analytics page hands to each tab.
 */
import type { ReactNode } from "react";
import { NO_PREVIOUS_SALES_COPY } from "../../lib/store-sales";
import { emptyStates } from "../../copy";
import {
  DataTable,
  EmptyState,
  Tooltip,
  cx,
  formatDelta,
  toneTextClasses,
  type DataTableProps,
} from "../ui";

// ─── Page wiring ─────────────────────────────────────────────────────────────

/** Renders the Analytics tab row (switch left) with this tab's period control on the right. */
export type AnalyticsTabRow = (right?: ReactNode) => ReactNode;

/** A tab hands the header's Export button its export, or null while there is nothing to export. */
export type RegisterExport = (exporter: (() => void) | null) => void;

export interface AnalyticsTabProps {
  tabRow: AnalyticsTabRow;
  registerExport?: RegisterExport;
}

// ─── Charts ──────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | null;
  color?: string;
  name?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatLabel?: (label: string) => string;
  formatValue: (value: number | null | undefined, key: string) => string;
}

/** One tooltip style everywhere (01 §7.25): the date, then one row per series with its colour dot. */
export function ChartTooltip({ active, payload, label, formatLabel, formatValue }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1 text-caption text-fg-subtle">{formatLabel ? formatLabel(String(label)) : label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-body text-fg">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
          <span className="text-label text-fg-muted">{entry.name ?? entry.dataKey}</span>
          <span className="ml-auto pl-3 font-medium num">{formatValue(entry.value, String(entry.dataKey))}</span>
        </p>
      ))}
    </div>
  );
}

/** Empty chart (01 §7.25): a flat baseline with the line centred. */
export function ChartEmpty() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <span aria-hidden className="absolute inset-x-4 bottom-8 border-t border-line" />
      <p className="text-label text-fg-subtle">{emptyStates.noData}</p>
    </div>
  );
}

// ─── Cells ───────────────────────────────────────────────────────────────────

/** PRD-024 FR-2.1: a null change is "—" with the reason, never −100 % or +100 %. */
export function ChangeCell({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <Tooltip content={NO_PREVIOUS_SALES_COPY}>
        <span className="text-fg-subtle num">—</span>
      </Tooltip>
    );
  }
  const tone = value === 0 ? undefined : value > 0 ? toneTextClasses.success : toneTextClasses.danger;
  return <span className={cx("num", tone)}>{formatDelta(value)}</span>;
}

/** Name + grey second line (slug, property, reason). */
export function TwoLine({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-fg">{main}</p>
      {sub ? <p className="truncate text-label text-fg-muted">{sub}</p> : null}
    </div>
  );
}

/** The live "Not enough data for this period yet." inside a table. */
export function NoDataEmpty() {
  return <EmptyState compact description={emptyStates.noData} />;
}

// ─── Titled table card ───────────────────────────────────────────────────────

export interface TableCardProps<T> extends Omit<DataTableProps<T>, "toolbar"> {
  title: ReactNode;
  description?: ReactNode;
  /** Right side of the card header. */
  actions?: ReactNode;
}

/** A card with a title whose table runs edge to edge (01 §7.13); the table is the shared DataTable. */
export function TableCard<T>({ title, description, actions, ...table }: TableCardProps<T>) {
  return (
    <DataTable
      {...table}
      toolbar={
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <h3 className="text-title-3 text-fg">{title}</h3>
            {description != null ? <p className="mt-0.5 text-label text-fg-muted">{description}</p> : null}
          </div>
          {actions != null ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      }
    />
  );
}

/** 24px logo tile for gateways and apps: the name's first letter until the kit has provider logos. */
export function LogoTile({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-sunken text-caption font-semibold text-fg-muted"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Where a card's numbers come from (Analytics Level 1 §4): a small grey chip on the right of the card header. */
export type AnalyticsSource = "orders" | "mixed" | "billing";

const SOURCE_LABELS: Record<AnalyticsSource, string> = {
  orders: "Store orders",
  mixed: "Orders and Google Analytics",
  billing: "Zcom billing",
};

export function SourceChip({ source }: { source: AnalyticsSource }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-xs bg-surface-sunken px-1.5 text-caption text-fg-muted">
      {SOURCE_LABELS[source]}
    </span>
  );
}
