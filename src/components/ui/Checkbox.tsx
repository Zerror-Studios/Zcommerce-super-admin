/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Checkbox as HeroCheckbox } from "@heroui/react";
import type { CheckboxProps as HeroCheckboxProps } from "@heroui/react";
import { cx } from "./cx";

export type CheckboxProps = Omit<HeroCheckboxProps, "color" | "radius">;

/** Checkbox (docs/design/02-components.md §7): 16px, 4px radius, strong border, primary fill when checked. */
export function Checkbox({ classNames, size = "sm", ...rest }: CheckboxProps) {
  return (
    <HeroCheckbox
      color="primary"
      size={size}
      radius="sm"
      classNames={{
        ...classNames,
        wrapper: cx(
          "size-4 rounded-xs before:rounded-xs after:rounded-xs before:border before:border-line-strong after:bg-brand",
          classNames?.wrapper,
        ),
        icon: cx("text-brand-on", classNames?.icon),
        label: cx("text-sm text-fg", classNames?.label),
      }}
      {...rest}
    />
  );
}
