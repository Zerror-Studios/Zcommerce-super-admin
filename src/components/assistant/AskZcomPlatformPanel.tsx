/**
 * Ask ZCOM for staff (backend PRD-026 FR-7.2, guide §12)
 *
 * Opened from the Zcom AI bar or ⌘J (the one AI entry point, v2 §3.3); the layout
 * shows it only with `platform:ai:ask` (Owner and Admin). Header with
 * conversations and new chat, the internal budget bar, the conversation
 * (streamed answers with tool chips, the final answer rendered by
 * `AssistantMarkdown` with store names linked, Stop, Retry, 👍/👎), then
 * the input (1–1000 characters, one question at a time). Conversations
 * are private to each staff member and kept 90 days.
 *
 * Console-owned on purpose: the SYNCED kit's `AssistantPanel` stays the
 * single request/answer shape shared with the dashboard.
 */

import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  AiSteps,
  useMinStepTime,
  type AiGlowState,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  formatRelative,
  toastError,
} from "../ui";
import { cx } from "../ui/cx";
import { thinkingSteps, thinkingSummary } from "../ui/ai-thinking";
import { IconAdd, IconBack, IconChat, IconDelete, IconTime } from "../ui/icons";
import {
  AiAnswerFooter,
  AiComposer,
  AiSheet,
  AiSheetBody,
  AiSheetContent,
  AiSheetFooter,
  AiSheetHeader,
  AiSheetHistory,
  AiSheetWelcome,
  type AiSheetSize,
} from "../layout/AiSheet";
import { AiUsageBar } from "./AiUsageBar";
import { AssistantMarkdown } from "./AssistantMarkdown";
import {
  PLATFORM_ASSISTANT_CONVERSATIONS,
  PLATFORM_ASSISTANT_DELETE_CONVERSATION,
  PLATFORM_ASSISTANT_USAGE,
} from "../../graphql/platform-insights";
import { useAskZcomPlatform } from "../../hooks/use-ask-zcom-platform";
import { formatSources, isTurnBusy, type AskTurn } from "../../lib/ask-zcom-platform.util";
import { ASK_MAX_LENGTH, ASK_SUGGESTIONS, runStatusNote } from "../../lib/platform-insights.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type {
  PlatformAssistantConversationSummary,
  PlatformAssistantUsage,
} from "../../types/platform-insights";

// ─── Constants ────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 10;

/** Refusals a retry can't fix. */
const NO_RETRY_REASONS = new Set([
  "AI_TOKEN_BUDGET_EXHAUSTED",
  "AI_RESTING",
  "AI_DISABLED",
  "CONVERSATION_FULL",
  "QUESTION_EMPTY",
  "QUESTION_TOO_LONG",
  "MFA_REQUIRED",
]);

// ─── Types ────────────────────────────────────────────────────────────────

export interface AskZcomPlatformPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** The current page, for "Zcom AI · sees Stores". */
  pageLabel?: string;
  /** Three suggestions for the current page (config/ask-suggestions.ts). */
  suggestions?: readonly string[];
  /** Question to ask as soon as the panel opens (Ask bar or ⌘K). */
  pendingQuestion?: string;
  onPendingConsumed?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────

/** Round 3 B6: while the answer is on its way, the steps the AI is really taking, ticking one by one. */
function ThinkingSteps({ turn }: { turn: AskTurn }) {
  const running = turn.status === "RUNNING" || turn.status === "SENDING";
  const real = thinkingSteps(turn.toolActivity, running, Boolean(turn.text));
  const shown = useMinStepTime(real.map((step) => step.state), 250);
  return <AiSteps variant="inline" steps={real.map((step, index) => ({ ...step, state: shown[index] ?? step.state }))} />;
}

/** Round 3 B6: once the answer streams, its steps fold into one grey line that opens on click. */
function ThinkingSummary({ turn, running }: { turn: AskTurn; running: boolean }) {
  if (!turn.toolActivity.length) return null;
  return (
    <AiSteps
      variant="inline"
      summary={thinkingSummary(turn.toolActivity)}
      steps={thinkingSteps(turn.toolActivity, running, Boolean(turn.text))}
    />
  );
}

function RatingButtons({ turn, onRate }: { turn: AskTurn; onRate: (rating: "UP" | "DOWN") => void }) {
  if (!turn.messageId) return null;
  const button = (rating: "UP" | "DOWN", label: string, emoji: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={turn.rating === rating}
      onClick={() => onRate(rating)}
      className={cx(
        "rounded-md px-1.5 py-0.5 hover:bg-surface-sunken",
        turn.rating === rating && "bg-surface-sunken text-fg",
      )}
    >
      {emoji}
    </button>
  );
  return (
    <div className="flex items-center gap-1 text-caption text-fg-subtle">
      {button("UP", "Helpful answer", "👍")}
      {button("DOWN", "Not helpful answer", "👎")}
    </div>
  );
}

