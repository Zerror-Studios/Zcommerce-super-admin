/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The Zcom AI sheet (docs/design-v2/README.md §3.3; styles `.zc-ai-sheet` in src/styles/components.css). The bar at
 * the bottom of every page opens it (click or ⌘J) as a bottom sheet over about half the viewport, the full width of
 * the content area, with a 24px radius on the top corners; the page above stays visible, dimmed 28%. The expand
 * button (or dragging the handle up) grows it to the full height with the chat history on the left; shrink returns
 * to half; Esc or close returns to the bar. Phone (v2 §10): it opens at 70% of the height and the handle (drag up,
 * or tap) takes it to full. Each app's own panel (store AskZcomPanel, console AskZcomPlatformPanel)
 * renders its conversation inside: <AiSheet> → <DrawerContent> → <AiSheetHeader> + body + footer.
 *
 * Full view (board 46): from 768px up a centred panel (max 1180px, radius 28, a thin gradient line on top) over the
 * dimmed app. <AiSheetHistory> is its left column: the orb with "Zcom AI", a "+ New chat" pill, the conversations,
 * and the usage line at the bottom. The header turns plain white with only the conversation title, shrink and close.
 * <AiComposer> is the reply box in both sizes: a pill input with a round blue send and the "Zcom can make mistakes"
 * line under it.
 */
import { Drawer, DrawerHeader } from "@heroui/react";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Orb } from "../ui/Orb";
import { cx } from "../ui/cx";
import { IconButton } from "../ui/IconButton";
import { IconAdd, IconArrowRight, IconClose, IconMaximize, IconMinimize } from "../ui/icons";

/** The line every answer ends with (v2 §3.3). */
export const AI_CONSENT_LINE = "Nothing is sent or changed until you say yes.";

/** The line under the reply box (board 46). */
export const AI_COMPOSER_NOTE = "Zcom can make mistakes. It asks before changing anything.";

/** Opening: the sheet rises in 220ms (transform only, v2 §2.4). */
const sheetMotion = {
  variants: {
    enter: { y: 0, opacity: 1, transition: { duration: 0.22, ease: [0, 0, 0.2, 1] as const } },
    exit: { y: "100%", opacity: 1, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const } },
  },
};

const DRAG_THRESHOLD = 40;
const TAP_SLOP_PX = 6;

export interface AiSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Full height with the history on the left. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** <DrawerContent> with <AiSheetHeader> and the conversation. */
  children: ReactNode;
}

export function AiSheet({ isOpen, onClose, expanded, children }: AiSheetProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      placement="bottom"
      hideCloseButton
      motionProps={sheetMotion}
      classNames={{
        base: cx("zc-ai-sheet", expanded && "zc-ai-sheet--full"),
        backdrop: "zc-ai-sheet-backdrop",
      }}
    >
      {children}
    </Drawer>
  );
}

export interface AiSheetHeaderProps {
  /** What the assistant sees: the current page ("Orders"). Shown as "Zcom AI · sees Orders". */
  context?: ReactNode;
  /** Replaces the title (e.g. "Conversations" in the history view). */
  title?: ReactNode;
  /** Before the title (a back button in the history view). Defaults to the white orb. */
  leading?: ReactNode;
  /** Extra header buttons before expand and close (history, new chat). */
  actions?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  /** Busy: the orb thinks. */
  thinking?: boolean;
  /** Full view: the conversation title in the plain header. Default "New chat". */
  fullTitle?: ReactNode;
}

/**
 * Half size: the gradient header strip (grab handle, "Zcom AI · sees ‹page›", the app's actions, expand and close).
 * Full view (board 46): a plain white header with only the conversation title, shrink and close; the app's actions
 * stay on phone, where the history column is hidden.
 */
export function AiSheetHeader({
  context,
  title,
  leading,
  actions,
  expanded,
  onExpandedChange,
  onClose,
  thinking = false,
  fullTitle,
}: AiSheetHeaderProps) {
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
    if (delta < -DRAG_THRESHOLD) onExpandedChange(true);
    else if (delta > DRAG_THRESHOLD) {
      if (expanded) onExpandedChange(false);
      else onClose();
    } else if (Math.abs(delta) < TAP_SLOP_PX) {
      // A tap (no drag) toggles the size too: phones have no expand button (v2 §10, opens at 70%, drags to full).
      onExpandedChange(!expanded);
    }
  };

  if (expanded) {
    return (
      <DrawerHeader className="zc-ai-sheet__bar">
        <h2 className="min-w-0 flex-1 truncate text-body-strong text-fg">{fullTitle ?? "New chat"}</h2>
        {actions ? <div className="flex items-center gap-1 md:hidden">{actions}</div> : null}
        <IconButton aria-label="Shrink to half" variant="default" size="sm" onPress={() => onExpandedChange(false)}>
          <IconMinimize />
        </IconButton>
        <IconButton aria-label="Close Zcom AI" variant="default" size="sm" onPress={onClose}>
          <IconClose />
        </IconButton>
      </DrawerHeader>
    );
  }

  return (
    <DrawerHeader className="zc-ai-sheet__header">
      <button
        type="button"
        className="zc-ai-sheet__handle"
        aria-label={expanded ? "Shrink Zcom AI" : "Expand Zcom AI"}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={(event) => {
          // A keyboard press (no drag) toggles the size.
          if (event.detail === 0) onExpandedChange(!expanded);
        }}
      />
      {leading ?? <Orb onDark state={thinking ? "thinking" : "idle"} />}
      <h2 className="min-w-0 flex-1 truncate text-body-strong text-white">
        {title ?? (
          <>
            Zcom AI
            {context ? <span className="font-normal text-white/75"> · sees {context}</span> : null}
          </>
        )}
      </h2>
      {actions}
      <IconButton
        aria-label={expanded ? "Shrink to half" : "Expand to full view"}
        size="sm"
        onPress={() => onExpandedChange(!expanded)}
        className="max-md:hidden"
      >
        {expanded ? <IconMinimize /> : <IconMaximize />}
      </IconButton>
      <IconButton aria-label="Close Zcom AI" size="sm" onPress={onClose}>
        <IconClose />
      </IconButton>
    </DrawerHeader>
  );
}

/** Empty state of the sheet: "How can I help today?" with three suggestions for the current page. */
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
        <p className="text-title-2 text-fg">How can I help today?</p>
        {note ? <p className="mt-1 text-body text-fg-muted">{note}</p> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {suggestions.slice(0, 3).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(suggestion)}
            className="zc-ai-line text-left text-label text-fg transition-colors duration-fast hover:border-brand disabled:opacity-50"
          >
            <Orb />
            <span className="min-w-0 flex-1">{suggestion}</span>
          </button>
        ))}
      </div>
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
 * The Zcom AI reply box (board 46): a pill field with a round blue send button, and one small centred line under it
 * ("Zcom can make mistakes. It asks before changing anything."). Enter sends, Shift+Enter adds a line.
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
