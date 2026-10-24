/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * AI layer (docs/design/02-components.md §16, 08 §1.3, 09 §2A). One visual language: the sparkle, the spectrum
 * avatar and the spectrum edge, reserved for AI. People know how Claude and ChatGPT look, so AI writing is one
 * chat card under the field (AiSuggestion): never inside the field, never auto-applied until "Use this".
 * While a request runs the card edge rotates (.ai-live).
 */
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconArrowRight, IconSend, IconCheck, IconClose, IconEdit, IconUndo } from "./icons";
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

// ─── Avatar ──────────────────────────────────────────────────────────────────

/** 28px spectrum circle with a white sparkle: who is speaking in every AI card (09 §2A). */
export function AiAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-full", className)}
      style={{ background: "var(--zc-ai-gradient)" }}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" style={{ strokeWidth: 0 }}>
        <path fill="var(--zc-surface)" d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6-5.6-2.1 5.6-2.1z" />
        <path fill="var(--zc-surface)" d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      </svg>
    </span>
  );
}

// ─── Today's brief ───────────────────────────────────────────────────────────

export interface BriefLine {
  /** Bold: what to do ("Pack 12 orders before 4 pm"). */
  what: ReactNode;
  /** Muted: why ("that's when Delhivery picks up"). */
  why?: ReactNode;
}

export interface TodaysBriefProps {
  /** Up to three lines (08 §2.1); extra lines are dropped. */
  lines?: BriefLine[];
  /** One blue action, then up to two secondary. */
  actions?: { label: string; onPress: () => void }[];
  /** "Ask AI →" in the header; opens the assistant panel. */
  onAskAi?: () => void;
  /** LEGACY one-sentence brief (shown as a single line). Hidden when null. */
  message?: ReactNode | null;
  /** LEGACY single action (secondary). */
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  className?: string;
}

/**
 * Today's brief (08 §2.1, 09 §2A): the AI card without the ask input. Spectrum avatar · "Today's brief" ·
 * Ask AI →; at most three lines at 15/23, each "**what to do** — why"; actions at the bottom.
 */
