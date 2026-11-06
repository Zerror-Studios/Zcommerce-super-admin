/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { SelectItem } from "@heroui/react";
import { forwardRef, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, type ButtonSize } from "./Button";
import { Checkbox } from "./Checkbox";
import { Drawer } from "./Drawer";
import { OptionChip } from "./FilterChips";
import { IconButton } from "./IconButton";
import { IconFilters } from "./icons";
import { Input } from "./Input";
import { formatCount } from "./money";
import { SearchInput } from "./SearchInput";
import { Select } from "./Select";

/**
 * The filter drawer (01 §7.15): every table's Filter button opens it from the right (400px, full width on phone).
 * Changes are staged and applied only with the primary "Show 24 results" ("Show 1 result"); Cancel, closing or
 * Escape discards them. With `totalCount` the header says how many match ("7 of 18 match", board 36).
 * Escape closes; focus is trapped and returns to the Filter button (HeroUI).
 *
 * Two ways to fill it:
 * - `groups` + `value` + `onApply` (the spec): option chips for 2–8 choices, a checklist with its own search for
 *   more, ₹ min/max ranges, a select, date presets. Pass `countResults(draft)` for the live count.
 * - LEGACY `children`: the page's existing filter fields, which still apply as they change. The footer's primary
 *   then just closes the drawer. Pages move to `groups` in their own phase.
 */
/** options: multi-choice chips · single: one-choice chips · checklist · range (₹ min–max) · date presets · select. */
export type FilterGroupType = "options" | "single" | "checklist" | "range" | "date" | "select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  type: FilterGroupType;
  options?: FilterOption[];
  /** range: the prefix inside both fields (default ₹). */
  prefix?: string;
}

export interface FilterRange {
  min?: string;
  max?: string;
}

export type FilterDraftValue = string[] | string | FilterRange | undefined;
export type FilterValues = Record<string, FilterDraftValue>;

/** How many groups hold a value (the "Filter · 2" count and the chip row). */
export function countActiveFilters(values: FilterValues): number {
  return Object.values(values).filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value !== "";
    if (value && typeof value === "object") return !!(value.min || value.max);
    return false;
  }).length;
}

export interface FilterButtonProps {
  /** Applied filter groups: a small count badge, and the button turns ink. */
  count?: number;
  onPress: () => void;
  /** LEGACY: ignored. v2 §4.3: the filter is always the 36px icon button. */
  size?: ButtonSize;
}

/**
 * The toolbar's filter button (v2 §4.3, §4.5): a 36px round icon button that opens the right-hand drawer. While
 * filters are applied it is ink with a count badge; its name says how many ("Filter, 2 applied").
 */
export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(function FilterButton(
  { count = 0, onPress },
  ref,
) {
  const active = count > 0;
  return (
    <span className="relative inline-flex">
      <IconButton
        ref={ref}
        variant="default"
        aria-label={active ? `Filter, ${formatCount(count)} applied` : "Filter"}
        className={active ? "zc-icon-btn--active" : undefined}
        onPress={onPress}
      >
        <IconFilters aria-hidden />
      </IconButton>
      {active ? (
        <span
          aria-hidden
          className="zc-count-badge"
        >
          {formatCount(count)}
        </span>
      ) : null}
    </span>
  );
});

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  groups?: FilterGroup[];
  /** The applied filters; the drawer copies them into its draft each time it opens. */
  value?: FilterValues;
  onApply?: (values: FilterValues) => void;
  /** "Clear all": empties the draft (groups) or clears the page's filters at once (legacy children). */
  onClear?: () => void;
  /** Live result count for a draft (debounced 300ms). Without it the button reads "Show results". */
  countResults?: (draft: FilterValues) => number | Promise<number>;
  /** Everything before filtering: the header line reads "7 of 18 match" while the live count is known. */
  totalCount?: number;
  /** Plural noun for the header line: "posts" → "7 of 18 posts match". */
  noun?: string;
  /** LEGACY: the page's existing filter fields (they apply as they change). */
  children?: ReactNode;
  title?: string;
}

const COUNT_DEBOUNCE_MS = 300;
const CHECKLIST_SEARCH_AFTER = 8;

