/**
 * Home › Recent activity (design v2 §7, board 02-V4-SA-Home; round 2 §6.1):
 * the latest platform changes from the audit log (`platformAuditLog`, newest
 * first) as plain sentences with an icon per kind of change ("Mehak opened
 * Kesar & Kin as admin"), the store bold and linked. Repeats by one person
 * within 10 minutes are one row ("Mehak opened 2 stores as admin"). Times
 * read "10:42 AM", "Yesterday", "2 Nov". "Activity log" opens Settings ›
 * Audit log. Needs `platform:audit:read`; the caller hides it otherwise.
 */
import { useQuery } from "@apollo/client";
import { useMemo } from "react";

import { ButtonLink, ErrorState, IconTile, Skeleton } from "../../ui";
import { useLoadView } from "../../../hooks/use-load-view";
import { PLATFORM_AUDIT_LOG } from "../../../graphql/team";
import { groupActivity, type ActivityEntry } from "../../../lib/activity-sentences.util";
import { activityWhen } from "../../../lib/sa-home.util";
import { useAuth } from "../../../providers/AuthProvider";
import { useClients } from "../../../providers/ClientsProvider";
import { ACTIVITY_ICONS, ActivitySentence } from "./activity-parts";

interface ActivityData {
  platformAuditLog: { items: ActivityEntry[]; totalCount: number };
}

/** Rows shown; more are read so repeats can be grouped first. */
const ROWS = 5;
const READ = 20;

export function RecentActivityCard() {
  const { getClient } = useClients();
  const { user } = useAuth();
  const query = useQuery<ActivityData>(PLATFORM_AUDIT_LOG, {
    variables: { limit: READ, offset: 0 },
    fetchPolicy: "cache-and-network",
  });
  const data = query.data ?? query.previousData;
  const rows = useMemo(
    () =>
      groupActivity(data?.platformAuditLog.items ?? [], {
        storeName: (id) => getClient(id)?.storeName,
        viewerEmail: user?.email,
      }).slice(0, ROWS),
    [data, getClient, user?.email],
  );
  const view = useLoadView(query.loading, data != null);

  return (
    <section aria-label="Recent activity" className="flex flex-col rounded-card-lg border border-line bg-surface pb-1.5">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4.5">
        <h2 className="text-title-3 text-fg">Recent activity</h2>
        <ButtonLink variant="ghost" size="sm" to="/settings/audit">
          Activity log
        </ButtonLink>
      </div>

      {query.error && !data ? (
        <ErrorState inline title="Couldn't load the activity." onRetry={() => void query.refetch()} />
      ) : view.skeleton ? (
        // Loading pass (2026-11-10): the loaded list's 5 rows (tile, sentence, time), invisible for the first 200ms.
        <ul aria-label="Loading the activity" className={view.hold ? "invisible" : undefined}>
          {Array.from({ length: ROWS }, (_, index) => (
            <li key={index} className="flex min-h-15 items-center gap-3 border-t border-line-subtle px-5 py-2">
              <Skeleton className="size-9 shrink-0 rounded-tile" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-3 w-14 shrink-0 rounded-md" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="border-t border-line-subtle px-5 py-4 text-label text-fg-muted">
          Nothing logged yet. Changes made in the console appear here.
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const Icon = ACTIVITY_ICONS[row.kind];
            return (
              <li key={row.id} className="flex min-h-15 items-center gap-3 border-t border-line-subtle px-5 py-2">
                <IconTile tone="neutral" size="md">
                  <Icon aria-hidden />
                </IconTile>
                {/* Phone: two lines, so the sentence still shows next to the time. */}
                <p className="min-w-0 flex-1 text-body max-md:line-clamp-2 md:truncate">
                  <ActivitySentence segments={row.segments} />
                </p>
                <span className="shrink-0 whitespace-nowrap font-mono text-caption uppercase text-fg-subtle num">
                  {activityWhen(row.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default RecentActivityCard;
