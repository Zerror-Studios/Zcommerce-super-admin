/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Textarea as HeroTextarea } from "@heroui/react";
import type { TextAreaProps as HeroTextAreaProps } from "@heroui/react";
import { cx } from "./cx";
import { getInputClasses } from "./field-styles";

export type TextareaProps = Omit<HeroTextAreaProps, "variant" | "radius">;

/** Multi-line text field: same states as Input (component-specs §4), height grows with content. */
export function Textarea({ classNames, labelPlacement = "outside", ...rest }: TextareaProps) {
  const styles = getInputClasses();
  return (
    <HeroTextarea
      variant="bordered"
      labelPlacement={labelPlacement}
      classNames={{
        ...classNames,
        input: cx(styles.input, classNames?.input),
        inputWrapper: cx(styles.inputWrapper, "h-auto min-h-20 py-2", classNames?.inputWrapper),
        label: cx(styles.label, classNames?.label),
        errorMessage: cx(styles.errorMessage, classNames?.errorMessage),
        description: cx(styles.description, classNames?.description),
      }}
      {...rest}
    />
  );
}
