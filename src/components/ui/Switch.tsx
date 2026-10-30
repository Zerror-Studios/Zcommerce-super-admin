/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Switch as HeroSwitch } from "@heroui/react";
import type { SwitchProps as HeroSwitchProps } from "@heroui/react";
import { cx } from "./cx";

export type SwitchProps = Omit<HeroSwitchProps, "color">;

/**
 * Switch (01 §7.9, `.zc-switch-track` in src/styles/components.css): 36×20 capsule, grey off, blue on, a 16px
 * white knob that travels 16px in 220ms. It saves at once only where its context has no Save (table rows,
 * view toggles); inside a save-bar page, pop-up or editor it stages like any other field.
 */
export function Switch({ classNames, size = "sm", ...rest }: SwitchProps) {
  return (
    <HeroSwitch
      color="primary"
      size={size}
      classNames={{
        ...classNames,
        base: cx("gap-2", classNames?.base),
        wrapper: cx("zc-switch-track", classNames?.wrapper),
        thumb: cx("zc-switch-thumb", classNames?.thumb),
        label: cx("text-sm text-fg", classNames?.label),
      }}
      {...rest}
    />
  );
}
