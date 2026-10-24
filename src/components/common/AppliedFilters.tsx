import type { ReactNode } from "react";
import { Button as UiButton } from "../ui";
import { IconClose } from "../ui/icons";

/**
 * Active filters as chips under the table toolbar, with "Clear all" at the end
 * (docs/design/09-settings-and-scale.md §3.1). Renders nothing without chips.
 */
export interface AppliedFilterItem {
  key: string;
  label: ReactNode;
  onRemove: () => void;
}

export function AppliedFilter({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface pl-2.5 pr-1 text-label text-fg">
      {children}
      <button
        type="button"
        aria-label="Remove filter"
        onClick={onRemove}
        className="inline-flex size-5 items-center justify-center rounded-sm text-fg-muted transition-colors duration-instant hover:bg-surface-sunken hover:text-fg"
      >
        <IconClose aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

export function AppliedFilters({ items, onClearAll }: { items: AppliedFilterItem[]; onClearAll: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
      {items.map((item) => (
        <AppliedFilter key={item.key} onRemove={item.onRemove}>
          {item.label}
        </AppliedFilter>
      ))}
      <UiButton variant="link" size="sm" onPress={onClearAll}>
        Clear all
      </UiButton>
    </div>
  );
}
