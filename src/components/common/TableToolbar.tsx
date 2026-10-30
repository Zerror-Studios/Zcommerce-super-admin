import { Checkbox, CheckboxGroup, DropdownItem, DropdownTrigger } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { SearchInput } from "../ui/SearchInput";
import { IconColumns } from "../ui/icons";
import {
  FilterButton,
  FilterDrawer,
  IconButton as UiIconButton,
  Dropdown as UiDropdown,
  DropdownMenu as UiDropdownMenu,
} from "../ui";
import { tableCheckboxClassNames } from "../ui/table-styles";

export interface TableColumnOption {
  key: string;
  label: string;
}

export interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  columns?: TableColumnOption[];
  visibleColumns?: string[];
  onVisibleColumnsChange?: (keys: string[]) => void;
  /** The filter fields; they open in the filter drawer from the right (01 §7.15) and apply as they change. */
  filterContent?: ReactNode;
  /** Applied filters: the button reads "Filter · 2". */
  filterCount?: number;
  /** "Clear all" in the filter drawer: clears every filter at once. */
  onClearFilters?: () => void;
  endContent?: ReactNode;
  /** Status tabs on the left of the same row (docs/design/02-components.md §6). */
  tabs?: ReactNode;
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  filterContent,
  filterCount = 0,
  onClearFilters,
  endContent,
  tabs,
}: TableToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchField = (
    <SearchInput
      placement="toolbar"
      placeholder={searchPlaceholder}
      value={search}
      onValueChange={onSearchChange}
      onClear={() => onSearchChange("")}
    />
  );

  /* Row 1 of the table card (01 §7.14): 52px, the segmented status switch left; search (32px × 240), Filter and
     the Columns circle right, 8px apart. Without tabs the search sits left. Wraps to a second row when it can't fit. */
  return (
    <div className="flex min-h-[var(--zc-table-toolbar-h)] flex-col gap-2 border-b border-line-subtle bg-surface px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      {tabs ? <div className="flex min-w-0 items-center">{tabs}</div> : searchField}

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {tabs ? searchField : null}
        {filterContent ? (
          <>
            <FilterButton count={filterCount} onPress={() => setFiltersOpen(true)} />
            <FilterDrawer isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} onClear={onClearFilters}>
              {filterContent}
            </FilterDrawer>
          </>
        ) : null}

        {columns && visibleColumns && onVisibleColumnsChange ? (
          <UiDropdown placement="bottom-end">
            <DropdownTrigger>
              <UiIconButton aria-label="Choose columns" variant="default" size="sm" showTooltip={false}>
                <IconColumns aria-hidden />
              </UiIconButton>
            </DropdownTrigger>
            <UiDropdownMenu
              aria-label="Toggle columns"
              closeOnSelect={false}
              selectionMode="multiple"
              selectedKeys={new Set(visibleColumns)}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys).map(String);
                if (selected.length > 0) onVisibleColumnsChange(selected);
              }}
            >
              {columns.map((column) => (
                <DropdownItem key={column.key}>{column.label}</DropdownItem>
              ))}
            </UiDropdownMenu>
          </UiDropdown>
        ) : null}

        {endContent}
      </div>
    </div>
  );
}

export interface TableSelectAllProps {
  isSelected: boolean;
  isIndeterminate?: boolean;
  onValueChange: (selected: boolean) => void;
}

export function TableSelectAll({
  isSelected,
  isIndeterminate,
  onValueChange,
}: TableSelectAllProps) {
  return (
    <Checkbox
      aria-label="Select all"
      size="sm"
      color="primary"
      isSelected={isSelected}
      isIndeterminate={!!isIndeterminate && !isSelected}
      onValueChange={onValueChange}
      onClick={(event) => event.stopPropagation()}
      classNames={{ wrapper: tableCheckboxClassNames.wrapper, icon: tableCheckboxClassNames.icon }}
    />
  );
}

export interface TableRowCheckboxProps {
  isSelected: boolean;
  onValueChange: (selected: boolean) => void;
  ariaLabel: string;
}

export function TableRowCheckbox({
  isSelected,
  onValueChange,
  ariaLabel,
}: TableRowCheckboxProps) {
  return (
    <Checkbox
      aria-label={ariaLabel}
      size="sm"
      color="primary"
      isSelected={isSelected}
      onValueChange={onValueChange}
      onClick={(event) => event.stopPropagation()}
      classNames={{ wrapper: tableCheckboxClassNames.wrapper, icon: tableCheckboxClassNames.icon }}
    />
  );
}

export interface FilterCheckboxGroupProps {
  label: string;
  options: { key: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function FilterCheckboxGroup({
  label,
  options,
  value,
  onChange,
}: FilterCheckboxGroupProps) {
  return (
    <section className="zc-filter-group" aria-label={label}>
      <span className="zc-filter-group__label">{label}</span>
      <CheckboxGroup
        value={value}
        onValueChange={onChange}
        size="sm"
        classNames={{ wrapper: "gap-2" }}
      >
        {options.map((option) => (
          <Checkbox key={option.key} value={option.key}>
            {option.label}
          </Checkbox>
        ))}
      </CheckboxGroup>
    </section>
  );
}
