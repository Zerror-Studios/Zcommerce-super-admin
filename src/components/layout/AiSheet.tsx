/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The Zcom AI surface (round 2 G3, docs/review-r2/ROUND-2-FIXES.md; styles `.zc-ai-surface` in
 * src/styles/components.css). One floating card in three sizes, morphing between them with a shared-layout
 * spring (motion.ts `spring.layout`):
 * - box (step 1, click on the bar or ⌘J): a card as wide as the bar (560) and 560 tall, radius 22, growing up from
 *   where the bar sits.
 *   It grows out of the bar (the bar and the card share `AI_SURFACE_LAYOUT_ID`), the page is not dimmed, and a
 *   click outside closes it. Its 48px header: orb, "Zcom AI · sees ‹Page›" (13px), history, expand ⤢, close.
 * - full (⤢ from the box): the box grows straight into the centred full view (board 46) with the history column on
 *   the left (developer, 2026-11-06: no half-height step).
 * - half: kept only for callers that still ask for it (the LEGACY `expanded={false}` default).
 * Shrink and Esc step back one level (full → box → closed). Phone (v2 §10): the box is a bottom sheet at
 * 70% height whose handle drags (or taps) it to full; there is no half size.
 *
 * Each app's own panel (store AskZcomPanel, console AskZcomPlatformPanel) renders inside:
 * <AiSheet> → <AiSheetContent> → <AiSheetHeader> + <AiSheetBody> + <AiSheetFooter>.
 * <AiComposer> is the reply box in every size: a pill input with a round blue send and one line under it.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/Button";
import { Orb } from "../ui/Orb";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconAdd, IconArrowRight, IconClose, IconMaximize, IconMinimize } from "../ui/icons";
import { DUR_1_S, DUR_2_S, EXIT_S, spring } from "../ui/motion";
import { useIsPhone } from "../ui/use-media";

/** The line every answer ends with (v2 §3.3, round 2 G3). */
export const AI_CONSENT_LINE = "Nothing is sent or changed until you say yes.";

/** The line under the reply box (board 46). */
export const AI_COMPOSER_NOTE = "Zcom can make mistakes. It asks before changing anything.";

/** The closed bar (Assistant.tsx AskBar) and the open surface share this id, so the box grows out of the bar. */
export const AI_SURFACE_LAYOUT_ID = "zc-ai-surface";

export type AiSheetSize = "box" | "half" | "full";

const DRAG_THRESHOLD = 40;
const TAP_SLOP_PX = 6;
/** The content fades in this long after the surface starts to grow (§2: 60ms). */
const CONTENT_DELAY_S = 0.06;
/** Corner radii per size, in style (framer-motion corrects radii it animates only when they are inline). */
const RADIUS = { bar: 26, box: 22, half: 24, full: 28 } as const;
/** Layers opened from inside the surface (menus, confirm dialogs) never count as "outside". */
const OTHER_LAYER_SELECTOR =
  '[role="menu"], [role="listbox"], [role="alertdialog"], [role="dialog"]:not(.zc-ai-surface):not(.zc-rail-overlay)';

interface AiSheetContextValue {
  size: AiSheetSize;
  isPhone: boolean;
  setSize: (size: AiSheetSize) => void;
  close: () => void;
}

const AiSheetContext = createContext<AiSheetContextValue | null>(null);

/** The size on screen (box / half / full); "box" outside an AiSheet. */
export function useAiSheetSize(): AiSheetSize {
  return useContext(AiSheetContext)?.size ?? "box";
}

/**
 * Expand: the chat box itself grows into the full view, with no half-height step in between (developer,
 * 2026-11-06; round 2 G3 had box → half → full).
 */
function grow(): AiSheetSize {
  return "full";
}

/** Shrink / Esc: the full view (or a legacy half view) goes straight back to the chat box. */
function shrink(): AiSheetSize {
  return "box";
}

