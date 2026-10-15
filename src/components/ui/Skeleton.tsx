/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Skeleton as HeroSkeleton } from "@heroui/react";
import type { SkeletonProps as HeroSkeletonProps } from "@heroui/react";
import { cx } from "./cx";

export type SkeletonProps = HeroSkeletonProps;

/** Loading placeholder (component-specs §23): match the final layout, 8px radius. */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return <HeroSkeleton className={cx("rounded-lg", className)} {...rest} />;
}
