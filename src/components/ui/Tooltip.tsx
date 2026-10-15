/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Tooltip as HeroTooltip } from "@heroui/react";
import type { TooltipProps as HeroTooltipProps } from "@heroui/react";
import { cx } from "./cx";

export type TooltipProps = HeroTooltipProps;

/** Popover-style tooltip (design-system §5 shadow-popover), 300ms open delay. */
export function Tooltip({ classNames, delay = 300, closeDelay = 0, ...rest }: TooltipProps) {
  return (
    <HeroTooltip
      delay={delay}
      closeDelay={closeDelay}
      classNames={{
        ...classNames,
        content: cx(
          "rounded-lg bg-surface px-2 py-1 text-xs text-fg !shadow-popover",
          classNames?.content,
        ),
      }}
      {...rest}
    />
  );
}