function FilterGroupField({
  group,
  value,
  onChange,
}: {
  group: FilterGroup;
  value: FilterDraftValue;
  onChange: (value: FilterDraftValue) => void;
}) {
  const [query, setQuery] = useState("");
  const options = group.options ?? [];
  const list = Array.isArray(value) ? value : [];
  const toggle = (option: string) =>
    onChange(list.includes(option) ? list.filter((item) => item !== option) : [...list, option]);

  if (group.type === "options" || group.type === "single" || group.type === "date") {
    // Dates and single groups are one choice at a time; option groups are multi-select.
    const single = group.type === "date" || group.type === "single";
    const current = single ? (typeof value === "string" ? value : "") : null;
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionChip
            key={option.value}
            pressed={single ? current === option.value : list.includes(option.value)}
            onClick={() => (single ? onChange(current === option.value ? "" : option.value) : toggle(option.value))}
          >
            {option.label}
          </OptionChip>
        ))}
      </div>
    );
  }

  if (group.type === "checklist") {
    const shown = query
      ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
      : options;
    return (
      <div className="flex flex-col gap-2">
        {options.length > CHECKLIST_SEARCH_AFTER ? (
          <SearchInput
            size="sm"
            placeholder={`Search ${group.label.toLowerCase()}`}
            value={query}
            onValueChange={setQuery}
            onClear={() => setQuery("")}
          />
        ) : null}
        <div className="flex flex-col gap-1">
          {shown.map((option) => (
            <Checkbox
              key={option.value}
              isSelected={list.includes(option.value)}
              onValueChange={() => toggle(option.value)}
            >
              {option.label}
            </Checkbox>
          ))}
        </div>
      </div>
    );
  }

  if (group.type === "range") {
    const range = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const prefix = <span className="text-sm text-fg-subtle">{group.prefix ?? "₹"}</span>;
    return (
      <div className="grid grid-cols-2 gap-3">
        <Input
          aria-label={`${group.label} from`}
          placeholder="Min"
          inputMode="decimal"
          startContent={prefix}
          value={range.min ?? ""}
          onValueChange={(min) => onChange({ ...range, min })}
        />
        <Input
          aria-label={`${group.label} to`}
          placeholder="Max"
          inputMode="decimal"
          startContent={prefix}
          value={range.max ?? ""}
          onValueChange={(max) => onChange({ ...range, max })}
        />
      </div>
    );
  }

  // select: one choice; the empty key means "Any".
  const ANY = "__any";
  return (
    <Select
      aria-label={group.label}
      selectedKeys={new Set([typeof value === "string" && value ? value : ANY])}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const next = String(Array.from(keys)[0] ?? ANY);
        onChange(next === ANY ? "" : next);
      }}
      items={[{ value: ANY, label: "Any" }, ...options]}
    >
      {(option) => <SelectItem key={option.value}>{option.label}</SelectItem>}
    </Select>
  );
}

export function FilterDrawer({
  isOpen,
  onClose,
  groups,
  value,
  onApply,
  onClear,
  countResults,
  totalCount,
  noun,
  children,
  title = "Filters",
}: FilterDrawerProps) {
  const staged = !!groups && !children;
  const [draft, setDraft] = useState<FilterValues>({});
  const [count, setCount] = useState<number | null>(null);

  // A fresh draft from the applied filters every time the drawer opens.
  useEffect(() => {
    if (isOpen) setDraft({ ...(value ?? {}) });
  }, [isOpen, value]);

  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  useEffect(() => {
    if (!isOpen || !staged || !countResults) return undefined;
    setCount(null);
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await countResults(draft);
        if (live) setCount(next);
      } catch {
        if (live) setCount(null);
      }
    }, COUNT_DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // draftKey stands for the draft's content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, isOpen, staged, countResults]);

  const showLabel = count == null ? "Show results" : `Show ${formatCount(count)} ${count === 1 ? "result" : "results"}`;
  const matchLine =
    staged && count != null && totalCount != null
      ? `${formatCount(count)} of ${formatCount(totalCount)}${noun ? ` ${noun}` : ""} match`
      : null;

  const apply = () => {
    if (staged) onApply?.(draft);
    onClose();
  };
  const clearAll = () => {
    if (staged) setDraft({});
    else onClear?.();
  };

  // Round 2 G6: the kit Drawer's own header (title, the live match line, the 36px close) and its sticky footer.
  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      title={title}
      subtitle={
        totalCount != null && staged ? (
          <span aria-live="polite" className="num">
            {matchLine ?? "\u00a0"}
          </span>
        ) : undefined
      }
      classNames={{ footer: "justify-between" }}
      footer={
        <>
          {staged || onClear ? (
            <Button variant="ghost" onPress={clearAll}>
              Clear all
            </Button>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-2">
            {staged ? (
              <Button variant="secondary" onPress={onClose}>
                Cancel
              </Button>
            ) : null}
            <Button variant="primary" onPress={apply}>
              {staged ? showLabel : "Show results"}
            </Button>
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {staged
          ? groups.map((group) => (
              <section key={group.key} className="zc-filter-group" aria-label={group.label}>
                <span className="zc-filter-group__label">{group.label}</span>
                <FilterGroupField
                  group={group}
                  value={draft[group.key]}
                  onChange={(next) => setDraft((current) => ({ ...current, [group.key]: next }))}
                />
              </section>
            ))
          : children}
      </div>
    </Drawer>
  );
}
