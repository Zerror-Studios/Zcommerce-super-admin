/**
 * Home › Recent activity (design v2 §7, board 02-V4-SA-Home): the latest
 * platform changes from the audit log (`platformAuditLog`, newest first),
 * each with a grey icon tile for its area, the store it touched (linked)
 * or who made it, and when. "Activity log" opens Settings › Audit log.
 * Needs `platform:audit:read`; the caller hides it otherwise. Readable
 * action names wait for Check first 05 #6, so the action is the event code,
 * as on the audit log page.
 */

import { useQuery } from "@apollo/client";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import {
  ButtonLink,
  ErrorState,
  IconAi,
  IconAddUser,
  IconBilling,
  IconClipboard,
  IconLock,
  IconPlans,
  IconSettings,
  IconStore,
  IconTicketPercent,
  IconTile,
  Skeleton,
} from "../../ui";
import { PLATFORM_AUDIT_LOG } from "../../../graphql/team";
import { activityIconKey, activityWhen, type ActivityIconKey } from "../../../lib/sa-home.util";
import { useClients } from "../../../providers/ClientsProvider";

interface ActivityRow {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  at: string;
}

interface ActivityData {
  platformAuditLog: { items: ActivityRow[]; totalCount: number };
}

const ROWS = 5;

const ICONS: Record<ActivityIconKey, ComponentType<{ "aria-hidden"?: boolean }>> = {
  store: IconStore,
  plan: IconPlans,
  coupon: IconTicketPercent,
  ai: IconAi,
  user: IconAddUser,
  auth: IconLock,
  settings: IconSettings,
  billing: IconBilling,
  other: IconClipboard,
};

export function RecentActivityCard() {
  const { getClient } = useClients();
  const query = useQuery<ActivityData>(PLATFORM_AUDIT_LOG, {
    variables: { limit: ROWS, offset: 0 },
    fetchPolicy: "cache-and-network",
  });
  const data = query.data ?? query.previousData;
  const rows = data?.platformAuditLog.items ?? [];

  return (
    <section aria-label="Recent activity" className="flex flex-col rounded-card-lg border border-line bg-surface pb-1.5">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4.5">
        <h2 className="text-title-3 text-fg">Recent activity</h2>
        <ButtonLink variant="tertiary" size="sm" to="/settings/audit">
          Activity log
        </ButtonLink>
      </div>

      {query.error && !data ? (
        <ErrorState inline title="Couldn't load the activity." onRetry={() => void query.refetch()} />
      ) : query.loading && !data ? (
        <ul aria-label="Loading the activity">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="flex min-h-15 items-center gap-3 border-t border-line-subtle px-5">
              <Skeleton className="size-9 rounded-tile" />
              <Skeleton className="h-4 flex-1 rounded-md" />
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
            const Icon = ICONS[activityIconKey(row.action)];
            const store = row.targetType === "tenant" && row.targetId ? getClient(row.targetId) : undefined;
            return (
              <li key={row.id} className="flex min-h-15 items-center gap-3 border-t border-line-subtle px-5 py-2">
                <IconTile tone="neutral" size="md">
                  <Icon aria-hidden />
                </IconTile>
                {/* Phone: two lines, so the action and who did it still show next to the time. */}
                <p className="min-w-0 flex-1 text-body text-fg max-md:line-clamp-2 md:truncate">
                  {store ? (
                    <Link to={`/stores/${store.id}`} className="font-medium underline-offset-2 hover:underline">
                      {store.storeName}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.actorEmail}</span>
                  )}{" "}
                  <span className="text-fg-muted">
                    {row.action}
                    {store ? ` · by ${row.actorEmail}` : ""}
                  </span>
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
