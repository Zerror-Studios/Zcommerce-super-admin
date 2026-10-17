/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Tooltip as HeroTooltip } from "@heroui/react";
import type { TooltipProps as HeroTooltipProps } from "@heroui/react";
import { cx } from "./cx";

export type TooltipProps = HeroTooltipProps;

/** Tooltip (docs/design/02-components.md §11): ink background, white 12px, 6px radius, 400ms delay. */
export function Tooltip({ classNames, delay = 400, closeDelay = 0, ...rest }: TooltipProps) {
  return (
    <HeroTooltip
      delay={delay}
      closeDelay={closeDelay}
      classNames={{
        ...classNames,
        content: cx(
          "rounded-sm bg-fg px-2 py-1 text-xs text-brand-on shadow-none",
          classNames?.content,
        ),
      }}
      {...rest}
    />
  );
}
