/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import { forwardRef, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Button variants (docs/design/02-components.md §3). One primary per view; everything else is
 * secondary or ghost. Cancel is never red.
 * - primary: filled blue
 * - secondary: white, strong border (other important actions, date picker)
 * - ghost: transparent, muted text (Import, Export, Cancel, Filter, Sort, Columns, row actions)
 * - destructive: white, red border and text (Delete, Suspend, Refund)
 * - danger: filled red, only inside destructive confirm modals
 * - link: blue text ("View all", inline links)
 * LEGACY aliases: "outline" renders as secondary, "danger-outline" as destructive.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "danger"
  | "link"
  | "outline"
  | "danger-outline";

/** sm 32px (tables, cards), md 36px (default), lg 40px (login). */
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

type BaseVariant = Exclude<ButtonVariant, "outline" | "danger-outline">;

const legacy: Record<ButtonVariant, BaseVariant> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "destructive",
  danger: "danger",
  link: "link",
  outline: "secondary",
  "danger-outline": "destructive",
};

/** HeroUI base variant + color for each design-system variant. */
const base: Record<BaseVariant, Pick<HeroButtonProps, "variant" | "color">> = {
  primary: { variant: "solid", color: "primary" },
  secondary: { variant: "bordered", color: "default" },
  ghost: { variant: "light", color: "default" },
  destructive: { variant: "bordered", color: "default" },
  danger: { variant: "solid", color: "danger" },
  link: { variant: "light", color: "primary" },
};

const variantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-brand text-brand-on data-[hover=true]:!opacity-100 data-[hover=true]:bg-brand-hover data-[pressed=true]:bg-brand-pressed",
  secondary:
    "border border-line-strong bg-surface text-fg data-[hover=true]:!opacity-100 data-[hover=true]:!bg-surface-muted data-[pressed=true]:!bg-surface-sunken",
  ghost:
    "bg-transparent text-fg-muted data-[hover=true]:!opacity-100 data-[hover=true]:!bg-surface-sunken data-[hover=true]:text-fg data-[pressed=true]:!bg-line",
  destructive:
    "border border-tone-danger-border bg-surface text-tone-danger-text data-[hover=true]:!opacity-100 data-[hover=true]:!bg-tone-danger-soft data-[pressed=true]:!bg-tone-danger-soft",
  danger:
    "bg-tone-danger text-brand-on data-[hover=true]:!opacity-100 data-[hover=true]:bg-tone-danger-hover data-[pressed=true]:bg-tone-danger-hover",
  link:
    "h-auto min-w-0 bg-transparent px-0 text-brand data-[hover=true]:!bg-transparent data-[hover=true]:underline data-[hover=true]:!opacity-100",
};

/** Heights 32 / 36 / 40; 13px text on small buttons, 14px otherwise (tailwind-merge safe arbitrary sizes). */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 min-h-8 px-3 text-[13px] leading-5",
  md: "h-9 min-h-9 px-3.5 text-sm",
  lg: "h-10 min-h-10 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
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
  const kind = legacy[variant];
  return (
    <HeroButton
      ref={ref}
      {...base[kind]}
      size={size}
      radius="md"
      startContent={isLoading ? undefined : startIcon}
      endContent={isLoading ? undefined : endIcon}
      isDisabled={isDisabled ?? disabled}
      isLoading={isLoading}
      spinner={<span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      aria-busy={isLoading || undefined}
      className={cx(
        "min-w-0 gap-1.5 rounded-lg font-medium shadow-none transition-colors duration-instant ease-standard [&_svg]:size-4 [&_svg]:shrink-0",
        sizeClasses[size],
        variantClasses[kind],
        className,
      )}
      {...rest}
    />
  );
});
