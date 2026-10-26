/**
 * Sent reminders (PRD-024 FR-3.9, P-08)
 *
 * What the renewal reminders actually did, newest first, from
 * `platformReminderLog`: when, to whom, through which channel and the
 * result (Sent, Queued, or not sent because there is no platform SMS or
 * WhatsApp account). Billing › Reminders lists every store; the store page
 * passes `tenantId`. Needs `platform:billing:read`.
 */

import { useState } from "react";

import { useReminderLog } from "../../hooks/use-platform-reports";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import {
  reminderChannelLabel,
  reminderOffsetLabel,
  reminderResultView,
} from "../../lib/platform-history.util";
import { useAuth } from "../../providers/AuthProvider";
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
  TablePagination,
  cx,
  formatDateTime,
} from "../ui";
import { IconLock, IconSend } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

const REMINDER_LOG_PAGE_SIZE = 20;

// ─── Component ────────────────────────────────────────────────────────────

export interface ReminderLogCardProps {
  /** One store's reminders (the store page); omitted for every store. */
  tenantId?: string;
}

export function ReminderLogCard({ tenantId }: ReminderLogCardProps) {
  const { can } = useAuth();
  const canRead = can(PLATFORM_PERMISSIONS.BILLING_READ);
  const [page, setPage] = useState(1);
  const api = useReminderLog({
    tenantId,
    limit: REMINDER_LOG_PAGE_SIZE,
    offset: (page - 1) * REMINDER_LOG_PAGE_SIZE,
  });
  const rows = api.data;

  if (!canRead) {
    return (
      <Card title="Sent reminders">
        <EmptyState
          compact
          icon={IconLock}
          title="Your role can't see billing"
          description="Ask a platform owner for billing access."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Sent reminders"
      description={
        tenantId
          ? "Renewal reminders for this store, newest first."
          : "Every renewal reminder, newest first: when, to whom and what happened."
      }
      padding="none"
    >
      {api.error && rows.length === 0 ? (
        <div className="p-4">
          <ErrorState inline title="Couldn't load the sent reminders." onRetry={() => void api.refetch()} />
        </div>
      ) : api.loading ? (
        <div className="space-y-3 p-4" role="status" aria-label="Loading sent reminders">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={IconSend}
          title="No reminders sent yet"
          description="Reminders the schedule or a person sends appear here."
        />
      ) : (
        <>
          <ul className={cx("border-t border-line-subtle", api.reloading && "opacity-60")}>
            {rows.map((row) => {
              const result = reminderResultView(row.result);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-subtle px-5 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body text-fg">
                      {tenantId ? row.subject : `${row.tenantName} · ${row.subject}`}
                    </span>
                    <span className="block truncate text-caption text-fg-muted">
                      {reminderChannelLabel(row.channel)} to {row.recipient} · {reminderOffsetLabel(row.offsetDays)}
                      {row.requestedBy === "job" ? " · scheduled" : " · sent by hand"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="whitespace-nowrap text-caption text-fg-muted num">
                      {row.sentAt ? formatDateTime(row.sentAt) : row.createdAt ? formatDateTime(row.createdAt) : "—"}
                    </span>
                    <Chip tone={result.tone}>{result.label}</Chip>
                  </span>
                </li>
              );
            })}
          </ul>
          <TablePagination
            page={page}
            pageSize={REMINDER_LOG_PAGE_SIZE}
            total={api.totalCount}
            onPageChange={setPage}
            isDisabled={api.reloading}
          />
        </>
      )}
    </Card>
  );
}

export default ReminderLogCard;
