/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Button as HeroButton, Input as HeroInput } from "@heroui/react";
import type { ButtonProps as HeroButtonProps } from "@heroui/react";
import { forwardRef, type ReactNode } from "react";
import { Badge } from "../ui/Badge";
import { cx } from "../ui/cx";
import { getDarkSearchInputClasses } from "../ui/field-styles";
import { IconButton } from "../ui/IconButton";
import type { IconButtonProps } from "../ui/IconButton";
import { IconMenu, IconSearch } from "../ui/icons";

export interface TopbarProps {
  /** Product badge after the logo, e.g. "Super Admin" (shown uppercase). */
  badge?: ReactNode;
  /** Shows the menu button below lg (opens the sidebar drawer). */
  onOpenMobileNav?: () => void;
  /** Global search placeholder. Pass null to hide the search. */
  searchPlaceholder?: string | null;
  /** Right-side controls (notifications, messages, account). */
  actions?: ReactNode;
}

/** Topbar (component-specs §15): 64px, dark bar, logo + badge, centered search, controls 12px apart. */
export function Topbar({
  badge,
  onOpenMobileNav,
  searchPlaceholder = "Search for tools, apps, help & more...",
  actions,
}: TopbarProps) {
  const search = getDarkSearchInputClasses();
  return (
    // Left and right groups share the free space equally (flex-1 basis-0), so the search sits at the
    // exact center of the bar whatever their widths. On narrow screens the search shrinks, never overlaps.
    <header className="z-40 flex h-topbar w-full shrink-0 items-center gap-3 bg-topbar px-6 text-topbar-fg">
      <div className="flex flex-1 basis-0 items-center gap-2">
        {onOpenMobileNav ? (
          <IconButton
            aria-label="Open menu"
            variant="topbar"
            showTooltip={false}
            className="lg:hidden"
            onPress={onOpenMobileNav}
          >
            <IconMenu aria-hidden className="size-4" />
          </IconButton>
        ) : null}
        <span className="text-xl font-bold">ZCOMMERCE</span>
        {badge ? (
          <span className="inline-flex h-6 items-center rounded-full bg-topbar-badge px-2 text-caption font-medium uppercase text-topbar-badge-fg">
            {badge}
          </span>
        ) : null}
      </div>

      {searchPlaceholder ? (
        <div className="hidden min-w-0 basis-xl justify-center lg:flex">
          <HeroInput
            type="search"
            aria-label="Search"
            placeholder={searchPlaceholder}
            variant="bordered"
            startContent={
              <IconSearch
                aria-hidden
                className="size-4 shrink-0 text-topbar-fg-muted group-data-[focus=true]:text-fg-muted"
              />
            }
            classNames={{ ...search, base: "w-full" }}
          />
        </div>
      ) : null}

      <div className="flex flex-1 basis-0 items-center justify-end gap-3">{actions}</div>
    </header>
  );
}

export interface TopbarIconButtonProps extends Omit<IconButtonProps, "variant" | "size" | "showTooltip"> {
  /** Unread count shown as a badge (hidden at 0). */
  count?: number;
}

/** Bell / envelope control (component-specs §15): 40px, 8px radius, count badge offset -4px. */
export const TopbarIconButton = forwardRef<HTMLButtonElement, TopbarIconButtonProps>(
  function TopbarIconButton({ count = 0, className, children, ...rest }, ref) {
    return (
      <IconButton
        ref={ref}
        variant="topbar"
        size="md"
        showTooltip={false}
        className={cx("relative overflow-visible", className)}
        {...rest}
      >
        {children}
        <Badge count={count} aria-hidden className="pointer-events-none absolute -right-1 -top-1" />
      </IconButton>
    );
  },
);

export interface TopbarAccountButtonProps extends Omit<HeroButtonProps, "children" | "variant" | "color" | "size"> {
  name: string;
  /** Letter in the avatar tile (default: first letter of name). */
  initial?: string;
}

/** Account control (component-specs §15): 40px, name + 28px initial tile. Opens the project's account menu. */
export const TopbarAccountButton = forwardRef<HTMLButtonElement, TopbarAccountButtonProps>(
  function TopbarAccountButton({ name, initial: initialProp, className, ...rest }, ref) {
    const initial = (initialProp || name.trim().charAt(0) || "?").charAt(0).toUpperCase();
    return (
      <HeroButton
        ref={ref}
        variant="light"
        aria-label={`Account: ${name}`}
        className={cx(
          "h-10 min-w-0 gap-2 rounded-lg bg-topbar-control px-3 text-topbar-fg data-[hover=true]:!bg-topbar-control-hover",
          className,
        )}
        {...rest}
      >
        <span className="hidden text-sm font-medium sm:inline">{name}</span>
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-sm bg-brand text-sm font-medium text-brand-on"
        >
          {initial}
        </span>
      </HeroButton>
    );
  },
);
