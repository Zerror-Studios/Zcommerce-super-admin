/**
 * Activity rows in sentences (round 2 §6.1): the icon per kind of change and
 * the sentence with its store bold and linked. Used by Home › Recent activity
 * and the store page's Activity card.
 */

import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import {
  IconAddUser,
  IconAi,
  IconApps,
  IconBilling,
  IconClipboard,
  IconDelete,
  IconGift,
  IconLock,
  IconLogin,
  IconMarketing,
  IconOrders,
  IconPause,
  IconPlans,
  IconRocket,
  IconSettings,
  IconStore,
  IconSupport,
  IconTicketPercent,
  IconView,
} from "../../ui";
import type { ActivityKind, ActivitySegment } from "../../../lib/activity-sentences.util";

export const ACTIVITY_ICONS: Record<ActivityKind, ComponentType<{ "aria-hidden"?: boolean }>> = {
  admin: IconLogin,
  view: IconView,
  store: IconStore,
  live: IconRocket,
  pause: IconPause,
  delete: IconDelete,
  team: IconAddUser,
  billing: IconBilling,
  credit: IconGift,
  plan: IconPlans,
  coupon: IconTicketPercent,
  ai: IconAi,
  auth: IconLock,
  settings: IconSettings,
  apps: IconApps,
  support: IconSupport,
  order: IconOrders,
  announce: IconMarketing,
  other: IconClipboard,
};

/** The sentence: plain text muted, the store in medium ink, linked to its page. */
export function ActivitySentence({ segments, linkStores = true }: { segments: readonly ActivitySegment[]; linkStores?: boolean }) {
  return (
    <>
      {segments.map((segment, index) =>
        typeof segment === "string" ? (
          <span key={index} className="text-fg-muted">
            {segment}
          </span>
        ) : linkStores ? (
          <Link key={index} to={`/stores/${segment.storeId}`} className="font-medium text-fg underline-offset-2 hover:underline">
            {segment.name}
          </Link>
        ) : (
          <span key={index} className="font-medium text-fg">
            {segment.name}
          </span>
        ),
      )}
    </>
  );
}
