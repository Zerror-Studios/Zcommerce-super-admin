/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * AI-style steps (docs/review-r3/ROUND-3-FIXES.md A3, B6, §12.1): a short list that ticks one step at a time.
 * Used by the Super Admin → store opening card, the Zcom AI "thinking" state and long jobs (imports, exports).
 *
 * - wait: grey dot, faint text · work: spinning ring, ink text, one shimmer · done: a green tick that draws in
 *   (200ms), muted text · error: red ×, one plain sentence, and Try again.
 * - The steps follow real progress. `useMinStepTime` paces what is shown so each step works for at least
 *   `min` ms and steps tick one after another, never all at once (a cached load still reads as three calm steps).
 * - Styles: `.zc-ai-steps*` in src/styles/ai-motion.css. Transform, opacity and SVG stroke only.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "./Button";
import { cx } from "./cx";
import { DUR_2_S, EASE_OUT, spring } from "./motion";
import { AI_STEP_MIN_MS, nextShownSteps, type AiStepState } from "./ai-steps-pacing";
import { Orb } from "./Orb";

export { AI_STEP_MIN_MS, nextShownSteps };
export type { AiStepState };

// ─── Types ─────────────────────────────────────────────────────────────────


export interface AiStep {
  label: string;
  state: AiStepState;
  /** Shown instead of the label when the step failed ("Couldn't load orders"). */
  error?: string;
}

export interface AiStepsProps {
  steps: AiStep[];
  /** Heading next to the orb ("Kesar & Kin"); none in the chat. */
  title?: ReactNode;
  /** card: the floating 360px card (store opening); inline: inside the AI chat, no card chrome. */
  variant?: "card" | "inline";
  /**
   * When set, the steps are collapsed into one grey line ("Checked orders and stock · 1.8 s") that expands on
   * click (B6: once the answer starts streaming).
   */
  summary?: string;
  /** Shows "Try again" under the list when a step failed. */
  onRetry?: () => void;
  className?: string;
}

// ─── Pacing ────────────────────────────────────────────────────────────────

/**
 * Paces real step states so each shown change comes at least `min` ms after the previous one: steps tick one by
 * one at a calm pace even when the data is already there, and never faster. Errors and retries show at once.
 */
export function useMinStepTime(real: AiStepState[], min = AI_STEP_MIN_MS): AiStepState[] {
  const [shown, setShown] = useState<AiStepState[]>(() => real.map(() => "wait"));
  const lastChange = useRef(Number.NEGATIVE_INFINITY);
  const realKey = real.join(",");
  const shownKey = shown.join(",");

  useEffect(() => {
    const next = nextShownSteps(shown, real);
    if (!next) return undefined;
    const apply = () => {
      lastChange.current = performance.now();
      setShown(next.states);
    };
    if (next.immediate) {
      apply();
      return undefined;
    }
    const wait = Math.max(0, lastChange.current + min - performance.now());
    const timer = window.setTimeout(apply, wait);
    return () => window.clearTimeout(timer);
    // The keys carry the arrays' contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realKey, shownKey, min]);

  return shown;
}

// ─── Component ─────────────────────────────────────────────────────────────

function StepIcon({ state }: { state: AiStepState }) {
  return (
    <span className="zc-ai-step__icon" aria-hidden>
      <AnimatePresence mode="wait" initial={false}>
        {state === "wait" ? (
          <motion.span key="wait" className="zc-ai-step__dot" exit={{ opacity: 0 }} transition={{ duration: 0.08 }} />
        ) : null}
        {state === "work" ? (
          <motion.span key="work" className="zc-ai-step__ring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }} />
        ) : null}
        {state === "done" ? (
          <motion.svg key="done" viewBox="0 0 16 16" width="16" height="16" className="zc-ai-step__tick">
            <motion.path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            />
          </motion.svg>
        ) : null}
        {state === "error" ? (
          <motion.span key="error" className="zc-ai-step__x" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
            ×
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function AiSteps({ steps, title, variant = "card", summary, onRetry, className }: AiStepsProps) {
  const reduced = useReducedMotion() ?? false;
  const [expanded, setExpanded] = useState(false);
  const failed = steps.some((step) => step.state === "error");
  const collapsed = !!summary && !expanded;

  const list = (
    <ol className="zc-ai-steps__list" aria-live="polite">
      {steps.map((step, index) => (
        <motion.li
          key={step.label}
          className={cx("zc-ai-step", `zc-ai-step--${step.state}`)}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: DUR_2_S } : { ...spring.snappy, delay: index * 0.06 }}
        >
          <StepIcon state={step.state} />
          <span className={cx("zc-ai-step__text", step.state === "work" && "zc-shimmer-once")}>
            {step.state === "error" ? (step.error ?? step.label) : step.label}
          </span>
          <span className="sr-only">
            {step.state === "done" ? " (done)" : step.state === "work" ? " (in progress)" : step.state === "error" ? " (failed)" : ""}
          </span>
        </motion.li>
      ))}
    </ol>
  );

  return (
    <motion.div
      className={cx("zc-ai-steps", variant === "card" ? "zc-ai-steps--card" : "zc-ai-steps--inline", className)}
      role="status"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={reduced ? { duration: DUR_2_S } : spring.snappy}
    >
      {title ? (
        <div className="zc-ai-steps__head">
          <Orb size="lg" state={failed ? "idle" : "thinking"} />
          <span className="zc-ai-steps__title">{title}</span>
        </div>
      ) : null}
      {summary ? (
        <button type="button" className="zc-ai-steps__summary" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          <span>{summary}</span>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden className={cx("zc-ai-steps__chev", expanded && "is-open")}>
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      {collapsed ? null : list}
      {failed && onRetry ? (
        <Button variant="secondary" size="sm" className="zc-ai-steps__retry" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </motion.div>
  );
}

export default AiSteps;
