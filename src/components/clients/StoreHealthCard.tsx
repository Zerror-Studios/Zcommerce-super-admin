/**
 * Store detail › Health (PRD-025 FR-5, FR-6.3)
 *
 * The store-health block of the newest nightly usage snapshot
 * (`platformUsage.health`): logins, checkout and payment failures, repeat
 * customers, expired unpaid orders, returns and refunds, stock-outs and
 * the event backlog. A figure the job didn't collect reads "Not collected
 * yet"; a snapshot from before PRD-025 has no block at all. Every number
 * is the server's; the store's health score stays in Overview.
 */

import { useQuery } from "@apollo/client";

import { PLATFORM_TENANT_HEALTH } from "../../graphql/store-profile";
import {
  latestHealthSnapshot,
  NO_HEALTH_SNAPSHOT_COPY,
  NOT_COLLECTED_COPY,
  tenantHealthRows,
  type HealthSnapshotLike,
} from "../../lib/tenant-health.util";
import { SkelLine } from "../common/SkeletonBits";
import { Card, EmptyState, ErrorState, cx, formatDate, toneTextClasses } from "../ui";
import { IconStoreHealth } from "../ui/icons";

// ─── Component ────────────────────────────────────────────────────────────

export function StoreHealthCard({ tenantId }: { tenantId: string }) {
  const query = useQuery<{ platformUsage: HealthSnapshotLike[] }>(PLATFORM_TENANT_HEALTH, {
    variables: { tenantId },
    fetchPolicy: "cache-and-network",
  });
  const data = query.data ?? query.previousData;
  const snapshot = latestHealthSnapshot(data?.platformUsage);
  const health = snapshot?.health ?? null;
  const rows = tenantHealthRows(health);

  return (
    <Card
      title="Store health signals"
      description={
        snapshot && health
          ? `From the nightly snapshot · as of ${formatDate(snapshot.date)}`
          : "From the nightly usage snapshot."
      }
    >
      {query.error && !data ? (
        <ErrorState inline title="Couldn't load the health signals." onRetry={() => void query.refetch()} />
      ) : query.loading && !data ? (
        // Loading pass: the real signal labels, the values as placeholders.
        <dl aria-busy className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4">
              <dt className="text-label text-fg-muted">{row.label}</dt>
              <dd className="shrink-0">
                <SkelLine className="w-10" />
              </dd>
            </div>
          ))}
        </dl>
      ) : !health ? (
        <EmptyState compact icon={IconStoreHealth} title="No health snapshot yet" description={NO_HEALTH_SNAPSHOT_COPY} />
      ) : (
        <div className="flex flex-col gap-3">
          {snapshot?.partial ? (
            <p className={cx("text-label", toneTextClasses.warning)}>
              A collector failed; some figures are carried from the previous snapshot.
            </p>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-4">
                <dt className="text-label text-fg-muted">{row.label}</dt>
                <dd
                  className={cx(
                    "text-body num",
                    row.value === null ? "text-fg-subtle" : row.tone === "neutral" ? "text-fg" : toneTextClasses[row.tone],
                  )}
                >
                  {row.value ?? NOT_COLLECTED_COPY}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  );
}

export default StoreHealthCard;
