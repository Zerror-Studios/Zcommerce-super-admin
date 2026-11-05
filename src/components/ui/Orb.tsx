/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Design v2 AI pieces (docs/design-v2/README.md §3.4, §4.8; styles `.zc-orb`, `.zc-ai-panel`, `.zc-ai-line` in
 * src/styles/components.css). The orb goes in front of every AI suggestion: suggestion lines, insight cards, draft
 * replies, the Zcom AI bar. It replaces the static sparkle.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconCheck } from "./icons";

export type OrbState = "idle" | "listening" | "thinking" | "done";
export type OrbSize = "sm" | "lg" | "bar";

export interface OrbProps {
  /** idle: slow; listening: the core pulses and a ring ripples; thinking: fast spin and ring; done: still, with a tick. */
  state?: OrbState;
  /** sm 18px (default), lg 28px, bar 30px (the Zcom AI bar). */
  size?: OrbSize;
  /** The white-edged variant for dark backgrounds (AI card, summary panel, sign-in). */
  onDark?: boolean;
  /** Screen-reader text; the orb is decorative by default. */
  label?: string;
  className?: string;
}

/** The animated orb glyph (§3.4). Transform and opacity only; still under reduced motion. */
export function Orb({ state = "idle", size = "sm", onDark = false, label, className }: OrbProps) {
  return (
    <span
      className={cx("zc-orb-wrap", className)}
      data-state={state}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className={cx("zc-orb", size !== "sm" && `zc-orb--${size}`, onDark && "zc-orb--white")} />
      {state === "listening" || state === "thinking" ? <span className="zc-orb-wrap__ring" /> : null}
      {state === "done" ? (
        <span className="zc-orb-wrap__tick">
          <IconCheck aria-hidden />
        </span>
      ) : null}
    </span>
  );
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
