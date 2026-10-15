/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Input as HeroInput } from "@heroui/react";
import type { InputProps as HeroInputProps } from "@heroui/react";
import { cx } from "./cx";
import { getSearchInputClasses, tableSearchIconClass } from "./field-styles";
import type { FieldSize } from "./field-styles";
import { IconSearch } from "./icons";

export interface SearchInputProps extends Omit<HeroInputProps, "size" | "variant" | "radius" | "type"> {
  size?: FieldSize;
}

/**
 * Search field (docs/design/02-components.md §7): 34px, 8px radius, 15px leading magnifier, clear button
 * when it has a value. Always pass a page-specific placeholder ("Search orders").
 */
export function SearchInput({
  size = "md",
  classNames,
  startContent,
  isClearable = true,
  "aria-label": ariaLabel,
  placeholder = "Search",
  ...rest
}: SearchInputProps) {
  const styles = getSearchInputClasses();
  return (
    <HeroInput
      type="search"
      variant="bordered"
      size={size}
      isClearable={isClearable}
      placeholder={placeholder}
      aria-label={ariaLabel ?? (typeof placeholder === "string" ? placeholder : "Search")}
      startContent={startContent ?? <IconSearch aria-hidden className={tableSearchIconClass} />}
      classNames={{
        ...classNames,
        input: cx(styles.input, classNames?.input),
        inputWrapper: cx(styles.inputWrapper, size === "sm" && "h-8 min-h-8", classNames?.inputWrapper),
        clearButton: cx("text-fg-muted", classNames?.clearButton),
      }}
      {...rest}
    />
  );
}
