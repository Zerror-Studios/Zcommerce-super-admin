/**
 * "Last updated <IST> · Refresh now" (backend PRD-026, guide §1, §5), for
 * Home and every snapshot tab. Stale snapshots (the server's `stale`, over
 * 26 hours) read "Last updated N h ago" in amber; before the first one it
 * says when it runs. Refresh now shows a spinner while it runs, "Updated
 * just now" after, and stays off until `refreshAvailableAt`. Hidden
 * without `platform:reports:read`.
 */

import { Button } from "../ui";
import { cx } from "../ui/cx";
import { IconRefresh } from "../ui/icons";
import { toneTextClasses } from "../ui/tones";
import { useRefreshPlatformMetrics } from "../../hooks/use-platform-insights";
import { formatIstTime, lastUpdatedText } from "../../lib/platform-insights.util";

export interface SnapshotHeaderProps {
  computedAt: string | null | undefined;
  stale: boolean;
  className?: string;
}

export function SnapshotHeader({ computedAt, stale, className }: SnapshotHeaderProps) {
  const refresh = useRefreshPlatformMetrics();
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-label", className)}>
      <span
        role="status"
        className={stale && computedAt ? toneTextClasses.warning : "text-fg-muted"}
      >
        {refresh.justUpdated ? "Updated just now" : lastUpdatedText(computedAt, stale)}
      </span>
      {refresh.canRefresh ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            startIcon={<IconRefresh aria-hidden />}
            isLoading={refresh.refreshing}
            isDisabled={refresh.coolingDown}
            onPress={() => void refresh.refresh()}
          >
            Refresh now
          </Button>
          {refresh.coolingDown && refresh.refreshAvailableAt && !refresh.error ? (
            <span className="text-caption text-fg-muted">
              Available at {formatIstTime(refresh.refreshAvailableAt)}
            </span>
          ) : null}
          {refresh.error ? (
            <span role="alert" className={cx("text-caption", toneTextClasses.warning)}>
              {refresh.error}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default SnapshotHeader;
