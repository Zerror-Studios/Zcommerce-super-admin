/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The Zcom AI bottom glow (docs/review-r3/ROUND-3-FIXES.md B5, §12.3): a Siri-like edge light along the very
 * bottom of the screen plus a flowing blue glow above it, while the AI box or the large view is open.
 *
 * - Open: the edge draws out from the centre (360ms), then the glow rises (400ms).
 * - States: idle (edge .8, glow .55), typing (glow .7), thinking (edge 1, glow .85, 2× flow, a pulse runs
 *   left → right every 1.4s), answering (edge .9, glow .65).
 * - Close: the glow sinks (300ms) and the edge shrinks to the centre, then it unmounts.
 * - Pure CSS (one fixed layer, blurred divs, transform/opacity only); paused while the tab is hidden; reduced
 *   motion shows a still glow at .4 (styles in src/styles/ai-motion.css).
 * - Rendered in place (no portal): AiSheet puts it in its own portal right before the AI box, so the box (same
 *   z-index, later in the page) sits on top and the glow sits above the page's dim.
 */
import { useEffect, useState } from "react";

export type AiGlowState = "idle" | "typing" | "thinking" | "answering";

export interface AiGlowProps {
  /** The AI box or the large view is open. */
  open: boolean;
  state?: AiGlowState;
}

/** How long the close animation runs before the layer unmounts (B5: the glow sinks in 300ms). */
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

  const phase = open ? "open" : "closing";
  return (
    <>
      <div className="zc-ai-glow" data-state={state} data-phase={phase} data-paused={hidden || undefined} aria-hidden>
        <div className="zc-ai-glow__inner">
          <span className="zc-ai-glow__b zc-ai-glow__b1" />
          <span className="zc-ai-glow__b zc-ai-glow__b2" />
          <span className="zc-ai-glow__b zc-ai-glow__b3" />
          <span className="zc-ai-glow__b zc-ai-glow__b4" />
          <span className="zc-ai-glow__wave" />
        </div>
      </div>
      <div className="zc-ai-edge" data-state={state} data-phase={phase} data-paused={hidden || undefined} aria-hidden>
        <span className="zc-ai-edge__line" />
      </div>
    </>
  );
}

export default AiGlow;
