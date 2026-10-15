/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Input as HeroInput } from "@heroui/react";
import type { InputProps as HeroInputProps } from "@heroui/react";
import { cx } from "./cx";
import { fieldHeight, getSearchInputClasses } from "./field-styles";
import type { FieldSize } from "./field-styles";
import { IconSearch } from "./icons";

export interface SearchInputProps extends Omit<HeroInputProps, "size" | "variant" | "radius" | "type"> {
  size?: FieldSize;
}

/**
 * Search field (component-specs §5): pill, leading magnifier, clear button when it has a value.
 * Use size="sm" in table toolbars (next to sm buttons); md elsewhere.
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
      startContent={startContent ?? <IconSearch aria-hidden className="size-4 shrink-0 text-fg-muted" />}
      classNames={{
        ...classNames,
        input: cx(styles.input, classNames?.input),
        inputWrapper: cx(styles.inputWrapper, fieldHeight[size], classNames?.inputWrapper),
        clearButton: cx("text-fg-muted", classNames?.clearButton),
      }}
      {...rest}
    />
  );
}
