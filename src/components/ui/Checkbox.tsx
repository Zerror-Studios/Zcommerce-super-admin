/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Checkbox as HeroCheckbox } from "@heroui/react";
import type { CheckboxProps as HeroCheckboxProps } from "@heroui/react";
import { cx } from "./cx";

export type CheckboxProps = Omit<HeroCheckboxProps, "color" | "radius">;

/** Checkbox (component-specs §7): 16px, 6px radius, strong border, primary fill when checked. */
export function Checkbox({ classNames, size = "sm", ...rest }: CheckboxProps) {
  return (
    <HeroCheckbox
      color="primary"
      size={size}
      radius="sm"
      classNames={{
        ...classNames,
        wrapper: cx(
          "rounded-sm before:rounded-sm after:rounded-sm before:border-line-strong after:bg-brand",
          classNames?.wrapper,
        ),
        icon: cx("text-brand-on", classNames?.icon),
        label: cx("text-sm text-fg", classNames?.label),
      }}
      {...rest}
    />
  );
}
