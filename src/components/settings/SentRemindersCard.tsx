/**
 * Settings › Payments & billing rules › Sent reminders (04 S-07f change 4, PRD-024 FR-3.9): the last 20 renewal
 * reminders across all stores, newest first (`platformReminderLog` without a store), and "Show all" in a drawer
 * with 30 a page. Needs `platform:billing:read`.
 */
import { useState } from "react";
import { useReminderLog } from "../../hooks/use-platform-reports";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { reminderChannelLabel, reminderResultView } from "../../lib/platform-history.util";
import { useAuth } from "../../providers/AuthProvider";
import type { PlatformReminderLogEntry } from "../../types/platform-api";
import {
  Button,
  Card,
  Chip,
  DEFAULT_PAGE_SIZE,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  ErrorState,
  Skeleton,
  TablePagination,
  cx,
  formatDateTime,
} from "../ui";
import { IconExpand } from "../ui/icons";

const CARD_LIMIT = 20;

function ReminderRow({ row }: { row: PlatformReminderLogEntry }) {
  const result = reminderResultView(row.result);
  const at = row.sentAt ?? row.createdAt;
  return (
    <li className="flex min-h-16 items-center justify-between gap-4 border-b border-line-subtle px-5 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-body-strong text-fg">{row.tenantName}</span>
          <span className="min-w-0 truncate text-body text-fg-muted" title={row.subject}>
            {row.subject}
          </span>
        </p>
        <p className="truncate text-label text-fg-muted num">
          {reminderChannelLabel(row.channel)} · {at ? formatDateTime(at) : "—"} · {row.requestedBy === "job" ? "scheduled" : "by hand"}
        </p>
      </div>
      <Chip tone={result.tone} className="shrink-0">
        {result.label}
      </Chip>
    </li>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3 px-5 pb-5" role="status" aria-label="Loading sent reminders">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function SentRemindersCard() {
  const { can } = useAuth();
  const [allOpen, setAllOpen] = useState(false);
  const api = useReminderLog({ limit: CARD_LIMIT, offset: 0 });

  if (!can(PLATFORM_PERMISSIONS.BILLING_READ)) return null;

  return (
    <Card
      id="sent-reminders"
      data-settings-field
      title="Sent reminders"
      description="Every renewal reminder across the stores, newest first."
      padding="none"
      actions={
        api.totalCount > 0 ? (
          <Button variant="tertiary" size="sm" endIcon={<IconExpand aria-hidden />} onPress={() => setAllOpen(true)}>
            Show all
          </Button>
        ) : undefined
      }
    >
      {api.error && api.data.length === 0 ? (
        <div className="px-5 pb-5">
          <ErrorState inline title="Couldn't load the sent reminders." onRetry={() => void api.refetch()} />
        </div>
      ) : api.loading ? (
        <RowsSkeleton rows={3} />
      ) : api.data.length === 0 ? (
        <p className="px-5 pb-5 text-body text-fg-muted">No reminders sent yet.</p>
      ) : (
        <ul className={cx("border-t border-line-subtle", api.reloading && "opacity-60")}>
          {api.data.map((row) => (
            <ReminderRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Drawer isOpen={allOpen} onOpenChange={setAllOpen} size="sm">
        <DrawerContent>
          <DrawerHeader>Sent reminders</DrawerHeader>
          <DrawerBody className="px-0">{allOpen ? <AllReminders /> : null}</DrawerBody>
        </DrawerContent>
      </Drawer>
    </Card>
  );
}

/** The drawer list: 30 a page, newest first. */
function AllReminders() {
  const [page, setPage] = useState(1);
  const api = useReminderLog({ limit: DEFAULT_PAGE_SIZE, offset: (page - 1) * DEFAULT_PAGE_SIZE });
  if (api.error && api.data.length === 0) {
    return <ErrorState inline title="Couldn't load the sent reminders." onRetry={() => void api.refetch()} />;
  }
  if (api.loading) return <RowsSkeleton rows={6} />;
  return (
    <>
      <ul className={cx(api.reloading && "opacity-60")}>
        {api.data.map((row) => (
          <ReminderRow key={row.id} row={row} />
        ))}
      </ul>
      <TablePagination page={page} pageSize={DEFAULT_PAGE_SIZE} total={api.totalCount} onPageChange={setPage} isDisabled={api.reloading} />
    </>
  );
}
