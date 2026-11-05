import { Checkbox, CheckboxGroup, DropdownItem, DropdownTrigger } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { cx } from "../ui/cx";
import { SearchInput } from "../ui/SearchInput";
import { IconColumns, IconSearch } from "../ui/icons";
import { useIsPhone } from "../ui/use-media";
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

export interface ToolbarSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Page-specific placeholder; also names the phone search icon. */
  placeholder?: string;
}

/**
 * The toolbar search with the kit TableToolbar's phone rule (v2 §10): under 768px it is an icon that opens a
 * full-width field, and it folds back when it is empty and loses focus. An active search always shows its field.
 */
export function ToolbarSearch({ value, onValueChange, placeholder = "Search" }: ToolbarSearchProps) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  if (isPhone && !open && !value) {
    return (
      <UiIconButton aria-label={placeholder} variant="default" showTooltip={false} onPress={() => setOpen(true)}>
        <IconSearch aria-hidden />
      </UiIconButton>
    );
  }
  return (
    <SearchInput
      placement="toolbar"
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      onClear={() => onValueChange("")}
      autoFocus={isPhone && open && !value}
      onBlur={isPhone ? (event) => !(event.target as HTMLInputElement).value && setOpen(false) : undefined}
      classNames={{ base: "zc-toolbar__search" }}
    />
  );
}

/** The toolbar row, laid out like the kit TableToolbar's: one row from 768px up; on phone the tabs get their own row. */
export function ToolbarRow({ children, className }: { children: ReactNode; className?: string }) {
  const isPhone = useIsPhone();
  return <div className={cx("zc-toolbar zc-toolbar--row", isPhone && "zc-toolbar--phone", className)}>{children}</div>;
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

  /* Design v2 §4.3: the standard toolbar row ABOVE the table card (`.zc-toolbar`, the kit TableToolbar's layout):
     tabs on the left; on the right, in order, any extra control, search, the filter icon and the columns icon.
     Phone (v2 §10, same rules as the kit): the tabs scroll sideways in their own row, the search is an icon that
     opens a full-width field, filter and columns stay icons. */
  return (
    <ToolbarRow>
      {tabs ? <div className="zc-toolbar__tabs">{tabs}</div> : null}

      <div className="zc-toolbar__end flex-wrap">
        {endContent}
        <ToolbarSearch value={search} onValueChange={onSearchChange} placeholder={searchPlaceholder} />
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
              <UiIconButton aria-label="Choose columns" variant="default" showTooltip={false}>
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
      </div>
    </ToolbarRow>
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
