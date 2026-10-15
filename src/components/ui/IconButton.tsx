/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
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

/** Component-specs §3 and §15. Square size = control height (32/40/48). */
const variantClasses: Record<IconButtonVariant, string> = {
  outline:
    "rounded-full border border-brand bg-transparent text-brand-text data-[hover=true]:!opacity-100 data-[hover=true]:bg-brand-soft data-[pressed=true]:bg-brand-tint",
  ghost:
    "rounded-full bg-transparent text-fg data-[hover=true]:!opacity-100 data-[hover=true]:bg-tone-neutral-soft data-[pressed=true]:bg-line",
  topbar:
    "rounded-lg bg-topbar-control text-topbar-fg data-[hover=true]:!opacity-100 data-[hover=true]:bg-topbar-control-hover",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "size-8 min-w-8",
  md: "size-10 min-w-10",
  lg: "size-12 min-w-12",
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
        "shadow-none transition-colors duration-fast ease-standard",
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
