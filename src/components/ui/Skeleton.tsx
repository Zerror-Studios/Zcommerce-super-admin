/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Skeleton as HeroSkeleton } from "@heroui/react";
import type { SkeletonProps as HeroSkeletonProps } from "@heroui/react";
import { cx } from "./cx";

export type SkeletonProps = HeroSkeletonProps;

/** Loading placeholder (docs/design/02-components.md §15): shaped like the real content, muted grey, soft sheen. */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <HeroSkeleton
      className={cx(
        "rounded-lg bg-surface-sunken before:via-surface-muted before:[animation-duration:1.6s] after:bg-surface-sunken",
        className,
      )}
      {...rest}
    />
  );
}
