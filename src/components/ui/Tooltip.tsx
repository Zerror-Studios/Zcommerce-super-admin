/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Tooltip as HeroTooltip } from "@heroui/react";
import type { TooltipProps as HeroTooltipProps } from "@heroui/react";
import { cx } from "./cx";

export type TooltipProps = HeroTooltipProps;

/** Fades in over 140ms, hides at once (01 §7.18). */
const tooltipMotionProps = {
  variants: {
    enter: { opacity: 1, scale: 1, transition: { duration: 0.14, ease: [0.2, 0, 0, 1] as const } },
    exit: { opacity: 0, scale: 1, transition: { duration: 0 } },
  },
};

/**
 * Tooltip (01 §7.18, `.zc-tooltip`): ink, white 12/500, padding 6 8, radius 8, max 240px, 6px from the target, no
 * arrow. Shows after 400ms of hover or at once on keyboard focus. Required on every icon-only button and every
 * truncated text; never the only place for essential information.
 */
export function Tooltip({ classNames, delay = 400, closeDelay = 0, offset = 6, motionProps, ...rest }: TooltipProps) {
  return (
    <HeroTooltip
      delay={delay}
      closeDelay={closeDelay}
      offset={offset}
      motionProps={motionProps ?? tooltipMotionProps}
      classNames={{
        ...classNames,
        content: cx("zc-tooltip", classNames?.content),
      }}
      {...rest}
    />
  );
}
