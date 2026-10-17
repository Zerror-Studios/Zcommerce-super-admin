/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Spinner as HeroSpinner } from "@heroui/react";
import type { SpinnerProps as HeroSpinnerProps } from "@heroui/react";

export type SpinnerProps = Omit<HeroSpinnerProps, "color">;

/** Spinner for buttons and small inline areas only (component-specs §23). Data pages use Skeleton. */
export function Spinner({ size = "sm", ...rest }: SpinnerProps) {
  return <HeroSpinner color="primary" size={size} {...rest} />;
}
