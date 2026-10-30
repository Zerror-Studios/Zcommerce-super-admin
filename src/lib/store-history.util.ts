/**
 * Store status history for the console (PRD-025 FR-3, FR-6.2)
 *
 * Turns `PlatformTenant.statusHistory` into the rows the store page's
 * History card lists: a label and tone per kind, the actor ("System" when
 * the server sends none: a job, a CLI run or a removed user), the
 * category / reason / note details and the "estimated" marker that only
 * backfilled rows with an inferred date carry.
 */

import type { Tone } from "../components/ui/tones";
import type {
  TenantStatusEvent,
  TenantStatusEventKind,
  TenantSuspendCategory,
} from "../types/platform-api";
import { suspendCategoryLabel } from "./tenant-lifecycle.util";

// ─── Constants ────────────────────────────────────────────────────────────

export const STATUS_EVENT_LABELS: Readonly<Record<TenantStatusEventKind, string>> = {
  CREATED: "Created",
  LIVE: "Went live",
  SUSPENDED: "Suspended",
  REACTIVATED: "Reactivated",
  DELETED: "Deleted",
  RESTORED: "Restored",
  PURGED: "Purged",
};

export const STATUS_EVENT_TONES: Readonly<Record<TenantStatusEventKind, Tone>> = {
  CREATED: "info",
  LIVE: "success",
  SUSPENDED: "warning",
  REACTIVATED: "success",
  DELETED: "danger",
  RESTORED: "info",
  PURGED: "danger",
};

export const SYSTEM_ACTOR_LABEL = "System";

export const ESTIMATED_MARKER_COPY = "Estimated date";

export const HISTORY_EMPTY_COPY = {
  title: "No history recorded before the backfill",
  description:
    "Lifecycle changes made from now on appear here; the one-off backfill adds the earlier ones.",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────

export interface StatusHistoryRow {
  key: string;
  kind: TenantStatusEventKind;
  label: string;
  tone: Tone;
  at: string;
  /** The platform user's name, or "System". */
  by: string;
  /** Category, reason and note, in that order, when present. */
  details: string[];
  estimated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function statusEventLabel(kind: string): string {
  return STATUS_EVENT_LABELS[kind as TenantStatusEventKind] ?? kind;
}

export function statusEventTone(kind: string): Tone {
  return STATUS_EVENT_TONES[kind as TenantStatusEventKind] ?? "neutral";
}

/** The rows newest first (the server sends them so; sorted again to be safe). */
export function statusHistoryRows(
  events: readonly TenantStatusEvent[] | null | undefined,
): StatusHistoryRow[] {
  return [...(events ?? [])]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((event, index) => {
      const details: string[] = [];
      if (event.category) {
        details.push(suspendCategoryLabel(event.category as TenantSuspendCategory));
      }
      if (event.reason) details.push(event.reason);
      if (event.note) details.push(event.note);
      return {
        key: `${event.kind}:${event.at}:${index}`,
        kind: event.kind,
        label: statusEventLabel(event.kind),
        tone: statusEventTone(event.kind),
        at: event.at,
        by: event.by?.name?.trim() || SYSTEM_ACTOR_LABEL,
        details,
        estimated: event.estimated === true,
      };
    });
}
