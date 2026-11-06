/**
 * Store page › Activity (PRD-024 FR-1.12, P-04; design v2 board 65-SA-Store-Log)
 *
 * The platform audit log for this store (`platformAuditLog` filtered on
 * the tenant as target): who changed what, newest first. Needs
 * `platform:audit:read`; other roles see why it's hidden.
 *
 * - `variant="full"` (Activity log tab, board 65): area chips (Everything
 *   plus the areas in the loaded rows), then the rows grouped by day:
 *   time · grey icon tile · who and what · area. The chips narrow the
 *   loaded rows only; "Load more" reads the next page. Location and
 *   browser columns wait for the audit log to record them.
 * - `variant="compact"` (Overview, board 60): the latest five, the date
 *   and time on the left, with an "Activity log" link to the tab.
 *
 * Round 2 §6.1: each row is a sentence ("Mehak opened Kesar & Kin as
 * admin", `lib/activity-sentences.util`), never the event code.
 */

import { useQuery } from "@apollo/client";
import { useMemo, useState, type ComponentType } from "react";

import { PLATFORM_AUDIT_LOG } from "../../graphql/team";
import {
  nextActivityLimit,
  STORE_ACTIVITY_MAX_ROWS,
  STORE_ACTIVITY_PAGE_SIZE,
  tenantActivityFilter,
} from "../../lib/audit-filter.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { activityIconKey, type ActivityIconKey } from "../../lib/sa-home.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { describeActivity } from "../../lib/activity-sentences.util";
import { ActivitySentence } from "../insights/home/activity-parts";
import {
  Button as UiButton,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  IconAddUser,
  IconAi,
  IconBilling,
  IconClipboard,
  IconLock,
  IconPlans,
  IconSettings,
  IconStore,
  IconTicketPercent,
  IconTile,
  OptionChip,
  Skeleton,
  formatCount,
  formatDate,
  formatDateTime,
  formatDayTime,
  formatTime,
} from "../ui";

// ─── Types ────────────────────────────────────────────────────────────────

interface ActivityRow {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  after?: string | null;
  at: string;
}

interface ActivityData {
  platformAuditLog: { items: ActivityRow[]; totalCount: number };
}

export interface ClientActivityCardProps {
  tenantId: string;
  variant?: "full" | "compact";
  /** Compact only: the Activity log tab's URL for the header link. */
  logHref?: string;
}

// ─── Areas ────────────────────────────────────────────────────────────────

type ActivityArea = "store" | "people" | "money" | "ai" | "settings" | "other";

const AREA_OF: Record<ActivityIconKey, ActivityArea> = {
  store: "store",
  plan: "money",
  coupon: "money",
  billing: "money",
  ai: "ai",
  user: "people",
  auth: "people",
  settings: "settings",
  other: "other",
};

const AREA_LABELS: Record<ActivityArea, string> = {
  store: "Store",
  people: "People",
  money: "Money",
  ai: "Zcom AI",
  settings: "Settings",
  other: "Other",
};

const AREA_ORDER: ActivityArea[] = ["people", "money", "store", "ai", "settings", "other"];

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

const COMPACT_ROWS = 5;

/** "Today", "Yesterday", else "2 Nov". */
function dayLabel(date: Date, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return "Today";
  if (date.getTime() >= startOfToday - 86_400_000) return "Yesterday";
  return formatDate(date, now);
}

interface DayGroup {
  label: string;
  rows: ActivityRow[];
}

