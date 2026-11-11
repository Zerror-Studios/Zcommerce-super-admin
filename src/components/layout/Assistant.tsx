/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Zcom AI bar (round 2 G3; docs/design-v2/README.md §3.3) + the LEGACY right-drawer assistant panel (the apps now render their
 * own panels inside the shared AiSheet). Render only when the `ai` flag is on. The app supplies `onAsk`; until a backend exists it returns sample answers marked as such.
 */
import { DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AiFeedback, AiThinking } from "../ui/Ai";
import { Orb } from "../ui/Orb";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { Drawer } from "../ui/Drawer";
import { IconAdd, IconArrowRight, IconClose } from "../ui/icons";
import { IconButton } from "../ui/IconButton";
import { DUR_2_S, EASE_OUT, spring } from "../ui/motion";
import { Tooltip } from "../ui/Tooltip";
import { AI_SURFACE_LAYOUT_ID } from "./AiSheet";

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
  /** The request failed: the answer is our error line, so no source or feedback under it. */
  failed?: boolean;
}

/** The bar's corner radius (G3: 26), inline so the shared-layout morph keeps it round. */
const ASK_BAR_RADIUS = 26;

const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ";

// ─── Ask bar ─────────────────────────────────────────────────────────────────

export interface AskBarProps {
  /** "Ask Zcom AI anything…" (store) / "Ask Zcom AI about any store…" (console). */
  placeholder?: string;
  /** True while the user scrolls down: the bar slides away (the shell's slot moves it). */
  hidden?: boolean;
  /** Opens the chat box; with a question, asks it straight away. */
  onOpen: (question?: string) => void;
  /** LEGACY: ignored. Round 2 G3: the suggestions moved into the chat box. */
  suggestion?: string;
  /** Round 3 B2: hover or focus, so the app can load the chat box before the click. */
  onIntent?: () => void;
  /** Round 3 B3: the store's plan has no Zcom AI; hover shows the plan it comes with ("Standard"). */
  lockedPlan?: string;
}

/**
 * The Zcom AI bar (round 2 G3, `.zc-askbar`): the ONLY AI entry point. A white 52px pill, radius 26, at most 560px
 * wide, fixed at the bottom centre of the whole viewport (the shell's slot places it). Only the orb (28px) and the
 * placeholder: no chip and no shortcut hint; ⌘J / Ctrl J still works and shows in the tooltip only. A click opens the
 * chat box, which grows out of the bar (shared layout id with AiSheet). The page hides it while the box is open.
 */
export function AskBar({ placeholder = "Ask Zcom AI anything…", hidden = false, onOpen, onIntent, lockedPlan }: AskBarProps) {
  // Round 3 B1: hover dims the page behind by 8% (no blur); the bar's own hover is CSS (ai-motion.css).
  const [hovered, setHovered] = useState(false);
  const dim =
    typeof document === "undefined"
      ? null
      : createPortal(<div aria-hidden className="zc-ai-dim" data-state={hovered && !hidden ? "hover" : "idle"} />, document.body);
  return (
    <>
    {dim}
    <Tooltip content={`Ask Zcom AI (${MOD_KEY}J)`} placement="top" isDisabled={hidden}>
      <motion.button
        type="button"
        layoutId={AI_SURFACE_LAYOUT_ID}
        onClick={() => onOpen()}
        onPointerEnter={() => {
          setHovered(true);
          onIntent?.();
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => onIntent?.()}
        aria-label={placeholder}
        aria-keyshortcuts="Meta+J Control+J"
        className="zc-askbar pointer-events-auto"
        style={{ borderRadius: ASK_BAR_RADIUS }}
        transition={{ layout: spring.layout }}
      >
        {/* Own layer: framer-motion keeps the orb and text at their real shape while the bar reshapes (no
            stretching when the chat box closes back into it), and they fade in as the bar settles. */}
        <motion.span
          layout="position"
          className="zc-askbar__inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ opacity: { duration: DUR_2_S, delay: DUR_2_S, ease: EASE_OUT } }}
        >
          <Orb size="bar" state={hovered && !hidden ? "listening" : "idle"} />
          <span className="zc-askbar__placeholder">{placeholder}</span>
          {lockedPlan ? <span className="zc-askbar__chip">{lockedPlan}</span> : null}
        </motion.span>
      </motion.button>
    </Tooltip>
    </>
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
          i === list.length - 1
            ? { ...turn, answer: { text: "Couldn't get an answer. Try again in a moment." }, failed: true }
            : turn,
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
    // Round 3 D1: "nearest" scrolls the chat only, never the page behind it.
    endRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [turns]);

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      hideCloseButton
      size="sm"
      classNames={{ base: "!max-w-[var(--zc-assistant-w)] !rounded-none border-l border-line" }}
    >
      <DrawerContent>
        {/* 56px header (02 §6): AI tile + "Zcom AI", ghost circles for New chat and Close. */}
        <DrawerHeader className="!min-h-14 !flex-row items-center gap-2 border-b border-line-subtle !py-2 !pl-4 !pr-3">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[image:var(--zc-ai-gradient)]">
            <svg viewBox="0 0 24 24" className="size-3.5 fill-white">
              <path d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6-5.6-2.1 5.6-2.1z" />
            </svg>
          </span>
          <h2 className="flex-1 text-title-3 text-fg">Zcom AI</h2>
          <IconButton aria-label="New chat" variant="ghost" size="sm" onPress={() => setTurns([])}>
            <IconAdd />
          </IconButton>
          <IconButton aria-label="Close assistant" variant="ghost" size="sm" onPress={onClose}>
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
                <AnswerView answer={turn.answer} failed={turn.failed} onNavigate={(href) => { navigate(href); onClose(); }} />
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
              className="min-h-10 flex-1 resize-none bg-transparent px-1 text-body text-fg outline-hidden placeholder:text-fg-placeholder max-md:text-base"
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

function AnswerView({
  answer,
  failed,
  onNavigate,
}: {
  answer: AiAnswer;
  failed?: boolean;
  onNavigate: (href: string) => void;
}) {
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
      {failed ? null : <AiFeedback />}
    </div>
  );
}
