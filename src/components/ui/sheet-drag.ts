/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Phone bottom sheets (docs/review-r2/ROUND-2-FIXES.md §8.5): drag a sheet down by its grab handle or its title
 * row to close it. The sheet follows the finger; on release it closes when it moved far enough (a third of its
 * height, at most 120px) or was flicked down fast, and otherwise springs back with `spring.soft`. Used by the kit
 * Modal and Drawer in phone mode; buttons, links and fields in the title row keep their own taps.
 */
import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { spring } from "./motion";

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Released this far down (px), the sheet closes. */
const CLOSE_DISTANCE_PX = 120;
/** …or this share of its own height, when that is less. */
const CLOSE_FRACTION = 0.3;
/** A flick down faster than this (px per ms) closes it from any distance past `MIN_FLICK_PX`. */
const CLOSE_VELOCITY_PX_PER_MS = 0.6;
const MIN_FLICK_PX = 8;
/** The grab-handle zone at the top of the sheet (px). */
const HANDLE_ZONE_PX = 28;
/** Velocity is measured over the last few moves only. */
const VELOCITY_SAMPLES = 5;

const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [role="tab"], [contenteditable="true"]';
const DRAG_ZONE = ".zc-modal__header, .zc-drawer__header";

interface DragState {
  id: number;
  startY: number;
  sheet: HTMLElement;
  samples: Array<{ y: number; t: number }>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Drag-to-close for the open sheet that carries `sheetClass`. `enabled` is false on tablet and up, and for
 * sheets that can't be dismissed. `reduced` (prefers-reduced-motion) snaps back without the spring.
 */
export function useSheetDrag(enabled: boolean, sheetClass: string, onDismiss: () => void, reduced: boolean) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!enabled) return undefined;
    let drag: DragState | null = null;

    const setOffset = (sheet: HTMLElement, y: number) => {
      sheet.style.transform = y > 0 ? `translateY(${y}px)` : "";
    };

    const onDown = (event: PointerEvent) => {
      if (drag || event.button !== 0 || !(event.target instanceof Element)) return;
      const sheet = event.target.closest<HTMLElement>(`.${sheetClass}`);
      if (!sheet || event.target.closest(INTERACTIVE)) return;
      const inHandle = event.clientY - sheet.getBoundingClientRect().top <= HANDLE_ZONE_PX;
      if (!inHandle && !event.target.closest(DRAG_ZONE)) return;
      drag = { id: event.pointerId, startY: event.clientY, sheet, samples: [{ y: event.clientY, t: event.timeStamp }] };
    };

    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.samples = [...drag.samples.slice(1 - VELOCITY_SAMPLES), { y: event.clientY, t: event.timeStamp }];
      setOffset(drag.sheet, Math.max(0, event.clientY - drag.startY));
    };

    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { sheet, samples, startY } = drag;
      drag = null;
      const offset = event.type === "pointercancel" ? 0 : Math.max(0, event.clientY - startY);
      const first = samples[0];
      const velocity = (event.clientY - first.y) / Math.max(1, event.timeStamp - first.t);
      const far = offset > Math.min(CLOSE_DISTANCE_PX, sheet.offsetHeight * CLOSE_FRACTION);
      const flick = offset > MIN_FLICK_PX && velocity > CLOSE_VELOCITY_PX_PER_MS;
      if (far || flick) {
        dismissRef.current();
        return;
      }
      if (reduced || offset === 0) {
        setOffset(sheet, 0);
        return;
      }
      animate(offset, 0, {
        ...spring.soft,
        onUpdate: (value) => setOffset(sheet, value),
        onComplete: () => setOffset(sheet, 0),
      });
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, [enabled, sheetClass, reduced]);
}

/** A class name that is safe to put in a selector, from React's `useId`. */
export function sheetClassName(id: string): string {
  return `zc-sheet-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
