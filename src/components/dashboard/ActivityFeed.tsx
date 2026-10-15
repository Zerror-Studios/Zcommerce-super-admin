import { Skeleton } from "@heroui/react";
import type { IconType } from "react-icons";
import type { ActivityItem, ActivityType } from "../../types";
import { formatDateTime } from "../../lib/utils";
import { IconAddUser, IconArrowDownCircle, IconBlock, IconPayments, IconUpgrade } from "../ui/icons";
import { CardWrapper } from "../ui/CardWrapper";

export interface ActivityFeedProps {
  items: ActivityItem[];
  isLoading?: boolean;
}

const iconMap: Record<ActivityType, IconType> = {
  signup: IconAddUser,
  upgrade: IconUpgrade,
  downgrade: IconArrowDownCircle,
  cancellation: IconBlock,
  failed_payment: IconPayments,
  payout: IconPayments,
  note: IconAddUser,
};

const colorMap: Record<ActivityType, string> = {
  signup: "bg-success/15 text-success",
  upgrade: "bg-primary/15 text-primary",
  downgrade: "bg-warning/15 text-warning",
  cancellation: "bg-danger/15 text-danger",
  failed_payment: "bg-danger/15 text-danger",
  payout: "bg-secondary/15 text-secondary",
  note: "bg-default-100 text-default-600",
};

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <CardWrapper title="Recent activity" description="Signups, upgrades, cancellations & payments" className="h-full">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="custom-scroll max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {items.map((item) => {
              const Icon = iconMap[item.type];
              return (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-default-50"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorMap[item.type]}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-body font-bold">{item.title}</p>
                      <time className="shrink-0 text-[11px] text-default-400">
                        {formatDateTime(item.timestamp)}
                      </time>
                    </div>
                    <p className="text-caption text-default-500">{item.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </CardWrapper>
  );
}
