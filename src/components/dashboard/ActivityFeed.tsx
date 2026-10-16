import type { ActivityItem, ActivityType } from "../../types";
import { formatDateTime } from "../../lib/utils";
import { Card, Skeleton, cx, toneDotClasses, type Tone } from "../ui";

export interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading?: boolean;
}

/** Status dot per activity type (no icon tiles, docs/design/02-components.md §4). */
const toneMap: Record<ActivityType, Tone> = {
  signup: "success",
  upgrade: "info",
  downgrade: "warning",
  cancellation: "danger",
  failed_payment: "danger",
  payout: "neutral",
  note: "neutral",
};

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <Card title="Recent activity" className="h-full">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ul className="custom-scroll max-h-[420px] divide-y divide-line-subtle overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 py-2.5">
              <span aria-hidden className={cx("mt-2 size-1.5 shrink-0 rounded-full", toneDotClasses[toneMap[item.type]])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-body font-medium text-fg">{item.title}</p>
                  <time className="shrink-0 text-caption text-fg-subtle">{formatDateTime(item.timestamp)}</time>
                </div>
                <p className="text-label text-fg-muted">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