export function TodaysBrief({ lines, actions, onAskAi, message, action, onDismiss, className }: TodaysBriefProps) {
  const shown = (lines?.length ? lines : message ? [{ what: message }] : []).slice(0, 3);
  if (!shown.length) return null;
  const buttons = (actions ?? (action ? [action] : [])).slice(0, 3);
  const legacy = !actions && !!action;
  return (
    <section aria-label="Today's brief" className={cx("ai-edge flex flex-col gap-3 rounded-panel px-4.5 py-4", className)}>
      <div className="flex items-center gap-2.5">
        <AiAvatar />
        <h2 className="flex-1 text-body font-semibold text-fg">Today&apos;s brief</h2>
        {onAskAi ? (
          <Button variant="link" size="sm" onPress={onAskAi} endIcon={<IconArrowRight aria-hidden />}>
            Ask AI
          </Button>
        ) : null}
        {onDismiss ? (
          <IconButton aria-label="Dismiss brief" size="sm" onPress={onDismiss}>
            <IconClose />
          </IconButton>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {shown.map((line, index) => (
          <li key={index} className="text-lead text-fg-muted">
            <span className="font-semibold text-fg">{line.what}</span>
            {line.why ? <> — {line.why}</> : null}
          </li>
        ))}
      </ul>
      {buttons.length ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {buttons.map((button, index) => (
            <Button
              key={button.label}
              size="sm"
              variant={index === 0 && !legacy ? "primary" : "secondary"}
              onPress={button.onPress}
            >
              {button.label}
            </Button>
          ))}
        </div>
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

// ─── Ask input ───────────────────────────────────────────────────────────────

export interface AiAskInputProps {
  onSend: (prompt: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
}

/** 40px ask field: pencil icon, placeholder, dark 28px send button (09 §2A row 4). Enter sends. */
export function AiAskInput({
  onSend,
  placeholder = "Ask for changes — shorter, add care notes, add sizing…",
  isDisabled,
  className,
}: AiAskInputProps) {
  const [value, setValue] = useState("");
  const send = () => {
    const prompt = value.trim();
    if (!prompt || isDisabled) return;
    onSend(prompt);
    setValue("");
  };
  return (
    <div
      className={cx(
        "flex h-10 items-center gap-2 rounded-thumb border border-line-strong bg-surface pl-3 pr-1.5 focus-within:border-brand",
        className,
      )}
    >
      <IconEdit aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            send();
          }
        }}
        disabled={isDisabled}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none focus-visible:shadow-none"
      />
      <button
        type="button"
        aria-label="Send"
        onClick={send}
        disabled={isDisabled || !value.trim()}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-field bg-ai-send text-brand-on transition-opacity disabled:opacity-40"
      >
        <IconSend aria-hidden className="size-4" />
      </button>
    </div>
  );
}

// ─── Suggestion ──────────────────────────────────────────────────────────────

export interface AiSuggestionProps {
  /** The suggested text. While `isLoading`, it is replaced by a shimmer. */
  text?: ReactNode;
  /** After "AI suggestion": "· a more premium version of your description". */
  subtitle?: ReactNode;
  onUse: () => void;
  onKeep: () => void;
  /** Free-text refinement from the ask input; the new suggestion replaces this one in place. */
  onAsk?: (prompt: string) => void;
  /** Brings back the previous suggestion (the ↶ next to ×). */
  onUndo?: () => void;
  isLoading?: boolean;
  /** "I couldn't reach the AI service. Try again." with one retry button. */
  error?: ReactNode;
  onRetry?: () => void;
  /** Faint note on the right of the buttons. */
  note?: ReactNode;
  askPlaceholder?: string;
  className?: string;
}

/**
 * The one AI suggestion card (docs/design/09-settings-and-scale.md §2A, ref 13): sits 12px BELOW the field it
 * helps, never inside it; everything left-aligned to one edge. Header (avatar · AI suggestion · subtitle · ×) →
 * text 15/23 → Use this (blue) · Keep mine → ask input. Nothing is written until Use this.
 */
export function AiSuggestion({
  text,
  subtitle,
  onUse,
  onKeep,
  onAsk,
  onUndo,
  isLoading,
  error,
  onRetry,
  note = "Replaces the text above · you can undo",
  askPlaceholder,
  className,
}: AiSuggestionProps) {
  return (
    <section
      aria-label="AI suggestion"
      aria-busy={isLoading || undefined}
      className={cx(isLoading ? "ai-live" : "ai-edge", "flex flex-col gap-3 rounded-panel px-4.5 py-4", className)}
    >
      <div className="flex items-center gap-2.5">
        <AiAvatar />
        <p className="min-w-0 flex-1 truncate text-body">
          <span className="font-semibold text-fg">AI suggestion</span>
          {subtitle ? <span className="text-fg-muted"> · {subtitle}</span> : null}
        </p>
        {onUndo ? (
          <IconButton aria-label="Previous suggestion" size="sm" onPress={onUndo}>
            <IconUndo />
          </IconButton>
        ) : null}
        <IconButton aria-label="Close suggestion" size="sm" onPress={onKeep}>
          <IconClose />
        </IconButton>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-body text-fg-muted">
          {error}
          {onRetry ? (
            <Button variant="secondary" size="sm" onPress={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : isLoading ? (
        <div role="status" aria-label="Writing" className="flex h-6 items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              aria-hidden
              className="size-1.5 animate-pulse rounded-full bg-ai"
              style={{ animationDelay: `${dot * 160}ms` }}
            />
          ))}
        </div>
      ) : (
        <div className="whitespace-pre-line text-lead text-fg">{text}</div>
      )}

      {!error ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onPress={onUse} isDisabled={isLoading || !text}>
            Use this
          </Button>
          <Button variant="secondary" size="sm" onPress={onKeep}>
            Keep mine
          </Button>
          {note ? <span className="ml-auto text-caption text-fg-subtle">{note}</span> : null}
        </div>
      ) : null}

      {onAsk ? <AiAskInput onSend={onAsk} isDisabled={isLoading} placeholder={askPlaceholder} /> : null}
    </section>
  );
}

// ─── Write with AI ───────────────────────────────────────────────────────────

/**
 * AI button (08 §1.3): white with a 1px spectrum border and a gradient sparkle. Next to a field label by
 * default ("Write with AI"); pass a label for "Improve with AI", "Write for me", "Draft with AI".
 */
export function WriteWithAiButton({
  onPress,
  isLoading,
  label = "Write with AI",
  size = "sm",
}: {
  onPress: () => void;
  isLoading?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <Button
      variant="secondary"
      size={size}
      startIcon={<Sparkle />}
      onPress={onPress}
      isLoading={isLoading}
      className="btn-ai border-transparent data-[hover=true]:border-transparent"
    >
      {label}
    </Button>
  );
}