function groupByDay(rows: ActivityRow[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  rows.forEach((row) => {
    const date = new Date(row.at);
    const label = Number.isNaN(date.getTime()) ? "Unknown date" : dayLabel(date, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  });
  return groups;
}

const timeOf = (at: string) => {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "—" : formatTime(date);
};

// ─── Component ────────────────────────────────────────────────────────────

export function ClientActivityCard({ tenantId, variant = "full", logHref }: ClientActivityCardProps) {
  const { can, user } = useAuth();
  const { getClient } = useClients();
  const sentence = (row: ActivityRow) =>
    describeActivity(row, { storeName: (id) => getClient(id)?.storeName, viewerEmail: user?.email });
  const canReadAudit = can(PLATFORM_PERMISSIONS.AUDIT_READ);
  const compact = variant === "compact";
  const [limit, setLimit] = useState(compact ? COMPACT_ROWS : STORE_ACTIVITY_PAGE_SIZE);
  const [area, setArea] = useState<ActivityArea | null>(null);
  const query = useQuery<ActivityData>(PLATFORM_AUDIT_LOG, {
    variables: { filter: tenantActivityFilter(tenantId), limit, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip: !canReadAudit,
  });
  const data = query.data ?? query.previousData;
  const rows = useMemo(() => data?.platformAuditLog.items ?? [], [data]);
  const total = data?.platformAuditLog.totalCount ?? 0;
  const canLoadMore = !compact && rows.length < total && limit < STORE_ACTIVITY_MAX_ROWS;

  const areas = useMemo(() => {
    const present = new Set(rows.map((row) => AREA_OF[activityIconKey(row.action)]));
    return AREA_ORDER.filter((key) => present.has(key));
  }, [rows]);
  const shown = area ? rows.filter((row) => AREA_OF[activityIconKey(row.action)] === area) : rows;
  const groups = useMemo(() => groupByDay(shown, new Date()), [shown]);

  if (!canReadAudit) {
    // Overview simply leaves the block out; the Activity log tab says why.
    if (compact) return null;
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

  const body =
    query.error && !data ? (
      <ErrorState inline title="Couldn't load the activity." onRetry={() => void query.refetch()} />
    ) : query.loading && !data ? (
      <div className="space-y-3 p-5" role="status" aria-label="Loading the activity">
        {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    ) : rows.length === 0 ? (
      <EmptyState compact icon={IconLock} title="Nothing logged yet" description="Changes made in the console appear here." />
    ) : null;

  // ─── Overview: the latest five ───
  if (compact) {
    return (
      <Card
        title="Activity"
        padding="none"
        actions={
          logHref ? (
            <ButtonLink variant="ghost" size="sm" to={logHref}>
              Activity log
            </ButtonLink>
          ) : undefined
        }
      >
        {body ?? (
          <ul className="flex flex-col px-5 pb-4">
            {rows.slice(0, COMPACT_ROWS).map((row) => {
              // Board 60: "Today 10:42 AM", "Yesterday", "2 Nov" (round 2 G13).
              const when = formatDayTime(row.at);
              return (
                <li key={row.id} className="flex min-w-0 items-baseline gap-4 py-1.5 text-body">
                  <span className="w-28 shrink-0 text-label text-fg-muted num">{when}</span>
                  <span className="min-w-0 flex-1 max-md:line-clamp-2 md:truncate" title={row.actorEmail}>
                    <ActivitySentence segments={sentence(row)} linkStores={false} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    );
  }

  // ─── Activity log tab ───
  return (
    <div className="flex flex-col gap-3">
      {areas.length > 1 ? (
        <div role="group" aria-label="Show activity for" className="flex flex-wrap gap-2">
          <OptionChip pressed={area == null} onClick={() => setArea(null)}>
            Everything
          </OptionChip>
          {areas.map((key) => (
            <OptionChip key={key} pressed={area === key} onClick={() => setArea(area === key ? null : key)}>
              {AREA_LABELS[key]}
            </OptionChip>
          ))}
        </div>
      ) : null}

      <Card padding="none" className="overflow-clip">
        {body ?? (
          <>
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="border-b border-line-subtle bg-surface-sunken px-5 py-2.5 text-label font-medium text-fg-muted">
                  {group.label}
                </h3>
                <ul className="divide-y divide-line-subtle">
                  {group.rows.map((row) => {
                    const key = activityIconKey(row.action);
                    const Icon = ICONS[key];
                    return (
                      <li key={row.id} className="flex min-h-14 items-center gap-3 px-5 py-2 md:gap-4">
                        <span className="w-14 shrink-0 text-body text-fg-muted num">{timeOf(row.at)}</span>
                        <IconTile tone="neutral" size="sm">
                          <Icon aria-hidden />
                        </IconTile>
                        {/* Phone (v2 §10): two lines, so who and what both show. */}
                        <p className="min-w-0 flex-1 text-body text-fg max-md:line-clamp-2 md:truncate" title={formatDateTime(row.at)}>
                          <ActivitySentence segments={sentence(row)} linkStores={false} />
                        </p>
                        <span className="hidden w-24 shrink-0 text-body text-fg-muted sm:block">{AREA_LABELS[AREA_OF[key]]}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-5 py-3 text-label text-fg-muted">
              <span className="num">
                {area
                  ? `${formatCount(shown.length)} ${AREA_LABELS[area].toLowerCase()} of ${formatCount(rows.length)} loaded`
                  : `Showing ${formatCount(rows.length)} of ${formatCount(total)}`}
              </span>
              {canLoadMore ? (
                <UiButton
                  variant="secondary"
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
    </div>
  );
}

export default ClientActivityCard;
