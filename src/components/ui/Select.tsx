/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Select as HeroSelect } from "@heroui/react";
import type { SelectProps as HeroSelectProps } from "@heroui/react";
import { cx } from "./cx";
import { OUTSIDE_LABEL_PLACEHOLDER, fieldHeight, getDropdownClasses } from "./field-styles";
import type { FieldSize } from "./field-styles";
import { IconCaret } from "./icons";
import { menuItemClasses, menuMotionProps, menuPopoverClasses } from "./menu-styles";

export interface SelectProps<T extends object = object>
  extends Omit<HeroSelectProps<T>, "size" | "variant" | "radius"> {
  size?: FieldSize;
}

/** Select (component-specs §6): white trigger, soft fill when open, caret rotates, menu with popover shadow. */
export function Select<T extends object = object>({
  size = "md",
  classNames,
  listboxProps,
  popoverProps,
  selectorIcon,
  labelPlacement = "outside",
  placeholder,
  ...rest
}: SelectProps<T>) {
  const styles = getDropdownClasses();
  return (
    <HeroSelect<T>
      variant="bordered"
      size={size}
      labelPlacement={labelPlacement}
      placeholder={placeholder ?? (labelPlacement === "outside" ? OUTSIDE_LABEL_PLACEHOLDER : undefined)}
      selectorIcon={selectorIcon ?? <IconCaret aria-hidden className="size-3" />}
      popoverProps={{ ...popoverProps, motionProps: popoverProps?.motionProps ?? menuMotionProps }}
      listboxProps={{
        ...listboxProps,
        itemClasses: {
          ...menuItemClasses,
          ...listboxProps?.itemClasses,
          base: cx(menuItemClasses.base, listboxProps?.itemClasses?.base),
        },
      }}
      classNames={{
        ...classNames,
        trigger: cx(styles.trigger, fieldHeight[size], classNames?.trigger),
        value: cx(styles.value, classNames?.value),
        label: cx(styles.label, classNames?.label),
        selectorIcon: cx(styles.selectorIcon, "duration-base", classNames?.selectorIcon),
        errorMessage: cx(styles.errorMessage, classNames?.errorMessage),
        popoverContent: cx(menuPopoverClasses, classNames?.popoverContent),
      }}
      {...rest}
    />
  );
}
