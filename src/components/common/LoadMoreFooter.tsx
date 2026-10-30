/**
 * "Showing N of M · Load more" under a list the API pages (PRD-014 FE-09).
 */

import { Button as UiButton } from "../ui";

export interface LoadMoreFooterProps {
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => Promise<void>;
  /** What the rows are, e.g. "payments". */
  noun: string;
}

export function LoadMoreFooter({
  shown,
  total,
  hasMore,
  loading,
  onLoadMore,
  noun,
}: LoadMoreFooterProps) {
  if (!hasMore) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-caption text-fg-muted">
      <span className="num">
        Showing {shown} of {total} {noun}
      </span>
      <UiButton
        variant="secondary"
        size="sm"
        isLoading={loading}
        onPress={() => void onLoadMore().catch(() => undefined)}
      >
        Load more
      </UiButton>
    </div>
  );
}

export default LoadMoreFooter;
