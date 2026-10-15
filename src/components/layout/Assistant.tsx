/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Ask bar + assistant panel (docs/design/02-components.md §16 items 3–4, ref 01/04). Render only when the `ai`
 * flag is on. The app supplies `onAsk`; until a backend exists it returns sample answers marked as such.
 */
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AiThinking, Sparkle } from "../ui/Ai";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { IconAdd, IconArrowRight, IconClose } from "../ui/icons";
import { IconButton } from "../ui/IconButton";
import { Kbd } from "../ui/Primitives";

export interface AiAnswer {
  text: ReactNode;
  /** Small data card: "Conversion by device · last 7 days" with label/value rows. */
  card?: { title: string; rows: { label: string; value: string; share?: number; tone?: "danger" }[] };
  /** Buttons that open or prefill something — never run an action automatically. */
  actions?: { label: string; href?: string; onPress?: () => void; primary?: boolean }[];
  /** "Used: orders, sessions · 8–14 Oct". */
  used?: string;
  /** True for sample answers while the assistant isn't connected. */
  sample?: boolean;
}

interface Turn {
  question: string;
  answer?: AiAnswer;
}

const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ";

// ─── Ask bar ─────────────────────────────────────────────────────────────────

/** Floating bottom-centre bar: sparkle · placeholder · ⌘J · send. Hides on scroll down (the shell passes `hidden`). */
export function AskBar({ placeholder, hidden, onOpen }: { placeholder: string; hidden: boolean; onOpen: (question?: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onOpen(value.trim() || undefined);
    setValue("");
  };
  return (
    <form
      onSubmit={submit}
      aria-label="Ask the assistant"
      className={cx(
        "ai-edge pointer-events-auto flex h-12 w-full items-center gap-2 rounded-[14px] bg-surface/90 pl-4 pr-2 shadow-popover backdrop-blur-md transition-all duration-base ease-standard",
        hidden ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <Sparkle />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-body text-fg outline-hidden placeholder:text-fg-placeholder"
        style={{ boxShadow: "none" }}
      />
      <Kbd className="hidden sm:inline-flex">{MOD_KEY}J</Kbd>
      <button
        type="submit"
        aria-label="Ask"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fg text-brand-on transition-opacity hover:opacity-90"
      >
        <IconArrowRight aria-hidden className="size-4 -rotate-90" />
      </button>
    </form>
  );
}

// ─── Assistant panel ─────────────────────────────────────────────────────────

export interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Question to ask as soon as the panel opens (from the Ask bar or ⌘K). */
  pendingQuestion?: string;
  onPendingConsumed?: () => void;
  onAsk: (question: string) => Promise<AiAnswer>;
  suggestions: string[];
  /** "Analysing your store…" */
  thinkingLabel?: string;
}

/** Right drawer, 420px: header → conversation → suggestion chips → input → disclaimer. */
export function AssistantPanel({
  isOpen,
  onClose,
  pendingQuestion,
  onPendingConsumed,
  onAsk,
  suggestions,
  thinkingLabel = "Looking at your data…",
}: AssistantPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setTurns((list) => [...list, { question: text }]);
    try {
      const answer = await onAsk(text);
      setTurns((list) => list.map((turn, i) => (i === list.length - 1 ? { ...turn, answer } : turn)));
    } catch {
      setTurns((list) =>
        list.map((turn, i) =>
          i === list.length - 1 ? { ...turn, answer: { text: "Couldn't get an answer. Try again in a moment." } } : turn,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen && pendingQuestion) {
      void ask(pendingQuestion);
      onPendingConsumed?.();
    }
    // Only when a new question arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingQuestion]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      placement="right"
      hideCloseButton
      backdrop="transparent"
      classNames={{ base: "w-full max-w-[420px] rounded-none border-l border-line bg-surface shadow-modal" }}
    >
      <DrawerContent>
        <DrawerHeader className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Sparkle />
          <h2 className="flex-1 text-body font-semibold text-fg">Assistant</h2>
          <IconButton aria-label="New chat" size="sm" onPress={() => setTurns([])}>
            <IconAdd />
          </IconButton>
          <IconButton aria-label="Close assistant" size="sm" onPress={onClose}>
            <IconClose />
          </IconButton>
        </DrawerHeader>

        <DrawerBody className="custom-scroll gap-5 px-4 py-4">
          {turns.length === 0 ? (
            <p className="text-body text-fg-muted">Ask about sales, orders, customers or anything on this page.</p>
          ) : null}
          {turns.map((turn, index) => (
            <div key={index} className="flex flex-col gap-3">
              <p className="self-end rounded-xl bg-surface-sunken px-3 py-2 text-body text-fg">{turn.question}</p>
              {turn.answer ? (
                <AnswerView answer={turn.answer} onNavigate={(href) => { navigate(href); onClose(); }} />
              ) : (
                <AiThinking status={thinkingLabel} />
              )}
            </div>
          ))}
          <div ref={endRef} />
        </DrawerBody>

        <DrawerFooter className="flex-col gap-2 border-t border-line px-4 py-3">
          {suggestions.length ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button key={suggestion} variant="secondary" size="sm" onPress={() => void ask(suggestion)} isDisabled={busy}>
                  {suggestion}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="ai-edge flex items-end gap-2 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
              setDraft("");
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(draft);
                  setDraft("");
                }
              }}
              rows={2}
              placeholder="Ask a follow-up…"
              aria-label="Ask a follow-up"
              className="min-h-10 flex-1 resize-none bg-transparent px-1 text-body text-fg outline-hidden placeholder:text-fg-placeholder"
              style={{ boxShadow: "none" }}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={busy}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fg text-brand-on disabled:opacity-50"
            >
              <IconArrowRight aria-hidden className="size-4 -rotate-90" />
            </button>
          </form>
          <p className="text-center text-caption text-fg-subtle">AI can make mistakes. Check numbers before acting.</p>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function AnswerView({ answer, onNavigate }: { answer: AiAnswer; onNavigate: (href: string) => void }) {
  return (
    <div className="flex flex-col gap-3 text-body text-fg">
      <div>{answer.text}</div>
      {answer.card ? (
        <div className="rounded-xl border border-line p-3">
          <p className="mb-2 text-label text-fg-muted">{answer.card.title}</p>
          <ul className="flex flex-col gap-2.5">
            {answer.card.rows.map((row) => (
              <li key={row.label}>
                <div className="flex justify-between text-body">
                  <span>{row.label}</span>
                  <span className={cx("num", row.tone === "danger" ? "text-tone-danger-text" : "text-fg")}>{row.value}</span>
                </div>
                {row.share != null ? (
                  <div className="mt-1 h-1 rounded-full bg-surface-sunken">
                    <div
                      className={cx("h-1 rounded-full", row.tone === "danger" ? "bg-tone-danger-dot" : "bg-fg")}
                      style={{ width: `${Math.max(0, Math.min(100, row.share))}%` }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {answer.actions?.length ? (
        <div className="flex flex-wrap gap-2">
          {answer.actions.map((action) => (
            <Button
              key={action.label}
              variant={action.primary ? "primary" : "secondary"}
              size="sm"
              onPress={() => (action.href ? onNavigate(action.href) : action.onPress?.())}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {answer.used || answer.sample ? (
        <p className="text-caption text-fg-subtle">
          {answer.sample ? "Sample answer: the assistant isn't connected yet." : null}
          {answer.sample && answer.used ? " · " : null}
          {answer.used}
        </p>
      ) : null}
    </div>
  );
}