function radiusStyle(size: AiSheetSize, isPhone: boolean) {
  if (isPhone) {
    const top = size === "full" ? 0 : RADIUS.box;
    return { borderTopLeftRadius: top, borderTopRightRadius: top, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 };
  }
  if (size === "half") {
    return {
      borderTopLeftRadius: RADIUS.half,
      borderTopRightRadius: RADIUS.half,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    };
  }
  const all = size === "full" ? RADIUS.full : RADIUS.box;
  return { borderTopLeftRadius: all, borderTopRightRadius: all, borderBottomLeftRadius: all, borderBottomRightRadius: all };
}

export interface AiSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The size on screen. Defaults to "half" / "full" from the LEGACY `expanded`. */
  size?: AiSheetSize;
  onSizeChange?: (size: AiSheetSize) => void;
  /** LEGACY: true = full. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Accessible name of the surface. */
  label?: string;
  /** <AiSheetContent> with <AiSheetHeader> and the conversation. */
  children: ReactNode;
}

export function AiSheet({
  isOpen,
  onClose,
  size: sizeProp,
  onSizeChange,
  expanded,
  onExpandedChange,
  label = "Zcom AI",
  children,
}: AiSheetProps) {
  const isPhone = useIsPhone();
  const reduced = useReducedMotion() ?? false;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const requested = sizeProp ?? (expanded ? "full" : "half");
  // Phone has no half size: the sheet is 70% (box) or full.
  const size: AiSheetSize = isPhone && requested === "half" ? "full" : requested;
  const dimmed = isPhone || size !== "box";

  const setSize = (next: AiSheetSize) => {
    onSizeChange?.(next);
    onExpandedChange?.(next === "full");
  };

  // Esc steps back one level; a layer opened inside (a menu, a confirm dialog) handles its own Esc first.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector(OTHER_LAYER_SELECTOR)) return;
      event.preventDefault();
      if (size === "box") onClose();
      else setSize(shrink());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // setSize only forwards to the props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, size, isPhone, onClose]);

  // The box (no dim) closes on a press anywhere outside it, except in a layer it opened and on the bar.
  useEffect(() => {
    if (!isOpen || dimmed) return undefined;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || surfaceRef.current?.contains(target)) return;
      if (target.closest(OTHER_LAYER_SELECTOR) || target.closest(".zc-askbar")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, dimmed, onClose]);

  // Focus goes back where it was (the bar, or the page) when the surface closes.
  useEffect(() => {
    if (isOpen) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return undefined;
    }
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
    return undefined;
  }, [isOpen]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && dimmed ? (
        <motion.div
          key="zc-ai-scrim"
          aria-hidden
          className="zc-ai-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: DUR_2_S } }}
          exit={{ opacity: 0, transition: { duration: EXIT_S } }}
          onClick={onClose}
        />
      ) : null}
      {isOpen ? (
        <motion.div
          key="zc-ai-surface"
          ref={surfaceRef}
          role="dialog"
          aria-modal={dimmed ? true : undefined}
          aria-label={label}
          layoutId={AI_SURFACE_LAYOUT_ID}
          className={cx("zc-ai-surface", `zc-ai-surface--${size}`)}
          style={radiusStyle(size, isPhone)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: EXIT_S } }}
          transition={reduced ? { duration: DUR_1_S } : { layout: spring.layout, opacity: { duration: DUR_1_S } }}
        >
          <AiSheetContext.Provider value={{ size, isPhone, setSize, close: onClose }}>
            <motion.div
              layout={reduced ? false : "position"}
              className="zc-ai-surface__content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: reduced ? 0 : CONTENT_DELAY_S, duration: DUR_1_S } }}
            >
              {children}
            </motion.div>
          </AiSheetContext.Provider>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** The column inside the surface: header, then the scrolling body, then the footer. */
export function AiSheetContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("zc-ai-surface__column", className)}>{children}</div>;
}

/** The scrolling conversation. */
export function AiSheetBody({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("zc-ai-surface__body custom-scroll", className)} {...rest}>
      {children}
    </div>
  );
}

/** The bottom of the surface: the reply box (pinned). */
export function AiSheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("zc-ai-surface__footer", className)}>{children}</div>;
}

