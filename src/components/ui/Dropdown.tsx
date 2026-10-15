/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Dropdown as HeroDropdown, DropdownMenu as HeroDropdownMenu } from "@heroui/react";
import type { DropdownMenuProps as HeroDropdownMenuProps, DropdownProps as HeroDropdownProps } from "@heroui/react";
import { cx } from "./cx";
import { menuItemClasses, menuPopoverClasses } from "./menu-styles";

export type DropdownProps = HeroDropdownProps;
export type DropdownMenuProps<T extends object = object> = HeroDropdownMenuProps<T>;

/** Dropdown popover (component-specs §6). Keyboard handling and focus return come from HeroUI. */
export function Dropdown({ classNames, ...rest }: DropdownProps) {
  return (
    <HeroDropdown
      classNames={{ ...classNames, content: cx(menuPopoverClasses, classNames?.content) }}
      {...rest}
    />
  );
}

/** Menu with design-system item states. For a destructive item add menuItemDangerClasses. */
export function DropdownMenu<T extends object = object>({ itemClasses, variant = "flat", ...rest }: DropdownMenuProps<T>) {
  return (
    <HeroDropdownMenu<T>
      variant={variant}
      itemClasses={{
        ...menuItemClasses,
        ...itemClasses,
        base: cx(menuItemClasses.base, itemClasses?.base),
      }}
      {...rest}
    />
  );
}
