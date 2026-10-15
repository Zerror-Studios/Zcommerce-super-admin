/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import { forwardRef, type ReactNode } from "react";
import { cx } from "./cx";

/** Only four CTA variants — use this Button everywhere (tabs, modals, tables, headers). */
export type ButtonVariant =
  | "primary"
  | "outline"
  | "danger"
  | "danger-outline";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<HeroButtonProps, "variant" | "color" | "size" | "radius" | "startContent" | "endContent"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** LEGACY alias for isDisabled, accepted during migration. */
  disabled?: boolean;
}

/** HeroUI base variant + color for each design-system variant. */
const base: Record<ButtonVariant, Pick<HeroButtonProps, "variant" | "color">> = {
  primary: { variant: "solid", color: "primary" },
  outline: { variant: "bordered", color: "default" },
  danger: { variant: "solid", color: "danger" },
  "danger-outline": { variant: "bordered", color: "default" },
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-on data-[hover=true]:!opacity-100 data-[hover=true]:bg-brand-hover data-[pressed=true]:bg-brand-pressed",
  outline:
    "border border-brand bg-transparent text-brand-text data-[hover=true]:!opacity-100 data-[hover=true]:bg-brand-soft data-[pressed=true]:bg-brand-tint",
  danger:
    "bg-tone-danger text-brand-on data-[hover=true]:!opacity-100 data-[hover=true]:bg-tone-danger-hover data-[pressed=true]:bg-tone-danger-hover",
  "danger-outline":
    "border border-tone-danger bg-transparent text-tone-danger-text data-[hover=true]:!opacity-100 data-[hover=true]:bg-tone-danger-soft data-[pressed=true]:bg-tone-danger-soft",
};

/** Size parity table. text-xs/sm/base = caption/body/subtitle sizes (tailwind-merge safe). */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "sm",
    startIcon,
    endIcon,
    disabled,
    isDisabled,
    isLoading,
    className,
    ...rest
  },
  ref,
) {
  return (
    <HeroButton
      ref={ref}
      {...base[variant]}
      size={size}
      radius="full"
      startContent={startIcon}
      endContent={endIcon}
      isDisabled={isDisabled ?? disabled}
      isLoading={isLoading}
      aria-busy={isLoading || undefined}
      className={cx(
        "gap-2 font-medium shadow-none transition-colors duration-fast ease-standard",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
});
