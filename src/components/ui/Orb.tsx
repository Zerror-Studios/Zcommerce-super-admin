/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Design v2 AI pieces (docs/design-v2/README.md §3.4, §4.8; styles `.zc-orb-dots`, `.zc-ai-panel`, `.zc-ai-line` in
 * src/styles/components.css). The orb goes in front of every AI suggestion: suggestion lines, insight cards, draft
 * replies, the Zcom AI bar. It replaces the static sparkle. Since 2026-11-11 (owner) it is a sphere of dots drawn by
 * `orb-dots.ts`, with a state for each phase of the AI's work; since 2026-11-25 it moves as in the owner's
 * "AI glyph · All states in one loop" video (no glow, idle → thinking → answering → done).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { mountOrb, type OrbHandle } from "./orb-dots";

export type OrbState = "idle" | "listening" | "thinking" | "working" | "done" | "waiting";
export type OrbSize = "sm" | "lg" | "bar" | "hero";

export interface OrbProps {
  /**
   * The "AI glyph · All states" video (owner, 2026-11-25): idle: a slow turn, 10 s a turn · thinking: the spin eases
   * up, a ripple travels up the globe, a gentle breath · working (answering: steps running, answer streaming): a band
   * of bright dots sweeps up · done: one slow breath while the turn slows to a stop, then back to idle · listening (the
   * user is typing): a quicker turn with a gentle breath · waiting: folds into a still cube (stuck, waiting for the
   * user).
   */
  state?: OrbState;
  /** sm 18px (default), lg 28px, bar 30px (the Zcom AI bar), hero 120px (the sign-in character, AuthBuddy). */
  size?: OrbSize;
  /** White dots for dark and blue backgrounds (AI card, summary panel, Home hero, the dark Zcom AI button). */
  onDark?: boolean;
  /** Screen-reader text; the orb is decorative by default. */
  label?: string;
  className?: string;
}

/** The animated dot-sphere orb (§3.4). Draws one still frame under reduced motion. */
export function Orb({ state = "idle", size = "sm", onDark = false, label, className }: OrbProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<OrbHandle | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // A new size or colour builds a new drawing; the state alone only blends the motion.
  useEffect(() => {
    if (!canvasRef.current || !boxRef.current) return undefined;
    const handle = mountOrb(canvasRef.current, boxRef.current, stateRef.current, onDark);
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [size, onDark]);

  useEffect(() => {
    handleRef.current?.setMotion(state);
  }, [state]);

  return (
    <span
      ref={boxRef}
      className={cx("zc-orb-dots", size !== "sm" && `zc-orb-dots--${size}`, className)}
      data-state={state}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <canvas ref={canvasRef} className="zc-orb-dots__canvas" />
    </span>
  );
}

/** How long the glyph stays "done" after an answer: its breath and stop (≈ 4 s), then it eases back into idle. */
const DONE_HOLD_MS = 4500;

/**
 * True for a few seconds after `busy` turns false, so a chat header can show the glyph's done stage (one breath
 * while the turn slows to a stop) before it goes back to idle. Pass whether the AI is working on a turn.
 */
export function useOrbJustFinished(busy: boolean): boolean {
  const [finished, setFinished] = useState(false);
  const wasBusy = useRef(busy);
  useEffect(() => {
    const ended = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (busy) {
      setFinished(false);
      return undefined;
    }
    if (!ended) return undefined;
    setFinished(true);
    const timer = window.setTimeout(() => setFinished(false), DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);
  return finished;
}

export interface AiCardProps {
  headline: ReactNode;
  /** One line under the headline. */
  body?: ReactNode;
  /** Up to two buttons: the action (secondary, white here) and an optional ghost one. */
  actions?: ReactNode;
  /** Small label over the headline ("Zcom AI"). */
  eyebrow?: ReactNode;
  className?: string;
}

/** AI card (§4.8): the one blue gradient, white text, the white orb, a headline, one line and two buttons. */
export function AiCard({ headline, body, actions, eyebrow = "Zcom AI", className }: AiCardProps) {
  return (
    <section className={cx("zc-ai-panel flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 text-micro text-white/80">
        <Orb onDark />
        <span>{eyebrow}</span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-title-2 text-white">{headline}</h3>
        {body != null ? <p className="text-body text-white/80">{body}</p> : null}
      </div>
      {actions ? <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
    </section>
  );
}

export interface AiLineProps {
  /** One sentence. */
  children: ReactNode;
  /** One link or small button at the end. */
  action?: ReactNode;
  className?: string;
}

/** Insight line (§4.8): light blue fill, the orb, one sentence and one link. */
export function AiLine({ children, action, className }: AiLineProps) {
  return (
    <div className={cx("zc-ai-line", className)}>
      <Orb />
      <p className="min-w-0 flex-1 text-label text-fg">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
