import type { ReactNode } from "react";
import { SearchInput } from "../../ui";

export interface StoresToolbarProps {
  /** The segmented status switch, on the left. */
  tabs: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  /** Filter and Columns, or the Deleted tab's view switch. */
  children?: ReactNode;
}

/**
 * Row 1 of the Stores table card (01 §7.14): 52px, the status switch on the left; search (32px × 240), then the
 * page's controls on the right, 8px apart. Search and the controls move to a second row when they can't fit.
 */
export function StoresToolbar({ tabs, search, onSearchChange, children }: StoresToolbarProps) {
  return (
    <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-col gap-2 border-b border-line-subtle bg-surface px-4 py-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
      <div className="flex min-w-0 items-center overflow-x-auto">{tabs}</div>
      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
        <SearchInput
          placement="toolbar"
          placeholder="Search stores or owners"
          value={search}
          onValueChange={onSearchChange}
          onClear={() => onSearchChange("")}
        />
        {children}
      </div>
    </div>
  );
}