export interface AiSheetHeaderProps {
  /** What the assistant sees: the current page ("Orders"). Shown as "Zcom AI · sees Orders". */
  context?: ReactNode;
  /** Replaces the title (e.g. "Conversations" in the history view). */
  title?: ReactNode;
  /** Before the title (a back button in the history view). Defaults to the orb. */
  leading?: ReactNode;
  /** Extra header buttons before expand and close (history). */
  actions?: ReactNode;
  /** LEGACY: the surface's own size is used. */
  expanded?: boolean;
  /** LEGACY: the surface's own size is used. */
  onExpandedChange?: (expanded: boolean) => void;
  /** LEGACY: the surface's own close is used when this is missing. */
  onClose?: () => void;
  /** Busy: the orb thinks. */
  thinking?: boolean;
  /** Full view: the conversation title in the plain header. Default "New chat". */
  fullTitle?: ReactNode;
}

/**
 * Box and half size: the 48px header (grab handle on phone; orb, "Zcom AI · sees ‹page›" in 13px, the app's
 * actions, expand ⤢ and close; the half size adds shrink). Full view (board 46): a plain header with the
 * conversation title, shrink and close; the app's actions stay on phone, where the history column is hidden.
 */
export function AiSheetHeader({ context, title, leading, actions, onClose, thinking = false, fullTitle }: AiSheetHeaderProps) {
  const sheet = useContext(AiSheetContext);
  const size = sheet?.size ?? "box";
  const isPhone = sheet?.isPhone ?? false;
  const close = onClose ?? sheet?.close ?? (() => undefined);
  const setSize = (next: AiSheetSize) => sheet?.setSize(next);
  const dragStart = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (start == null) return;
    const delta = event.clientY - start;
    if (delta < -DRAG_THRESHOLD) setSize(grow());
    else if (delta > DRAG_THRESHOLD) {
      if (size === "box") close();
      else setSize(shrink());
    } else if (Math.abs(delta) < TAP_SLOP_PX) {
      // A tap toggles the phone sheet between 70% and full.
      setSize(size === "full" ? "box" : "full");
    }
  };

  const closeButton = (
    <IconButton aria-label="Close Zcom AI" size="sm" onPress={close}>
      <IconClose />
    </IconButton>
  );

  if (size === "full" && !isPhone) {
    return (
      <header className="zc-ai-sheet__bar">
        <h2 className="min-w-0 flex-1 truncate text-body-strong text-fg">{fullTitle ?? "New chat"}</h2>
        <IconButton aria-label="Shrink" size="sm" onPress={() => setSize(shrink())}>
          <IconMinimize />
        </IconButton>
        {closeButton}
      </header>
    );
  }

  return (
    <header className="zc-ai-surface__header">
      {isPhone ? (
        <button
          type="button"
          className="zc-ai-sheet__handle"
          aria-label={size === "full" ? "Shrink Zcom AI" : "Expand Zcom AI"}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={(event) => {
            // A keyboard press (no drag) toggles the size.
            if (event.detail === 0) setSize(size === "full" ? "box" : "full");
          }}
        />
      ) : null}
      {leading ?? <Orb state={thinking ? "thinking" : "idle"} />}
      <h2 className="zc-ai-surface__title">
        {title ?? (
          <>
            Zcom AI
            {context ? <span className="text-fg-muted"> · sees {context}</span> : null}
          </>
        )}
      </h2>
      {actions}
      {isPhone ? null : (
        <>
          {size === "half" ? (
            <IconButton aria-label="Shrink to the chat box" size="sm" onPress={() => setSize("box")}>
              <IconMinimize />
            </IconButton>
          ) : null}
          <IconButton
            aria-label={size === "box" ? "Expand" : "Expand to full view"}
            size="sm"
            onPress={() => setSize(grow())}
          >
            <IconMaximize />
          </IconButton>
        </>
      )}
      {closeButton}
    </header>
  );
}