/** Round 2 G3: an answer ends with one action, the first in-app link it gives (`[label](/path)`). */
const ANSWER_LINK_PATTERN = /\[([^\]]+)\]\((\/[^)\s]*)\)/;

function AnswerAction({ text, onOpen }: { text: string; onOpen: (path: string) => void }) {
  const match = ANSWER_LINK_PATTERN.exec(text);
  const path = match && !match[2].startsWith("//") ? match[2] : null;
  return (
    <AiAnswerFooter
      action={
        match && path ? (
          <Button variant="secondary" size="sm" onPress={() => onOpen(path)}>
            {match[1]}
          </Button>
        ) : undefined
      }
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function AskZcomPlatformPanel({
  isOpen,
  onClose,
  pendingQuestion,
  onPendingConsumed,
  pageLabel,
  suggestions = ASK_SUGGESTIONS,
}: AskZcomPlatformPanelProps) {
  const { can } = useAuth();
  const { clients } = useClients();
  const [view, setView] = useState<"chat" | "history">("chat");
  // Round 2 G3: the chat box first; ⤢ grows it to the large half view, then to the full view.
  const [size, setSize] = useState<AiSheetSize>("box");
  const expanded = size === "full";
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState<PlatformAssistantConversationSummary | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stores = useMemo(() => clients.map((client) => ({ id: client.id, name: client.storeName })), [clients]);

  // ─── Queries & mutations ───
  const { data: usageData, refetch: refetchUsage } = useQuery<{ platformAssistantUsage: PlatformAssistantUsage }>(
    PLATFORM_ASSISTANT_USAGE,
    { skip: !isOpen, fetchPolicy: "network-only" },
  );
  const usage = usageData?.platformAssistantUsage;
  const [loadConversations, history] = useLazyQuery<{
    platformAssistantConversations: { totalCount: number; items: PlatformAssistantConversationSummary[] };
  }>(PLATFORM_ASSISTANT_CONVERSATIONS, { fetchPolicy: "no-cache" });
  const [deleteConversation, { loading: deletingLoading }] = useMutation(PLATFORM_ASSISTANT_DELETE_CONVERSATION);
  const chat = useAskZcomPlatform({ isActive: isOpen, onSettled: () => void refetchUsage() });

  const canAsk = !usage || usage.available;
  const tooLong = draft.length > ASK_MAX_LENGTH;
  // Round 3 B5: the bottom glow follows what the AI is doing.
  const busyTurn = chat.turns.find((turn) => turn.status === "RUNNING" || turn.status === "SENDING");
  const activity: AiGlowState = busyTurn ? (busyTurn.text ? "answering" : "thinking") : draft.trim() ? "typing" : "idle";
  const conversations = history.data?.platformAssistantConversations?.items ?? [];
  const needsMfa = chat.turns.some(
    (turn) => turn.sendError?.reason === "MFA_REQUIRED" || turn.sendError?.code === "MFA_REQUIRED",
  );

  // ─── Effects ───
  // Every open starts as the chat box (round 2 G3).
  useEffect(() => {
    if (!isOpen) {
      setSize("box");
      setView("chat");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && pendingQuestion) {
      setView("chat");
      void chat.ask(pendingQuestion);
      onPendingConsumed?.();
    }
    // Only when a new question arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingQuestion]);

  useEffect(() => {
    // Round 3 D1: "nearest" scrolls the chat only, never the page behind it.
    endRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [chat.turns]);

  // DUPLICATE_QUESTION: the answer is already stored; reload it
  useEffect(() => {
    const duplicate = chat.turns.some((turn) => turn.sendError?.reason === "DUPLICATE_QUESTION");
    if (duplicate && chat.conversationId) void chat.open(chat.conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.turns]);

  // ─── Handlers ───
  const submit = () => {
    const text = draft.trim();
    if (!text || tooLong || chat.isBusy || !canAsk) return;
    void chat.ask(text);
    setDraft("");
  };

  const openHistory = () => {
    setView("history");
    void loadConversations({ variables: { limit: HISTORY_PAGE_SIZE, offset: 0 } });
  };

  const openConversation = async (id: string) => {
    const opened = await chat.open(id);
    if (opened) setView("chat");
    else {
      toastError("This conversation is no longer available.");
      void history.refetch?.();
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteConversation({ variables: { id: deleting.id } });
      if (deleting.id === chat.conversationId) chat.startNew();
      await history.refetch?.();
    } catch {
      toastError("Couldn't delete the conversation.");
    } finally {
      setDeleting(null);
    }
  };

  // ─── Render helpers ───
  const renderAnswer = (turn: AskTurn) => {
    const isRunning = isTurnBusy(turn);
    if (turn.sendError) {
      const reason = turn.sendError.reason ?? turn.sendError.code ?? "";
      const canRetry = !NO_RETRY_REASONS.has(reason);
      return (
        <div className="flex flex-col gap-2 text-body text-fg-muted">
          <p>{turn.sendError.message}</p>
          <div className="flex flex-wrap gap-2">
            {canRetry ? (
              <Button variant="secondary" size="sm" onPress={() => void chat.retry(turn)} isDisabled={chat.isBusy}>
                Retry
              </Button>
            ) : null}
            {reason === "CONVERSATION_FULL" ? (
              <Button variant="secondary" size="sm" onPress={chat.startNew}>
                Start a new conversation
              </Button>
            ) : null}
            {reason === "MFA_REQUIRED" ? (
              <Link to="/mfa" onClick={onClose} className="text-label font-medium text-brand underline-offset-2 hover:underline">
                Set up two-step sign-in
              </Link>
            ) : null}
          </div>
        </div>
      );
    }
    if (isRunning && !turn.text) {
      return (
        <ThinkingSteps turn={turn} />
      );
    }
    const endNote = isRunning ? null : runStatusNote(turn.status, turn.runErrorReason);
    const sources = formatSources(turn.sources);
    return (
      <div className={cx("flex flex-col gap-2", turn.status === "CANCELLED" && "opacity-60")}>
        <ThinkingSummary turn={turn} running={isRunning} />
        {turn.text ? <AssistantMarkdown text={turn.text} stores={stores} onNavigate={onClose} /> : null}
        {endNote ? <p className="text-caption text-fg-subtle">{endNote}</p> : null}
        {turn.status === "FAILED" ? (
          <div>
            <Button variant="secondary" size="sm" onPress={() => void chat.retry(turn)} isDisabled={chat.isBusy}>
              Retry
            </Button>
          </div>
        ) : null}
        {!isRunning && turn.status !== "FAILED" && turn.status !== "CANCELLED" && turn.text ? (
          <AnswerAction
            text={turn.text}
            onOpen={(path) => {
              navigate(path);
              onClose();
            }}
          />
        ) : null}
        {!isRunning && (sources || turn.messageId) ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-fg-subtle">{sources}</span>
            <RatingButtons turn={turn} onRate={(rating) => void chat.rate(turn, rating)} />
          </div>
        ) : null}
      </div>
    );
  };

  const runningTurn = chat.turns.find((turn) => turn.status === "RUNNING");
  const showHistoryView = !expanded && view === "history";

  /** Full view (v2 §3.3): the history sits on the left, so load it when the surface reaches full size. */
  const changeSize = (next: AiSheetSize) => {
    setSize(next);
    if (next === "full") {
      void loadConversations({ variables: { limit: HISTORY_PAGE_SIZE, offset: 0 } });
      setView("chat");
    }
  };

  const historyList =
    history.error && !history.data ? (
      <ErrorState title="Couldn't load conversations." onRetry={() => void history.refetch?.()} />
    ) : history.loading && !history.data ? (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-field" />
        ))}
      </div>
    ) : conversations.length === 0 ? (
      <EmptyState icon={IconChat} title="No conversations yet" description="Your questions are kept here, private to you, for 90 days." />
    ) : (
      <ul className="flex flex-col divide-y divide-line-subtle">
        {conversations.map((conversation) => (
          <li key={conversation.id} className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => void openConversation(conversation.id)}
              className={cx(
                "min-w-0 flex-1 rounded-field px-2 py-1 text-left hover:bg-surface-sunken",
                conversation.id === chat.conversationId && "bg-surface-sunken",
              )}
            >
              <p className="truncate text-body text-fg">{conversation.title}</p>
              <p className="text-caption text-fg-subtle">
                {conversation.turnCount} question{conversation.turnCount === 1 ? "" : "s"} ·{" "}
                {formatRelative(conversation.lastMessageAt)}
              </p>
            </button>
            <IconButton
              variant="danger"
              aria-label={`Delete conversation ${conversation.title}`}
              size="sm"
              onPress={() => setDeleting(conversation)}
            >
              <IconDelete />
            </IconButton>
          </li>
        ))}
      </ul>
    );

  const chatList = chat.isLoadingConversation ? (
    <div className="space-y-3">
      <Skeleton className="h-10 w-2/3 self-end rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  ) : chat.turns.length === 0 ? (
    <AiSheetWelcome
      suggestions={suggestions}
      onAsk={(question) => void chat.ask(question)}
      disabled={chat.isBusy || !canAsk || needsMfa}
      note="Answers come from last night's platform snapshot and show only what your role may see."
    />
  ) : (
    chat.turns.map((turn) => (
      <div key={turn.clientMessageId} className="flex flex-col gap-3">
        <p className="self-end whitespace-pre-line rounded-xl bg-surface-sunken px-3 py-2 text-body text-fg">{turn.question}</p>
        {renderAnswer(turn)}
      </div>
    ))
  );

  return (
    <>
      <AiSheet isOpen={isOpen} onClose={onClose} size={size} onSizeChange={changeSize} activity={activity}>
        <AiSheetContent>
          <AiSheetHeader
            context={pageLabel}
            title={showHistoryView ? "Conversations" : undefined}
            fullTitle={conversations.find((item) => item.id === chat.conversationId)?.title || undefined}
            leading={
              showHistoryView ? (
                <IconButton aria-label="Back to chat" size="sm" onPress={() => setView("chat")}>
                  <IconBack />
                </IconButton>
              ) : undefined
            }
            actions={
              <>
                {!expanded && view === "chat" ? (
                  <IconButton aria-label="Conversation history" size="sm" onPress={openHistory}>
                    <IconTime />
                  </IconButton>
                ) : null}
                {/* The box keeps three buttons (history, expand, close); New chat is in its history list. */}
                {size !== "box" ? (
                  <IconButton
                    aria-label="New conversation"
                    size="sm"
                    onPress={() => {
                      chat.startNew();
                      setView("chat");
                    }}
                  >
                    <IconAdd />
                  </IconButton>
                ) : null}
              </>
            }
            onClose={onClose}
            thinking={chat.isBusy}
          />

          {usage && !showHistoryView ? (
            // Full view: the usage line moves to the bottom of the history column (board 46); phone keeps it here.
            <div className={expanded ? "md:hidden" : undefined}>
              <AiUsageBar usage={usage} canManageAi={can(PLATFORM_PERMISSIONS.AI_MANAGE)} onNavigate={onClose} />
            </div>
          ) : null}

          <div className="zc-ai-sheet__body">
            {expanded ? (
              <AiSheetHistory
                onNewChat={() => {
                  chat.startNew();
                  setView("chat");
                }}
                footer={
                  usage ? (
                    <AiUsageBar usage={usage} canManageAi={can(PLATFORM_PERMISSIONS.AI_MANAGE)} onNavigate={onClose} />
                  ) : undefined
                }
              >
                {historyList}
              </AiSheetHistory>
            ) : null}
            <div className="zc-ai-sheet__main">
              <AiSheetBody>
                {showHistoryView ? (
                  <>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        startIcon={<IconAdd aria-hidden />}
                        onPress={() => {
                          chat.startNew();
                          setView("chat");
                        }}
                      >
                        New chat
                      </Button>
                    </div>
                    {historyList}
                  </>
                ) : (
                  chatList
                )}
                <div ref={endRef} />
              </AiSheetBody>

              {showHistoryView ? null : (
                <AiSheetFooter>
                  <AiComposer
                    value={draft}
                    onValueChange={setDraft}
                    onSubmit={submit}
                    hideField={needsMfa}
                    isDisabled={!canAsk}
                    canSend={!chat.isBusy && !!draft.trim() && !tooLong}
                    maxLength={ASK_MAX_LENGTH}
                    autoFocus
                    placeholder={chat.turns.length ? "Ask a follow-up…" : "Ask Zcom AI about any store…"}
                    before={
                      runningTurn ? (
                        <div>
                          <Button variant="secondary" size="sm" onPress={() => void chat.cancel(runningTurn)}>
                            Stop answering
                          </Button>
                        </div>
                      ) : null
                    }
                    meta={
                      needsMfa ? null : (
                        <span className={cx(draft.length >= ASK_MAX_LENGTH && "text-tone-danger-text")}>
                          {draft.length}/{ASK_MAX_LENGTH}
                        </span>
                      )
                    }
                  />
                </AiSheetFooter>
              )}
            </div>
          </div>
        </AiSheetContent>
      </AiSheet>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        isLoading={deletingLoading}
        title={deleting?.title ? `Delete "${deleting.title}"?` : "Delete this conversation?"}
        description="It will be removed from your conversation history."
        confirmLabel="Delete conversation"
      />
    </>
  );
}

export default AskZcomPlatformPanel;
