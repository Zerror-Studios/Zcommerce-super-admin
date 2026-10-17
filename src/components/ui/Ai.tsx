/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * AI layer (docs/design/02-components.md §16, ref 01/03/04). One visual language: the sparkle icon and the
 * spectrum, reserved for AI. Three states on every AI surface: ready (.ai-edge), thinking (.ai-live, only while
 * a request runs), suggestion (tinted box, never overwrites user content until Accept).
 * Render these only when useAiEnabled() is true.
 */
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconCheck, IconClose } from "./icons";
import { IconButton } from "./IconButton";

// ─── Sparkle ─────────────────────────────────────────────────────────────────

/** Gradient used by every sparkle. Render once near the app root. */
export function AiSpectrumDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="ai-spectrum" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--zc-ai-1)" />
          <stop offset="55%" stopColor="var(--zc-ai-2)" />
          <stop offset="100%" stopColor="var(--zc-ai-3)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The AI sparkle (16px default). Decorative: the surrounding text says what it is. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cx("size-4 shrink-0", className)} style={{ strokeWidth: 0 }}>
      <path fill="url(#ai-spectrum)" d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6-5.6-2.1 5.6-2.1z" />
      <path fill="url(#ai-spectrum)" d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </svg>
  );
}

// ─── Today's brief ───────────────────────────────────────────────────────────

export interface TodaysBriefProps {
  /** One sentence. Hidden when there's nothing useful to say (pass null). */
  message: ReactNode | null;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  className?: string;
}

/** One-line strip on Home: sparkle · "Today's brief." + one sentence · one secondary button · dismiss. */
export function TodaysBrief({ message, action, onDismiss, className }: TodaysBriefProps) {
  if (!message) return null;
  return (
    <section aria-label="Today's brief" className={cx("ai-edge flex items-center gap-3 px-4 py-3", className)}>
      <Sparkle />
      <p className="min-w-0 flex-1 text-body text-fg-muted">
        <span className="font-semibold text-fg">Today&apos;s brief.</span> {message}
      </p>
      {action ? (
        <Button variant="secondary" size="sm" onPress={action.onPress} className="shrink-0">
          {action.label}
        </Button>
      ) : null}
      {onDismiss ? (
        <IconButton aria-label="Dismiss brief" size="sm" onPress={onDismiss}>
          <IconClose />
        </IconButton>
      ) : null}
    </section>
  );
}

// ─── Insight card ────────────────────────────────────────────────────────────

export interface AiInsightCardProps {
  title: ReactNode;
  body: ReactNode;
  action?: { label: string; onPress: () => void };
  /** "Based on orders and sessions, 15 Sep – 14 Oct". */
  source: ReactNode;
  onDismiss?: () => void;
  /** "just now", "2h ago". */
  when?: string;
  className?: string;
}

/** Insight (Analytics, store detail): max one per page. Helpful / Not helpful feedback is local for now. */
export function AiInsightCard({ title, body, action, source, onDismiss, when = "just now", className }: AiInsightCardProps) {
  return (
    <section className={cx("ai-edge p-5", className)}>
      <p className="flex items-center gap-1.5 text-caption text-fg-subtle">
        <Sparkle className="size-3.5" />
        Insight · {when}
      </p>
      <h3 className="mt-2 text-body font-semibold text-fg">{title}</h3>
      <div className="mt-1 text-body text-fg-muted">{body}</div>
      {action || onDismiss ? (
        <div className="mt-4 flex gap-2">
          {action ? (
            <Button size="sm" onPress={action.onPress}>
              {action.label}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button variant="ghost" size="sm" onPress={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 border-t border-line-subtle pt-3 text-caption text-fg-subtle">
        <p>{source}</p>
        <AiFeedback className="mt-1" />
      </div>
    </section>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

/**
 * "Helpful · Not helpful" under every AI answer and insight (docs/design/06-qa-checklist.md §AI).
 * Local only until there's an endpoint; `onFeedback` lets the app record it.
 */
export function AiFeedback({ onFeedback, className }: { onFeedback?: (helpful: boolean) => void; className?: string }) {
  const [sent, setSent] = useState(false);
  const send = (helpful: boolean) => {
    setSent(true);
    onFeedback?.(helpful);
  };
  return (
    <p className={cx("text-caption text-fg-subtle", className)}>
      {sent ? (
        "Thanks for the feedback."
      ) : (
        <>
          <button type="button" className="rounded-xs hover:text-fg" onClick={() => send(true)}>
            Helpful
          </button>{" "}
          ·{" "}
          <button type="button" className="rounded-xs hover:text-fg" onClick={() => send(false)}>
            Not helpful
          </button>
        </>
      )}
    </p>
  );
}

// ─── Thinking ────────────────────────────────────────────────────────────────

export interface AiThinkingProps {
  /** "Analysing the last 30 days…" */
  status: ReactNode;
  /** Optional progress steps (shown after ~10s or when known). */
  steps?: { label: string; done: boolean }[];
  className?: string;
}

/** Thinking state: rotating spectrum edge + shimmer text + skeleton lines. Only while a request is running. */
export function AiThinking({ status, steps, className }: AiThinkingProps) {
  return (
    <div role="status" aria-live="polite" className={cx("ai-live p-4", className)}>
      <p className="flex items-center gap-2 text-body">
        <Sparkle />
        <span className="ai-shimmer">{status}</span>
      </p>
      <div aria-hidden className="mt-3 flex flex-col gap-2">
        <span className="h-2.5 w-11/12 rounded-full bg-surface-sunken" />
        <span className="h-2.5 w-3/4 rounded-full bg-surface-sunken" />
        <span className="h-2.5 w-1/2 rounded-full bg-surface-sunken" />
      </div>
      {steps?.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-label">
          {steps.map((step) => (
            <li key={step.label} className={cx("flex items-center gap-2", step.done ? "text-fg" : "text-fg-subtle")}>
              {step.done ? (
                <IconCheck aria-hidden className="size-3.5 text-tone-success" />
              ) : (
                <span aria-hidden className="mx-1 size-1.5 rounded-full bg-ai" />
              )}
              {step.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Suggestion ──────────────────────────────────────────────────────────────

export interface AiSuggestionProps {
  text: ReactNode;
  onAccept: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  /** Quick refinements ("Shorter", "More premium"). */
  chips?: { label: string; onPress: () => void }[];
  className?: string;
}

/** Inline suggestion inside a form: tinted dashed box, Accept · Try again · Discard. Never auto-applied. */
export function AiSuggestion({ text, onAccept, onRetry, onDiscard, chips, className }: AiSuggestionProps) {
  return (
    <div className={className}>
      <div className="rounded-lg border border-dashed border-ai-tint-border bg-ai-tint p-3">
        <div className="text-body text-fg">{text}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onPress={onAccept}>
            Accept
          </Button>
          <Button variant="ghost" size="sm" onPress={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onPress={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
      {chips?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onPress}
              className="rounded-sm bg-ai-tint px-2 py-1 text-label font-medium text-ai hover:bg-surface-sunken"
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Write with AI ───────────────────────────────────────────────────────────

/** Small secondary button next to a field label. */
export function WriteWithAiButton({ onPress, isLoading }: { onPress: () => void; isLoading?: boolean }) {
  return (
    <Button variant="secondary" size="sm" startIcon={<Sparkle />} onPress={onPress} isLoading={isLoading}>
      Write with AI
    </Button>
  );
}
