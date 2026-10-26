/**
 * Store page › Activity (PRD-024 FR-1.12, P-04)
 *
 * The platform audit log for this store (`platformAuditLog` filtered on
 * the tenant as target): who changed what, newest first. Needs
 * `platform:audit:read`; other roles see why it's hidden.
 */

import { useQuery } from "@apollo/client";
import { useState } from "react";

import { PLATFORM_AUDIT_LOG } from "../../graphql/team";
import {
  nextActivityLimit,
  STORE_ACTIVITY_MAX_ROWS,
  STORE_ACTIVITY_PAGE_SIZE,
  tenantActivityFilter,
} from "../../lib/audit-filter.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import {
  Button as UiButton,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  formatDateTime,
} from "../ui";
import { IconLock } from "../ui/icons";

// ─── Types ────────────────────────────────────────────────────────────────

interface ActivityRow {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  at: string;
}

interface ActivityData {
  platformAuditLog: { items: ActivityRow[]; totalCount: number };
}

// ─── Component ────────────────────────────────────────────────────────────

export function ClientActivityCard({ tenantId }: { tenantId: string }) {
  const { can } = useAuth();
  const canReadAudit = can(PLATFORM_PERMISSIONS.AUDIT_READ);
  const [limit, setLimit] = useState(STORE_ACTIVITY_PAGE_SIZE);
  const query = useQuery<ActivityData>(PLATFORM_AUDIT_LOG, {
    variables: { filter: tenantActivityFilter(tenantId), limit, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip: !canReadAudit,
  });
  const data = query.data ?? query.previousData;
  const rows = data?.platformAuditLog.items ?? [];
  const total = data?.platformAuditLog.totalCount ?? 0;
  const canLoadMore = rows.length < total && limit < STORE_ACTIVITY_MAX_ROWS;

  if (!canReadAudit) {
    return (
      <Card title="Activity">
        <EmptyState
          compact
          icon={IconLock}
          title="Your role can't see the audit log"
          description="The owner, admins and read-only members can."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Activity"
      description="Platform changes to this store, newest first."
      padding="none"
    >
      {query.error && !data ? (
        <ErrorState
          inline
          title="Couldn't load the activity."
          onRetry={() => void query.refetch()}
        />
      ) : query.loading && !data ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={IconLock}
          title="Nothing logged yet"
          description="Changes made in the console appear here."
        />
      ) : (
        <>
          <ul className="border-t border-line-subtle">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-subtle px-5 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-label text-fg">
                    {row.action}
                  </span>
                  <span className="block truncate text-caption text-fg-muted">
                    {row.actorEmail}
                  </span>
                </span>
                <span className="whitespace-nowrap text-caption text-fg-muted num">
                  {formatDateTime(row.at)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-5 py-3 text-caption text-fg-muted">
            <span className="num">
              Showing {rows.length} of {total}
            </span>
            {canLoadMore ? (
              <UiButton
                variant="ghost"
                size="sm"
                isLoading={query.loading}
                onPress={() => setLimit((current) => nextActivityLimit(current))}
              >
                Load more
              </UiButton>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

export default ClientActivityCard;
