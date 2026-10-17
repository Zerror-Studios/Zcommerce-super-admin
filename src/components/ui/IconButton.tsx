/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import { forwardRef } from "react";
import { cx } from "./cx";
import { Tooltip } from "./Tooltip";

export type IconButtonVariant = "outline" | "ghost" | "topbar";
export type IconButtonSize = "sm" | "md" | "lg";

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

/**
 * Icon-only buttons (docs/design/02-components.md §3): 8px radius, 16px icon, tooltip from aria-label.
 * outline = secondary look (white, strong border); ghost = transparent, muted icon (row "···", close).
 * Square size = control height: sm 32, md 36, lg 40.
 */
const variantClasses: Record<IconButtonVariant, string> = {
  outline:
    "rounded-lg border border-line-strong bg-surface text-fg data-[hover=true]:!opacity-100 data-[hover=true]:!bg-surface-muted data-[pressed=true]:!bg-surface-sunken",
  ghost:
    "rounded-lg bg-transparent text-fg-muted data-[hover=true]:!opacity-100 data-[hover=true]:!bg-surface-sunken data-[hover=true]:text-fg data-[pressed=true]:!bg-line",
  topbar:
    "rounded-lg bg-topbar-control text-topbar-fg data-[hover=true]:!opacity-100 data-[hover=true]:bg-topbar-control-hover",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "size-8 min-w-8",
  md: "size-9 min-w-9",
  lg: "size-10 min-w-10",
};

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
      variant={variant === "outline" ? "bordered" : "light"}
      size={size}
      isDisabled={isDisabled ?? disabled}
      className={cx(
        "shadow-none transition-colors duration-instant ease-standard",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );

  if (!showTooltip) return button;

  return <Tooltip content={rest["aria-label"]}>{button}</Tooltip>;
});
