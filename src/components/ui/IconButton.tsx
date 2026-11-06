/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import { forwardRef } from "react";
import { cx } from "./cx";
import { Tooltip } from "./Tooltip";

/**
 * Circle icon button: the G10 `icon` variant (round 2, styles in src/styles/components.css `.zc-icon-btn`). 36px
 * round, white, 1px line, ink icon; ink fill while active (an open menu, `aria-expanded`, or `active`). Never a
 * rounded square. If a row or card has edit and delete, both are icon buttons with a tooltip (on by default).
 * - default: the icon button (⋯, filter, sort, edit, close, pagination, carousel arrows)
 * - danger: the icon button with a red hover (remove / delete in rows and cards)
 * - on-dark: the black menu and the phone top bar only
 * - glass: on photos and video only
 * LEGACY: ghost renders as default; solid-dark renders as default + active. Sizes md 36 (default) and sm 32
 * (inside cards and tables); lg 44 only in the phone top row; xs renders as sm. sm and md are 44 on phone.
 */
export type IconButtonVariant = "default" | "danger" | "on-dark" | "glass" | "ghost" | "solid-dark";
export type IconButtonSize = "md" | "sm" | "lg" | "xs";

export interface IconButtonProps
  extends Omit<HeroButtonProps, "variant" | "color" | "size" | "radius" | "isIconOnly" | "aria-label"> {
  /** Required: icon-only buttons need an accessible name. Also used as the tooltip text. */
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Ink fill: the control's menu is open or its filter is applied (also set by `aria-expanded`). */
  active?: boolean;
  /** Show a tooltip with the aria-label on hover/focus (default true). */
  showTooltip?: boolean;
  /** LEGACY alias for isDisabled, accepted during migration. */
  disabled?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = "default",
    size = "md",
    active = false,
    showTooltip = true,
    disabled,
    isDisabled,
    className,
    ...rest
  },
  ref,
) {
  const button = (
    <HeroButton
      ref={ref}
      isIconOnly
      variant="light"
      disableAnimation
      disableRipple
      isDisabled={isDisabled ?? disabled}
      className={cx(
        "zc-icon-btn",
        (variant === "danger" || variant === "on-dark" || variant === "glass") && `zc-icon-btn--${variant}`,
        (size === "sm" || size === "xs") && "zc-icon-btn--sm",
        size === "lg" && "zc-icon-btn--lg",
        (active || variant === "solid-dark") && "zc-icon-btn--active",
        className,
      )}
      {...rest}
    />
  );

  if (!showTooltip) return button;

  return <Tooltip content={rest["aria-label"]}>{button}</Tooltip>;
});
