/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Tabs as HeroTabs } from "@heroui/react";
import type { TabsProps as HeroTabsProps } from "@heroui/react";
import { cx } from "./cx";

export type TabsProps<T extends object = object> = Omit<HeroTabsProps<T>, "variant" | "color">;

/** Underlined tabs (component-specs §18): muted label, primary label + 2px indicator when selected. */
export function Tabs<T extends object = object>({ classNames, ...rest }: TabsProps<T>) {
  return (
    <HeroTabs<T>
      variant="underlined"
      color="primary"
      classNames={{
        ...classNames,
        tabList: cx("gap-6 p-0 border-b border-line rounded-none", classNames?.tabList),
        tab: cx("px-0 h-10", classNames?.tab),
        tabContent: cx(
          "text-sm font-medium text-fg-muted transition-colors duration-fast ease-standard group-data-[hover=true]:text-fg group-data-[selected=true]:text-brand-text",
          classNames?.tabContent,
        ),
        cursor: cx("h-0.5 w-full bg-brand", classNames?.cursor),
      }}
      {...rest}
    />
  );
}
