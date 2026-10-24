import { Checkbox, CheckboxGroup, DropdownItem, DropdownTrigger, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import { SearchInput } from "../ui/SearchInput";
import { IconColumns, IconFilters } from "../ui/icons";
import { Button as UiButton, Dropdown as UiDropdown, DropdownMenu as UiDropdownMenu } from "../ui";
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
  filterContent?: ReactNode;
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
  endContent,
  tabs,
}: TableToolbarProps) {
  const searchField = (
    <SearchInput
      placement="toolbar"
      placeholder={searchPlaceholder}
      value={search}
      onValueChange={onSearchChange}
      onClear={() => onSearchChange("")}
    />
  );

  /* Row 1 of the table card: tabs left; search, Filter, Columns right. Without tabs the search sits left. */
  return (
    <div className="flex min-h-[52px] flex-col gap-2 border-b border-line bg-surface px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
      {tabs ? <div className="flex min-w-0 self-stretch">{tabs}</div> : searchField}

      <div className="flex flex-wrap items-center gap-1 lg:justify-end">
        {tabs ? <div className="mr-1">{searchField}</div> : null}
        {filterContent ? (
          <Popover placement="bottom-end">
            <PopoverTrigger>
              <UiButton variant="ghost" size="sm" startIcon={<IconFilters aria-hidden />}>
                Filter
              </UiButton>
            </PopoverTrigger>
            <PopoverContent className="w-64 rounded-xl border border-line p-4 shadow-popover">
              <div className="flex w-full flex-col gap-3">{filterContent}</div>
            </PopoverContent>
          </Popover>
        ) : null}

        {columns && visibleColumns && onVisibleColumnsChange ? (
          <UiDropdown placement="bottom-end">
            <DropdownTrigger>
              <UiButton variant="ghost" size="sm" startIcon={<IconColumns aria-hidden />}>
                Columns
              </UiButton>
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
    <div className="space-y-2">
      <p className="text-label font-medium text-fg-muted">{label}</p>
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
    </div>
  );
}
