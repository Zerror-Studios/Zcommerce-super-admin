/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { IconClose } from "./icons";
import { formatCount } from "./money";

export interface SelectionBarProps {
  /** Number of selected rows. */
  count: number;
  /** The bulk actions: secondary sm buttons, then a destructive-secondary sm one (01 §7.14). */
  children?: ReactNode;
  onClear?: () => void;
  /** Rows matching the current view across every page; with onSelectAll shows "Select all 12,480". */
  total?: number;
  onSelectAll?: () => void;
}

/**
 * Bulk bar (01 §7.14): replaces the table toolbar while rows are selected, same 52px row — "3 selected" (14/500),
 * tertiary "Select all 219", the bulk actions on the right, then a ghost circle × "Clear selection".
 */
export function SelectionBar({ count, children, onClear, total, onSelectAll }: SelectionBarProps) {
  return (
    <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-wrap items-center gap-2 border-b border-line-subtle bg-surface px-4 py-2">
      <p className="text-body font-medium text-fg num" aria-live="polite">
        {formatCount(count)} selected
      </p>
      {onSelectAll && total != null && total > count ? (
        <Button variant="tertiary" size="sm" onPress={onSelectAll}>
          Select all {formatCount(total)}
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        {onClear ? (
          <IconButton aria-label="Clear selection" variant="ghost" size="sm" onPress={onClear}>
            <IconClose aria-hidden />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}
