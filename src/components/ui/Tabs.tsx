/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Tabs as HeroTabs } from "@heroui/react";
import type { TabsProps as HeroTabsProps } from "@heroui/react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Segmented switch: the only tab style (01 §7.3, styles in src/styles/components.css). A grey capsule track,
 * a white thumb that slides to the selected item, items with an optional count. No underline, no blue line on
 * click; keyboard focus shows the strong ring. Moving between sections is the black menu's job, not tabs'.
 *
 * - <Tabs> keeps the HeroUI API (<Tab key title>, selectedKey, onSelectionChange) so pages with panels keep
 *   working; HeroUI's own cursor is the thumb.
 * - <SegmentedSwitch> is the plain value / onChange version for status tabs, date presets and channel switches.
 * - <TabLabel label count> renders "New 12" with the count in the muted, tabular style.
 */
export type SegmentedSize = "md" | "sm";

export type TabsProps<T extends object = object> = Omit<HeroTabsProps<T>, "variant" | "color" | "size" | "radius"> & {
  size?: SegmentedSize;
};

export function Tabs<T extends object = object>({ classNames, size = "md", ...rest }: TabsProps<T>) {
  return (
    <HeroTabs<T>
      variant="solid"
      radius="full"
      classNames={{
        ...classNames,
        tabList: cx("zc-seg-tabs", size === "sm" && "zc-seg-tabs--sm", classNames?.tabList),
        tab: cx("zc-seg-tab", classNames?.tab),
        tabContent: cx("zc-seg-tab__content", classNames?.tabContent),
        cursor: cx("zc-seg-tab__cursor", classNames?.cursor),
      }}
      {...rest}
    />
  );
}

const countFormat = new Intl.NumberFormat("en-IN");

/** Tab title with a live count: shows 0 (never hides the tab), Indian grouping, tabular figures. */
export function TabLabel({ label, count }: { label: ReactNode; count?: number | null }) {
  return (
    <>
      {label}
      {count != null ? <span className="zc-seg__count">{countFormat.format(count)}</span> : null}
    </>
  );
}

export interface SegmentedItem<V extends string = string> {
  value: V;
  label: ReactNode;
  count?: number | null;
  disabled?: boolean;
}

export interface SegmentedSwitchProps<V extends string = string> {
  items: SegmentedItem<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: SegmentedSize;
  /** Names the tab list for screen readers ("Order status"). */
  ariaLabel: string;
  className?: string;
}

export function SegmentedSwitch<V extends string = string>({
  items,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
}: SegmentedSwitchProps<V>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  // The thumb is one element measured from the selected item; it slides with transform + width.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const measure = () => {
      const selected = track.querySelector<HTMLElement>('[aria-selected="true"]');
      setThumb(selected ? { x: selected.offsetLeft, w: selected.offsetWidth } : null);
      setOverflowing(track.scrollWidth > track.clientWidth + 1);
      selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [value, items]);

  const enabled = items.filter((item) => !item.disabled);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key) || !enabled.length) return;
    event.preventDefault();
    const index = enabled.findIndex((item) => item.value === value);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % enabled.length;
    if (event.key === "ArrowLeft") next = (index - 1 + enabled.length) % enabled.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = enabled.length - 1;
    onChange(enabled[next].value);
    trackRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(enabled[next].value)}"]`)?.focus();
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cx("zc-seg", size === "sm" && "zc-seg--sm", overflowing && "zc-seg--scroll", className)}
    >
      {thumb ? (
        <span
          aria-hidden
          className="zc-seg__thumb"
          style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }}
        />
      ) : null}
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-value={item.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className="zc-seg__item"
          >
            <TabLabel label={item.label} count={item.count} />
          </button>
        );
      })}
    </div>
  );
}
