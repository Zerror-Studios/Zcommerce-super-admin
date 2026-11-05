/**
 * The body of a row opened in place (design v2 §7 "rows open in place").
 *
 * The shared DataTable has no expandable rows yet, so the Stores table inserts one extra row under the opened
 * one and renders this in its first cell: a spacer that gives the row the panel's height, and the panel itself,
 * positioned across the full card width (`100cqw` of the `@container` around the table). Kit change proposed:
 * a DataTable `renderExpanded(row)` + `expandedKeys` that renders a real `colSpan` row (HeroUI's TableCell
 * supports `colSpan`); this file goes away then.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface InPlaceDetailProps {
  /** Names the region for screen readers ("Kesar & Kin at a glance"). */
  label: string;
  children: ReactNode;
}

export function InPlaceDetail({ label, children }: InPlaceDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node) return undefined;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div aria-hidden style={{ height }} />
      <div
        ref={panelRef}
        role="region"
        aria-label={label}
        className="absolute top-0 left-[calc(var(--spacing-cell-x)*-1)] w-[calc(100cqw-2px)] cursor-auto px-cell-x pb-4 whitespace-normal animate-rise-in"
      >
        {children}
      </div>
    </div>
  );
}
