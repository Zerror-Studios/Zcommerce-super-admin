/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Switch as HeroSwitch } from "@heroui/react";
import type { SwitchProps as HeroSwitchProps } from "@heroui/react";
import { cx } from "./cx";

export type SwitchProps = Omit<HeroSwitchProps, "color">;

/** Switch (component-specs §7): primary when on, focus ring from HeroUI. */
export function Switch({ classNames, size = "sm", ...rest }: SwitchProps) {
  return (
    <HeroSwitch
      color="primary"
      size={size}
      classNames={{
        ...classNames,
        label: cx("text-sm text-fg", classNames?.label),
      }}
      {...rest}
    />
  );
}
