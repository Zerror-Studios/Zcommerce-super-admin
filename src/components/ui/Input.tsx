/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Input as HeroInput } from "@heroui/react";
import type { InputProps as HeroInputProps } from "@heroui/react";
import { cx } from "./cx";
import { OUTSIDE_LABEL_PLACEHOLDER, fieldHeight, getInputClasses } from "./field-styles";
import type { FieldSize } from "./field-styles";
import { IconError } from "./icons";

export interface InputProps extends Omit<HeroInputProps, "size" | "variant" | "radius"> {
  size?: FieldSize;
}

/** Text field (component-specs §4): label above, 8px radius, error icon + message when invalid. */
export function Input({ size = "md", classNames, isInvalid, endContent, labelPlacement = "outside", placeholder, ...rest }: InputProps) {
  const styles = getInputClasses();
  return (
    <HeroInput
      variant="bordered"
      size={size}
      labelPlacement={labelPlacement}
      placeholder={placeholder ?? (labelPlacement === "outside" ? OUTSIDE_LABEL_PLACEHOLDER : undefined)}
      isInvalid={isInvalid}
      endContent={
        endContent ?? (isInvalid ? <IconError aria-hidden className="size-4 shrink-0 text-tone-danger-text" /> : undefined)
      }
      classNames={{
        ...classNames,
        input: cx(styles.input, classNames?.input),
        inputWrapper: cx(styles.inputWrapper, fieldHeight[size], classNames?.inputWrapper),
        label: cx(styles.label, classNames?.label),
        errorMessage: cx(styles.errorMessage, classNames?.errorMessage),
        description: cx(styles.description, classNames?.description),
      }}
      {...rest}
    />
  );
}
