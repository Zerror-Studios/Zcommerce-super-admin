/**
 * Home block 5, What needs attention (backend PRD-026 FR-5, FR-7.1, guide
 * §3): three to five bullets written each morning (about 08:45 IST) from
 * the stores on Home's lists. Bullets are plain text; the stores a bullet
 * names link to their pages. Under the card: "Written <IST>" and, when the
 * summary is from an earlier IST day, "from <date>" in amber.
 *
 * It is the brief card of the design kit (the `TodaysBrief` look: AI edge,
 * spectrum avatar). The synced `TodaysBrief` component itself keeps at most
 * three lines and has no per-line links, so this card renders the same
 * frame with every bullet.
 */

import { Link } from "react-router-dom";

import { AiAvatar, Button, Skeleton } from "../../ui";
import { cx } from "../../ui/cx";
import { IconArrowRight } from "../../ui/icons";
import { toneTextClasses } from "../../ui/tones";
import { bulletStoreLinks, summaryState } from "../../../lib/home-attention.util";
import { FIRST_SUMMARY_COPY, formatIst } from "../../../lib/platform-insights.util";
import type { PlatformAttentionSummary } from "../../../types/platform-insights";

export interface AttentionSummaryCardProps {
  summary: PlatformAttentionSummary | null;
  storeNames: Map<string, string>;
  isLoading?: boolean;
  /** Opens Ask ZCOM; omitted without the permission. */
  onAskAi?: () => void;
}

export function AttentionSummaryCard({ summary, storeNames, isLoading = false, onAskAi }: AttentionSummaryCardProps) {
  const state = summaryState(summary);
  return (
    <section aria-label="What needs attention" className="ai-edge flex flex-col gap-3 rounded-panel px-4.5 py-4">
      <div className="flex items-center gap-2.5">
        <AiAvatar />
        <h2 className="flex-1 text-body font-semibold text-fg">What needs attention</h2>
        {onAskAi ? (
          <Button variant="tertiary" size="sm" onPress={onAskAi} endIcon={<IconArrowRight aria-hidden />}>
            Ask ZCOM
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-4/5 rounded-md" />
        </div>
      ) : state.kind === "none" ? (
        <p className="text-body text-fg-muted">{FIRST_SUMMARY_COPY}</p>
      ) : state.kind === "empty" ? (
        <p className="text-body-l text-fg">Nothing needs attention today.</p>
      ) : (
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {state.items.map((item, index) => {
            const links = bulletStoreLinks(item.storeIds, storeNames);
            return (
              <li key={index} className="text-body-l text-fg">
                <span title={item.metricKeys.length ? `Metrics: ${item.metricKeys.join(", ")}` : undefined}>
                  {item.text}
                </span>
                {links.length ? (
                  <span className="ml-2 inline-flex flex-wrap gap-x-2 text-label">
                    {links.map((link) => (
                      <Link
                        key={link.tenantId}
                        to={`/stores/${link.tenantId}`}
                        className="text-brand underline-offset-2 hover:underline"
                      >
                        {link.name}
                      </Link>
                    ))}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {!isLoading && summary && state.kind !== "none" ? (
        <p className="text-caption text-fg-muted">
          {summary.generatedAt ? `Written ${formatIst(summary.generatedAt)}` : "Written this morning"}
          {state.fromDate ? (
            <span className={cx("ml-1", toneTextClasses.warning)}>· from {state.fromDate}</span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

export default AttentionSummaryCard;
