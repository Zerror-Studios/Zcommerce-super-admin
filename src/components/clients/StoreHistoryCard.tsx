/**
 * Store detail › History (PRD-025 FR-3, FR-6.2)
 *
 * The store's lifecycle events newest first (`PlatformTenant.statusHistory`):
 * what happened, when, who did it ("System" for jobs, CLI runs and removed
 * users), the suspension category, reason and note, and an "Estimated
 * date" marker on backfilled rows whose date was inferred. Stores created
 * before PRD-025 show nothing until the one-off backfill runs.
 */

import { useTenantProfile } from "../../hooks/use-tenant-profile";
import {
  ESTIMATED_MARKER_COPY,
  HISTORY_EMPTY_COPY,
  statusHistoryRows,
} from "../../lib/store-history.util";
import { Card, Chip, EmptyState, ErrorState, Skeleton, formatDateTime } from "../ui";
import { IconTime } from "../ui/icons";

// ─── Component ────────────────────────────────────────────────────────────

export function StoreHistoryCard({ tenantId }: { tenantId: string }) {
  const read = useTenantProfile(tenantId);
  const rows = statusHistoryRows(read.tenant?.statusHistory);

  return (
    <Card title="History" description="Lifecycle changes, newest first." padding="none">
      {read.error && !read.tenant ? (
        <ErrorState inline title="Couldn't load the history." onRetry={() => void read.refetch()} />
      ) : read.loading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={IconTime}
          title={HISTORY_EMPTY_COPY.title}
          description={HISTORY_EMPTY_COPY.description}
        />
      ) : (
        <ol className="border-t border-line-subtle" aria-label="Status history">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-line-subtle px-5 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Chip tone={row.tone}>{row.label}</Chip>
                  <span className="text-caption text-fg-muted">by {row.by}</span>
                  {row.estimated ? (
                    <Chip tone="neutral" dot={false}>
                      {ESTIMATED_MARKER_COPY}
                    </Chip>
                  ) : null}
                </span>
                {row.details.length > 0 ? (
                  <span className="text-caption text-fg-muted wrap-anywhere">{row.details.join(" · ")}</span>
                ) : null}
              </div>
              <time dateTime={row.at} className="whitespace-nowrap text-caption text-fg-muted num">
                {formatDateTime(row.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default StoreHistoryCard;