/** Empty state: "How can I help?" with three suggestion rows for the current page (config/ask-suggestions.ts). */
export function AiSheetWelcome({
  suggestions,
  onAsk,
  disabled,
  note,
}: {
  suggestions: readonly string[];
  onAsk: (question: string) => void;
  disabled?: boolean;
  /** One line under the heading (what the answers use). */
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 py-2">
      <div>
        <p className="text-title-2 text-fg">How can I help?</p>
        {note ? <p className="mt-1 text-label text-fg-muted">{note}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        {suggestions.slice(0, 3).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(suggestion)}
            className="zc-ai-line text-left text-label text-fg transition-colors duration-1 hover:border-brand disabled:opacity-50"
          >
            <Orb />
            <span className="min-w-0 flex-1">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The line under every finished answer (G3): one optional action, then "Nothing is sent or changed until you say yes." */
export function AiAnswerFooter({ action }: { action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {action}
      <p className="text-caption text-fg-subtle">{AI_CONSENT_LINE}</p>
    </div>
  );
}

export interface AiSheetHistoryProps {
  /** Starts a new conversation ("+ New chat"). */
  onNewChat: () => void;
  newChatDisabled?: boolean;
  /** The conversation list (grouped Today / This week / Earlier by the app). */
  children: ReactNode;
  /** The usage line at the bottom ("1,994 of 2,000 questions left this month"). */
  footer?: ReactNode;
}

/**
 * The full view's left column (board 46): the orb in a gradient circle with "Zcom AI", a "+ New chat" pill, the
 * conversations (scrolling), and the usage line at the bottom. Hidden on phone (the header keeps the history button).
 */
export function AiSheetHistory({ onNewChat, newChatDisabled, children, footer }: AiSheetHistoryProps) {
  return (
    <aside className="zc-ai-rail" aria-label="Conversations">
      <div className="zc-ai-rail__brand">
        <span aria-hidden className="zc-ai-rail__orb">
          <Orb onDark />
        </span>
        <b>Zcom AI</b>
      </div>
      <Button
        variant="secondary"
        size="sm"
        startIcon={<IconAdd aria-hidden />}
        onPress={onNewChat}
        isDisabled={newChatDisabled}
        className="zc-ai-rail__new"
      >
        New chat
      </Button>
      <div className="zc-ai-rail__list custom-scroll">{children}</div>
      {footer != null ? <div className="zc-ai-rail__footer">{footer}</div> : null}
    </aside>
  );
}

export interface AiComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Enter (without Shift) or the send button. */
  onSubmit: () => void;
  /** The field can't be used (no questions left, no access). */
  isDisabled?: boolean;
  /** The send button is off (busy, empty, too long). */
  canSend?: boolean;
  /** Default "Ask anything, or tell Zcom what to do…". */
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
  /** Hide the field and keep the note (e.g. waiting for a second sign-in step). */
  hideField?: boolean;
  /** Above the field: "Stop answering". */
  before?: ReactNode;
  /** The line under the field. Default AI_COMPOSER_NOTE. */
  note?: ReactNode;
  /** Right of the note: the character count. */
  meta?: ReactNode;
}

/**
 * The Zcom AI reply box (board 46): a pill field (16px text) with a round blue send button, and one small centred
 * line under it ("Zcom can make mistakes. It asks before changing anything."). Enter sends, Shift+Enter adds a line.
 */
export function AiComposer({
  value,
  onValueChange,
  onSubmit,
  isDisabled = false,
  canSend = true,
  placeholder = "Ask anything, or tell Zcom what to do…",
  maxLength,
  autoFocus,
  "aria-label": ariaLabel = "Ask Zcom AI a question",
  hideField = false,
  before,
  note,
  meta,
}: AiComposerProps) {
  const send = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (canSend && !isDisabled) onSubmit();
  };
  return (
    <div className="zc-ai-composer">
      {before}
      {hideField ? null : (
        <form className="zc-ai-composer__field" onSubmit={send} data-disabled={isDisabled || undefined}>
          <textarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) send(event);
            }}
            rows={1}
            maxLength={maxLength}
            disabled={isDisabled}
            autoFocus={autoFocus}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="zc-ai-composer__input"
          />
          <button type="submit" aria-label="Send" disabled={!canSend || isDisabled} className="zc-ai-composer__send">
            <IconArrowRight aria-hidden className="-rotate-90" />
          </button>
        </form>
      )}
      <div className="zc-ai-composer__foot">
        <p>{note ?? AI_COMPOSER_NOTE}</p>
        {meta != null ? <div className="zc-ai-composer__meta">{meta}</div> : null}
      </div>
    </div>
  );
}
