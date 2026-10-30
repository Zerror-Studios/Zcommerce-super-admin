/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Checkbox as HeroCheckbox } from "@heroui/react";
import type { CheckboxProps as HeroCheckboxProps } from "@heroui/react";
import { cx } from "./cx";

export type CheckboxProps = Omit<HeroCheckboxProps, "color" | "radius">;

/**
 * Checkbox (01 §7.8, `.zc-check-box` in src/styles/components.css): 16px, 4px radius, a clear 1.5px grey
 * outline so an empty box is visible; blue fill with a white tick or dash. Label 14px, 8px gap, the whole
 * label is clickable.
 */
export function Checkbox({ classNames, size = "sm", ...rest }: CheckboxProps) {
  return (
    <HeroCheckbox
      color="primary"
      size={size}
      radius="sm"
      classNames={{
        ...classNames,
        base: cx("min-h-6 gap-2", classNames?.base),
        wrapper: cx("zc-check-box", classNames?.wrapper),
        icon: cx("text-brand-on", classNames?.icon),
        label: cx("text-sm text-fg", classNames?.label),
      }}
      {...rest}
    />
  );
}
