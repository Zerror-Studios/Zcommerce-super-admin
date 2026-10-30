/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { DropdownItem, DropdownSection, DropdownTrigger } from "@heroui/react";
import type { ComponentType, ReactNode } from "react";
import { Dropdown, DropdownMenu } from "./Dropdown";
import { IconButton, type IconButtonSize, type IconButtonVariant } from "./IconButton";
import { IconMore } from "./icons";
import { menuItemDangerClasses, menuSectionClasses } from "./menu-styles";

export interface RowMenuItem {
  key: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onSelect?: () => void;
  /** A link item (opens the page); middle-click keeps working. */
  href?: string;
  /** Delete, Archive, Suspend…: red, always last, after a divider. They should confirm first (01 §7.16). */
  destructive?: boolean;
  shortcut?: string;
  disabled?: boolean;
  /** Shown under the label (`small` muted). */
  description?: string;
}

export interface RowMenuProps {
  items: RowMenuItem[];
  /** Names the ⋯ button: "Actions for #1042". Also its tooltip. */
  label?: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  placement?: "bottom-end" | "bottom-start" | "top-end";
}

/**
 * The ⋯ row menu (01 §7.14 "Row actions", §7.17): a circle icon button (default, 32px), always visible, that opens
 * a menu aligned to its right edge. Items carry a 16px icon; the default order is Open, Edit, Duplicate, Copy link,
 * page-specific actions, then destructive ones (red) after a divider — the divider is added here. Pressing the
 * button never opens the row (React Aria stops the press from reaching it).
 */
export function RowMenu({
  items,
  label = "More actions",
  size = "sm",
  variant = "default",
  placement = "bottom-end",
}: RowMenuProps) {
  const regular = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);
  const disabledKeys = items.filter((item) => item.disabled).map((item) => item.key);
  const byKey = new Map(items.map((item) => [item.key, item]));

  const renderItem = (item: RowMenuItem) => {
    const Icon = item.icon;
    return (
      <DropdownItem
        key={item.key}
        href={item.href}
        description={item.description}
        shortcut={item.shortcut}
        startContent={Icon ? <Icon aria-hidden /> : undefined}
        className={item.destructive ? menuItemDangerClasses : undefined}
      >
        {item.label}
      </DropdownItem>
    );
  };

  return (
    <Dropdown placement={placement}>
      <DropdownTrigger>
        <IconButton aria-label={label} variant={variant} size={size} showTooltip={false}>
          <IconMore aria-hidden />
        </IconButton>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={label}
        disabledKeys={disabledKeys}
        onAction={(key) => byKey.get(String(key))?.onSelect?.()}
      >
        {destructive.length && regular.length ? (
          [
            <DropdownSection key="actions" showDivider classNames={menuSectionClasses}>
              {regular.map(renderItem)}
            </DropdownSection>,
            <DropdownSection key="destructive" classNames={menuSectionClasses}>
              {destructive.map(renderItem)}
            </DropdownSection>,
          ]
        ) : (
          [...regular, ...destructive].map(renderItem)
        )}
      </DropdownMenu>
    </Dropdown>
  );
}
