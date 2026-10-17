/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ReactNode } from "react";
import { Button } from "./Button";
import { formatCount } from "./money";

export interface SelectionBarProps {
  /** Number of selected rows. */
  count: number;
  /** Ghost buttons / menus for the bulk actions. */
  children?: ReactNode;
  onClear?: () => void;
}

/**
 * Bulk-action row (docs/design/02-components.md §6): replaces the table toolbar while rows are selected —
 * "3 selected · actions … · Clear selection", same 52px height.
 */
export function SelectionBar({ count, children, onClear }: SelectionBarProps) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-1 border-b border-line bg-surface px-4 py-2">
      <p className="mr-1 text-body font-medium text-fg num">{formatCount(count)} selected</p>
      <span aria-hidden className="mx-1 h-4 w-px bg-line" />
      {children}
      {onClear ? (
        <Button variant="ghost" size="sm" className="ml-auto" onPress={onClear}>
          Clear selection
        </Button>
      ) : null}
    </div>
  );
}
