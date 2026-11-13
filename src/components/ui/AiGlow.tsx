/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The Zcom AI edge glow (round 3 B5; Apple Intelligence style since 2026-11-13, owner): a soft iridescent light
 * around every edge of the screen whose colours keep turning round the frame, while the AI box or the large view
 * is open (not on the AI bar's hover: owner, 2026-11-13).
 *
 * - Open: the light sweeps in from the screen edges (450ms). Close: it fades back out (300ms), then unmounts.
 * - States: idle, typing (brighter), thinking (brightest, turns 3× faster), answering (bright).
 * - Pure CSS (styles in src/styles/ai-motion.css): two layers (a wide soft glow and a thin bright rim), each a large
 *   conic gradient spinning under a static edge mask; only transform and opacity animate, no blur filter. Paused
 *   while the tab is hidden; reduced motion shows the light still.
 * - Rendered in place (no portal): AiSheet puts it in its own portal right before the AI box, so the box (same
 *   z-index, later in the page) sits on top and the light sits above the page's dim.
 */
import { useEffect, useState } from "react";

export type AiGlowState = "idle" | "typing" | "thinking" | "answering";

export interface AiGlowProps {
  /** The AI box or the large view is open. */
  open: boolean;
  state?: AiGlowState;
}

/** How long the close animation runs before the layer unmounts (the light fades in 300ms). */
export const AI_GLOW_EXIT_MS = 320;

function useDocumentHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}

export function AiGlow({ open, state = "idle" }: AiGlowProps) {
  const [mounted, setMounted] = useState(open);
  const hidden = useDocumentHidden();

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setMounted(false), AI_GLOW_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className="zc-ai-frame zc-ai-glow"
      data-state={state}
      data-phase={open ? "open" : "closing"}
      data-paused={hidden || undefined}
      aria-hidden
    >
      {/* Two layers: a wide soft glow and a thin bright rim. */}
      <span className="zc-ai-frame__layer zc-ai-frame__layer--soft">
        <span className="zc-ai-frame__spin" />
      </span>
      <span className="zc-ai-frame__layer zc-ai-frame__layer--rim">
        <span className="zc-ai-frame__spin" />
      </span>
    </div>
  );
}

export default AiGlow;
