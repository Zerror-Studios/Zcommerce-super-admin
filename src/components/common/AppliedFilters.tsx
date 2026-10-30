import type { ReactNode } from "react";
import { Button as UiButton, FilterChip } from "../ui";

/**
 * Applied filters as blue capsule chips under the table toolbar, with "Clear all" at the end (01 §7.12). Renders nothing without chips.
 */
export interface AppliedFilterItem {
  key: string;
  label: ReactNode;
  onRemove: () => void;
}

export function AppliedFilter({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return <FilterChip onRemove={onRemove}>{children}</FilterChip>;
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
      <UiButton variant="tertiary" size="sm" onPress={onClearAll}>
        Clear all
      </UiButton>
    </div>
  );
}
