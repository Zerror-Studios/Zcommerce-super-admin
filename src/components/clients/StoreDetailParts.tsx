/**
 * Small layout pieces of the Store detail sections (04 S-03), local until the kit has them:
 * - KeyValueGrid / KeyValue (01 §7.29): 1–3 columns, label `small` 500 muted over the value, left-aligned; a
 *   missing value reads "Not set". One column on phone.
 * - InlineNotice (02 §9): radius 12, soft tone background, icon, text and an optional tertiary action.
 * - StatTile: the sunken stat tiles of Billing & plan (label `caption` muted, value `kpi-l`).
 * - ExpandableCard (01 §7.29): radius 12, 1px border, padding 12 16; the summary row toggles it, 220ms.
 */
import type { ReactNode } from "react";
import { Skeleton, cx } from "../ui";
import { IconCaret, IconInfo, IconWarning } from "../ui/icons";

// ─── Key / value grid ────────────────────────────────────────────────────────

const GRID_COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
} as const;

export function KeyValueGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  return <dl className={cx("grid gap-x-6 gap-y-4", GRID_COLUMNS[columns], className)}>{children}</dl>;
}

/** One label/value pair; null, undefined or "" shows "Not set". */
export function KeyValue({ label, children, className }: { label: ReactNode; children?: ReactNode; className?: string }) {
  const empty = children == null || children === "" || children === false;
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-label font-medium text-fg-muted">{label}</dt>
      <dd className="mt-1 text-body text-fg wrap-anywhere">{empty ? <span className="text-fg-subtle">Not set</span> : children}</dd>
    </div>
  );
}

// ─── Inline notice ───────────────────────────────────────────────────────────

const NOTICE_TONES = {
  warning: { box: "border-line bg-tone-warning-soft", icon: "text-tone-warning", Icon: IconWarning },
  info: { box: "border-line bg-tone-info-soft", icon: "text-tone-info", Icon: IconInfo },
} as const;

export function InlineNotice({
  tone = "warning",
  children,
  action,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const view = NOTICE_TONES[tone];
  return (
    <div
      role="status"
      className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tile border px-4 py-3", view.box, className)}
    >
      <view.Icon aria-hidden className={cx("size-4 shrink-0", view.icon)} />
      <p className="min-w-0 flex-1 text-label text-fg">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

export function StatTile({ label, value, isLoading = false }: { label: ReactNode; value: ReactNode; isLoading?: boolean }) {
  return (
    <div className="min-w-0 rounded-tile bg-surface-sunken px-4 py-3">
      <p className="text-caption text-fg-muted">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-2 h-6 w-24 rounded-md" />
      ) : (
        <p className="mt-1 truncate text-kpi-l text-fg num">{value}</p>
      )}
    </div>
  );
}

// ─── Expandable card ─────────────────────────────────────────────────────────

export function ExpandableCard({
  summary,
  isExpanded,
  onToggle,
  children,
  label,
}: {
  summary: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  /** Names the toggle for screen readers ("₹2,999 on 27 Oct"). */
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-tile border border-line bg-surface">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-label={label}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-tile px-4 py-3 text-left outline-none focus-visible:shadow-focus-strong"
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <IconCaret
          aria-hidden
          className={cx("size-4 shrink-0 text-fg-subtle transition-transform duration-base", isExpanded && "rotate-180")}
        />
      </button>
      <div
        className={cx(
          "grid transition-[grid-template-rows] duration-base ease-standard",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {isExpanded ? <div className="border-t border-line-subtle px-4 py-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
