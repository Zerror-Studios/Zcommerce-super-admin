import { Checkbox, CheckboxGroup, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import { getTableSearchClasses, tableSearchIconClass } from "../ui/field-styles";
import { IconCaret, IconFilters, IconSearch } from "../ui/icons";
import { Button as UiButton } from "../ui";

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
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  filterContent,
  endContent,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-default-100 bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Input
        aria-label="Search table"
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={onSearchChange}
        radius="full"
        isClearable
        onClear={() => onSearchChange("")}
        startContent={<IconSearch aria-hidden className={tableSearchIconClass} />}
        classNames={getTableSearchClasses()}
      />

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {columns && visibleColumns && onVisibleColumnsChange ? (
          <Dropdown>
            <DropdownTrigger>
              <UiButton variant="outline" size="sm" endIcon={<IconCaret size={14} />}>
                Columns
              </UiButton>
            </DropdownTrigger>
            <DropdownMenu
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
            </DropdownMenu>
          </Dropdown>
        ) : null}

        {filterContent ? (
          <Popover placement="bottom-end">
            <PopoverTrigger>
              <UiButton
                variant="outline"
                size="sm"
                endIcon={<IconFilters size={14} strokeWidth={2.5} />}
              >
                Filters
              </UiButton>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="flex w-full flex-col gap-3">{filterContent}</div>
            </PopoverContent>
          </Popover>
        ) : (
          <UiButton
            variant="outline"
            size="sm"
            endIcon={<IconFilters size={14} strokeWidth={2.5} />}
          >
            Filters
          </UiButton>
        )}

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
      classNames={{
        wrapper:
          "before:border-default-300 after:bg-primary rounded-[4px] before:rounded-[4px]",
        icon: "text-brand-on",
      }}
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
      classNames={{
        wrapper:
          "before:border-default-300 after:bg-primary rounded-[4px] before:rounded-[4px]",
        icon: "text-brand-on",
      }}
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
      <p className="text-caption font-bold text-default-500">{label}</p>
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
