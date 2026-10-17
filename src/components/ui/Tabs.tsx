/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Tabs as HeroTabs } from "@heroui/react";
import type { TabsProps as HeroTabsProps } from "@heroui/react";
import { cx } from "./cx";

export type TabsProps<T extends object = object> = Omit<HeroTabsProps<T>, "variant" | "color">;

/**
 * Underline tabs (docs/design/02-components.md §8): 14/500 secondary text; selected = ink text + 2px ink underline
 * across the whole tab, edge to edge, sitting on the list's bottom border. HeroUI's sliding cursor is hidden: it
 * sets its own inline width (80% of the tab), which no class can override, so the line is the tab's ::after.
 */
export function Tabs<T extends object = object>({ classNames, ...rest }: TabsProps<T>) {
  return (
    <HeroTabs<T>
      variant="underlined"
      color="primary"
      classNames={{
        ...classNames,
        tabList: cx("gap-5 p-0 border-b border-line rounded-none", classNames?.tabList),
        tab: cx(
          "px-0 h-10 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent after:transition-colors after:duration-fast after:ease-standard data-[selected=true]:after:bg-fg",
          classNames?.tab,
        ),
        tabContent: cx(
          "text-sm font-medium text-fg-muted transition-colors duration-fast ease-standard group-data-[hover=true]:text-fg group-data-[selected=true]:text-fg",
          classNames?.tabContent,
        ),
        cursor: cx("hidden", classNames?.cursor),
      }}
      {...rest}
    />
  );
}
