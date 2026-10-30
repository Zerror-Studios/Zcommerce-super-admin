/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { IconClose } from "./icons";

export interface FilterChipProps {
  /** "Status: Active". */
  children: ReactNode;
  onRemove: () => void;
  /** Names the × button; defaults to "Remove filter". */
  removeLabel?: string;
  className?: string;
}

/**
 * Applied filter under a table toolbar (01 §7.12, `.zc-chip`): 28px capsule, blue soft fill, a 20px circle ×.
 * Chips sit in a row with 8px gaps, followed by a tertiary sm "Clear all".
 */
export function FilterChip({ children, onRemove, removeLabel = "Remove filter", className }: FilterChipProps) {
  return (
    <span className={cx("zc-chip", className)}>
      {children}
      <button type="button" className="zc-chip__remove" aria-label={removeLabel} onClick={onRemove}>
        <IconClose aria-hidden />
      </button>
    </span>
  );
}

export interface OptionChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  pressed: boolean;
  children: ReactNode;
}

/**
 * A choice inside the filter drawer (01 §7.12, `.zc-option`), multi-select: 32px white capsule; selected is
 * black with white text (blue stays for actions only).
 */
export function OptionChip({ pressed, className, children, ...rest }: OptionChipProps) {
  return (
    <button type="button" aria-pressed={pressed} className={cx("zc-option", className)} {...rest}>
      {children}
    </button>
  );
}
