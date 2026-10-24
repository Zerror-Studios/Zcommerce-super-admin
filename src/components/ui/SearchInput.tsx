/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Input as HeroInput } from "@heroui/react";
import type { InputProps as HeroInputProps } from "@heroui/react";
import { cx } from "./cx";
import { getSearchInputClasses, tableSearchIconClass } from "./field-styles";
import type { FieldSize } from "./field-styles";
import { IconSearch } from "./icons";

export interface SearchInputProps extends Omit<HeroInputProps, "size" | "variant" | "radius" | "type"> {
  size?: FieldSize;
  /**
   * Where it sits (docs/design/09-settings-and-scale.md §2): "field" fills its container (dialogs, panels);
   * "toolbar" is the table toolbar search, 34px × 240px; "header" sits in a page header, 36px × 260px.
   * Phones always get the full width.
   */
  placement?: "field" | "toolbar" | "header";
}

const placementBase = {
  field: "",
  toolbar: "w-full sm:w-search sm:shrink-0",
  header: "w-full sm:w-search-lg sm:shrink-0",
};

/**
 * The one search field (docs/design/02-components.md §7, 08 §1.5): 34px (36px in headers), 8px radius,
 * 15px leading magnifier, clear button when it has a value. Always pass a page-specific placeholder
 * ("Search orders"). Every search in both apps is this component.
 */
export function SearchInput({
  size = "md",
  placement = "field",
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
        base: cx(placementBase[placement], classNames?.base),
        input: cx(styles.input, classNames?.input),
        inputWrapper: cx(
          styles.inputWrapper,
          size === "sm" && "h-8 min-h-8",
          placement === "header" && "h-9 min-h-9",
          classNames?.inputWrapper,
        ),
        clearButton: cx("text-fg-muted", classNames?.clearButton),
      }}
      {...rest}
    />
  );
}
