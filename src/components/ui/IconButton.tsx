/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import { forwardRef } from "react";
import { cx } from "./cx";
import { Tooltip } from "./Tooltip";

/**
 * Circle icon button (01 §7.2, styles in src/styles/components.css `.zc-icon-btn`). Never a rounded square.
 * - default: white, 1px border (row ⋯ menus, pagination arrows, back button, carousel arrows)
 * - ghost: transparent (modal and drawer close, in-card actions)
 * - danger: transparent, red on hover (remove / delete in rows and cards)
 * - on-dark: black menu and top bar
 * - glass: on the banner and on media
 * - solid-dark: the AI ask bar's send button
 */
export type IconButtonVariant = "default" | "ghost" | "danger" | "on-dark" | "glass" | "solid-dark";
/** md 36 (default), sm 32, xs 28 (inside chips and dense rows), lg 40 (top bar). sm and md are 40 on phone. */
export type IconButtonSize = "xs" | "sm" | "md" | "lg";

export interface IconButtonProps
  extends Omit<HeroButtonProps, "variant" | "color" | "size" | "radius" | "isIconOnly" | "aria-label"> {
  /** Required: icon-only buttons need an accessible name. Also used as the tooltip text. */
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Show a tooltip with the aria-label on hover/focus (default true). */
  showTooltip?: boolean;
  /** LEGACY alias for isDisabled, accepted during migration. */
  disabled?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = "ghost",
    size = "md",
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
        variant !== "default" && `zc-icon-btn--${variant}`,
        size !== "md" && `zc-icon-btn--${size}`,
        className,
      )}
      {...rest}
    />
  );

  if (!showTooltip) return button;

  return <Tooltip content={rest["aria-label"]}>{button}</Tooltip>;
});
