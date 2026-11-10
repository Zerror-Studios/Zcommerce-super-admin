/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Loading block (01 §7.21, `.zc-skel` in src/styles/components.css): sunken grey that appears only after 200ms
 * (`--zc-skeleton-delay`: fast data never flashes a skeleton) and pulses once (1.2s, opacity); a plain fade with reduced
 * motion. Size and shape it like the real content:
 * text 12px high at 40–80% width, avatar = circle, thumbnail 40×40 rounded-lg, badge 22×64, chart 180px.
 */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return <div aria-hidden className={cx("zc-skel", className)} {...rest} />;
}
