/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The table toolbar and row helpers (docs/design-v2/README.md §4.3, §4.4; styles `.zc-toolbar`, `.zc-view`,
 * `.zc-row-chevron`, `.zc-thumb-more` in src/styles/components.css).
 *
 * TableToolbar sits ABOVE every table, never inside the card: segmented tabs with counts on the left; on the right,
 * in this order, search, the filter icon, the sort icon and the table | cards switch (where both views exist).
 * Dropdown filters ("Channel: All", "Method: All") never go here: they belong in the filter drawer.
 *
 * Responsive (v2 §10): from 768px up tabs and tools share one row (the tabs scroll sideways when they don't fit) and
 * the search is 200px under 1280px. On phone the tabs get their own row and the search is an icon that opens a
 * full-width field (it folds back when it is empty and loses focus); filter, sort and the view switch stay icons.
 */
import { DropdownItem, DropdownTrigger } from "@heroui/react";
import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "./cx";
import { Dropdown, DropdownMenu } from "./Dropdown";
import { FilterButton } from "./FilterDrawer";
import { IconButton } from "./IconButton";
import { IconCheck, IconGridView, IconNextPage, IconSearch, IconSort, IconTable } from "./icons";
import type { ViewMode } from "./Media";
import { SearchInput } from "./SearchInput";
import { SegmentedSwitch, type SegmentedItem } from "./Tabs";
import { useIsPhone } from "./use-media";

export interface SortOption {
  key: string;
  label: string;
}

export interface SortButtonProps {
  options: SortOption[];
  value?: string;
  onChange: (key: string) => void;
  label?: string;
}

/** The sort icon button (§4.3): a 36px circle that opens a single-choice menu; ink while open. */
export function SortButton({ options, value, onChange, label = "Sort" }: SortButtonProps) {
  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <IconButton aria-label={label} variant="default" showTooltip={false}>
          <IconSort aria-hidden />
        </IconButton>
      </DropdownTrigger>
      <DropdownMenu aria-label={label} onAction={(key) => onChange(String(key))}>
        {options.map((option) => (
          <DropdownItem key={option.key} endContent={option.key === value ? <IconCheck aria-hidden className="size-4" /> : undefined}>
            {option.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export interface ViewSwitchProps {
  /** "list" = table, "grid" = cards (the useViewMode values, remembered per page). */
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

/** The table | cards switch (§4.8): a white pill with two 32px items; the selected one is ink. */
export function ViewSwitch({ value, onChange, className }: ViewSwitchProps) {
  const options: { mode: ViewMode; label: string; icon: ReactNode }[] = [
    { mode: "list", label: "Table view", icon: <IconTable aria-hidden /> },
    { mode: "grid", label: "Card view", icon: <IconGridView aria-hidden /> },
  ];
  return (
    <div role="radiogroup" aria-label="View" className={cx("zc-view", className)}>
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={option.mode === value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.mode)}
          className="zc-view__item"
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

export interface TableToolbarProps<V extends string> {
  /** Segmented tabs with counts (status slices of the list). */
  tabs?: SegmentedItem<V>[];
  tab?: V;
  onTabChange?: (tab: V) => void;
  /** Names the tab list ("Order status"). */
  tabsLabel?: string;
  /** Controlled search text. Debounce in the page (useDebouncedInput) when it hits the server. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Page-specific placeholder: "Search orders". */
  searchPlaceholder?: string;
  /** Opens the right-hand filter drawer; the icon turns ink while filters are applied. */
  onOpenFilters?: () => void;
  filterCount?: number;
  /** Sort menu. */
  sort?: SortButtonProps;
  /** Table | cards switch, where both views exist. */
  view?: ViewSwitchProps;
  /** Anything else for the right side, before search (rare). */
  children?: ReactNode;
  className?: string;
}

export function TableToolbar<V extends string>({
  tabs,
  tab,
  onTabChange,
  tabsLabel = "Show",
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  onOpenFilters,
  filterCount = 0,
  sort,
  view,
  children,
  className,
}: TableToolbarProps<V>) {
  const isPhone = useIsPhone();
  const [searchOpen, setSearchOpen] = useState(false);
  // Phone: the field shows while opened or while it holds a search, so an active search is never hidden.
  const showField = !isPhone || searchOpen || !!search;
  return (
    <div className={cx("zc-toolbar zc-toolbar--row", isPhone && "zc-toolbar--phone", className)}>
      {tabs && tab != null && onTabChange ? (
        <div className="zc-toolbar__tabs">
          <SegmentedSwitch<V> items={tabs} value={tab} onChange={onTabChange} ariaLabel={tabsLabel} />
        </div>
      ) : null}
      <div className="zc-toolbar__end">
        {children}
        {onSearchChange && showField ? (
          <SearchInput
            placement="toolbar"
            placeholder={searchPlaceholder}
            value={search ?? ""}
            onValueChange={onSearchChange}
            onClear={() => onSearchChange("")}
            autoFocus={isPhone && searchOpen && !search}
            onBlur={isPhone ? (event) => !(event.target as HTMLInputElement).value && setSearchOpen(false) : undefined}
            classNames={{ base: "zc-toolbar__search" }}
          />
        ) : null}
        {onSearchChange && !showField ? (
          <IconButton aria-label={searchPlaceholder} variant="default" showTooltip={false} onPress={() => setSearchOpen(true)}>
            <IconSearch aria-hidden />
          </IconButton>
        ) : null}
        {onOpenFilters ? <FilterButton count={filterCount} onPress={onOpenFilters} /> : null}
        {sort ? <SortButton {...sort} /> : null}
        {view ? <ViewSwitch {...view} /> : null}
      </div>
    </div>
  );
}

/**
 * Props for a real control inside a table row (a link or button in a cell): it keeps its own press, so the row's
 * onRowAction doesn't also fire. Spread on the element: <button {...rowControlProps} onClick={…}>.
 */
export const rowControlProps = {
  onPointerDown: (event: PointerEvent) => event.stopPropagation(),
  onMouseDown: (event: MouseEvent) => event.stopPropagation(),
  onClick: (event: MouseEvent) => event.stopPropagation(),
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  },
};

export interface RowChevronProps {
  className?: string;
  /** Makes the chevron a real link (a row whose open target isn't the whole row). Needs `aria-label`. */
  href?: string;
  /** Makes the chevron a real button. Needs `aria-label`. */
  onPress?: () => void;
  /** Names the link or button: "Open Kesar & Kin". Required with href / onPress. */
  "aria-label"?: string;
}

/**
 * The row end (§4.4): a small 30px chevron circle, no arrow line. Decorative by default (the whole row is the
 * link). With `href` it is a router link, with `onPress` a button; both keep their press to themselves, so the row
 * action doesn't fire twice.
 */
export function RowChevron({ className, href, onPress, "aria-label": ariaLabel }: RowChevronProps) {
  const classes = cx("zc-row-chevron", (href != null || onPress) && "zc-row-chevron--control", className);
  if (href != null) {
    return (
      <Link to={href} aria-label={ariaLabel} className={classes} {...rowControlProps}>
        <IconNextPage aria-hidden />
      </Link>
    );
  }
  if (onPress) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        className={classes}
        {...rowControlProps}
        onClick={(event) => {
          event.stopPropagation();
          onPress();
        }}
      >
        <IconNextPage aria-hidden />
      </button>
    );
  }
  return (
    <span aria-hidden className={classes}>
      <IconNextPage />
    </span>
  );
}

export interface ThumbWithCountProps {
  src?: string | null;
  alt?: string;
  /** Items beyond the first: shows "+N" on the corner. 0 or less shows no badge. */
  more?: number;
  /** px; 40 by default (64px rows). */
  size?: number;
  className?: string;
}

/**
 * More than one product in a row (§4.4): ONE thumbnail with a small ink "+N" badge on its corner. Never two stacked
 * images, which make the names jump between rows.
 */
export function ThumbWithCount({ src, alt = "", more = 0, size = 40, className }: ThumbWithCountProps) {
  return (
    <span className={cx("zc-thumb-more", className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="size-full rounded-thumb border border-line object-cover" />
      ) : (
        <span aria-hidden className="size-full rounded-thumb bg-surface-sunken" />
      )}
      {more > 0 ? (
        <span className="zc-thumb-more__n" aria-label={`and ${more} more`}>
          +{more}
        </span>
      ) : null}
    </span>
  );
}
