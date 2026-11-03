/**
 * Ask ZCOM for staff: conversation state (backend PRD-026 FR-7.2, guide §12)
 *
 * `ask` sends `askZcomPlatform` **once** per question with a fresh
 * `clientMessageId` (kept for a retry after a network error, so a repeat
 * returns the same run), then polls the query `platformAssistantRun` about
 * once a second with `afterSeq`, appending each `delta` until the run stops
 * being RUNNING; the final `message.text` then replaces the streamed text.
 * Polling stops on every end state, on unmount, after a cancel, after
 * 2 minutes and after 3 failed polls in a row; it pauses while the panel is
 * closed (the run continues on the server) and resumes on open. One
 * question at a time: a second send before the first is answered is
 * dropped. Rules: backend `docs/reviews/2026-11-03-super-admin-chat-fe-fixes.md`
 * (FE-1..FE-4). Mirrors the dashboard's merchant chat (`useAskZcom`).
 */

import { useApolloClient } from "@apollo/client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ASK_ZCOM_PLATFORM,
  PLATFORM_ASSISTANT_CANCEL_RUN,
  PLATFORM_ASSISTANT_CONVERSATION,
  PLATFORM_ASSISTANT_RATE_MESSAGE,
  PLATFORM_ASSISTANT_RUN,
} from "../graphql/platform-insights";
import {
  applyRun,
  askQuestionText,
  canRetrySameId,
  isTurnBusy,
  pollOutcome,
  turnsFromConversation,
  type AskTurn,
} from "../lib/ask-zcom-platform.util";
import { ASK_POLL_MS, askErrorMessage, errorExtensions } from "../lib/platform-insights.util";
import type {
  PlatformAssistantConversation,
  PlatformAssistantRating,
  PlatformAssistantRun,
} from "../types/platform-insights";

// ─── Types ────────────────────────────────────────────────────────────────

interface UseAskZcomPlatformOptions {
  /** False while the panel is closed: polling pauses. */
  isActive: boolean;
  /** Called when a run ends or a question is refused (refresh usage). */
  onSettled?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function newClientMessageId(): string {
  return crypto.randomUUID();
}

function toSendError(error: unknown): NonNullable<AskTurn["sendError"]> {
  const ext = errorExtensions(error);
  return {
    message: askErrorMessage(error),
    reason: typeof ext.reason === "string" ? ext.reason : null,
    code: typeof ext.code === "string" ? ext.code : null,
    canRetrySame: canRetrySameId(error),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAskZcomPlatform({ isActive, onSettled }: UseAskZcomPlatformOptions) {
  const apolloClient = useApolloClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(isActive);
  const seqRef = useRef<Record<string, number>>({});
  // Per run: when polling (re)started and the failed polls in a row
  const pollStateRef = useRef<Record<string, { startedAt: number; failures: number }>>({});
  // FE-1: set from the press until the mutation answers, so a double press
  // (or a re-run effect) can't send the question twice
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  // Bumped by every stop, so a poll already in flight doesn't schedule more
  const pollGeneration = useRef(0);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const isBusy = turns.some(isTurnBusy);

  // ─── Helpers ───

  const updateTurn = useCallback((clientMessageId: string, patch: (turn: AskTurn) => AskTurn) => {
    setTurns((list) => list.map((turn) => (turn.clientMessageId === clientMessageId ? patch(turn) : turn)));
  }, []);

  const stopPolling = useCallback(() => {
    pollGeneration.current += 1;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const apply = useCallback(
    (clientMessageId: string, run: PlatformAssistantRun) => {
      seqRef.current[run.id] = run.seq;
      updateTurn(clientMessageId, (turn) => applyRun(turn, run));
      if (run.conversationId) setConversationId(run.conversationId);
    },
    [updateTurn],
  );

  /** FE-2: the console stopped waiting; the turn ends with a retry. */
  const giveUp = useCallback(
    (clientMessageId: string, reason: "POLL_TIMEOUT" | "POLL_UNREACHABLE") => {
      stopPolling();
      updateTurn(clientMessageId, (turn) => ({ ...turn, status: "FAILED", runErrorReason: reason }));
      onSettledRef.current?.();
    },
    [stopPolling, updateTurn],
  );

  const poll = useCallback(
    (clientMessageId: string, runId: string) => {
      stopPolling();
      if (!activeRef.current || !mountedRef.current) return;
      const state = (pollStateRef.current[runId] ??= { startedAt: Date.now(), failures: 0 });
      const generation = pollGeneration.current;
      const isCurrent = () => mountedRef.current && activeRef.current && pollGeneration.current === generation;
      pollTimer.current = setTimeout(async () => {
        let status: string | null = null;
        try {
          const { data } = await apolloClient.query<{ platformAssistantRun: PlatformAssistantRun }>({
            query: PLATFORM_ASSISTANT_RUN,
            variables: { runId, afterSeq: seqRef.current[runId] ?? 0 },
            fetchPolicy: "no-cache",
          });
          if (!isCurrent()) return;
          const run = data.platformAssistantRun;
          state.failures = 0;
          status = run.status;
          apply(clientMessageId, run);
        } catch {
          if (!isCurrent()) return;
          // A dropped poll is retried; the run keeps going on the server
          state.failures += 1;
        }
        const outcome = pollOutcome({ status, failures: state.failures, startedAt: state.startedAt, now: Date.now() });
        if (outcome === "CONTINUE") poll(clientMessageId, runId);
        else if (outcome === "ENDED") {
          delete pollStateRef.current[runId];
          onSettledRef.current?.();
        } else giveUp(clientMessageId, outcome === "TIMED_OUT" ? "POLL_TIMEOUT" : "POLL_UNREACHABLE");
      }, ASK_POLL_MS);
    },
    [apolloClient, apply, giveUp, stopPolling],
  );

  // ─── Effects ───

  useEffect(() => {
    activeRef.current = isActive;
    if (!isActive) {
      stopPolling();
      return;
    }
    // Reopened: pick up a run that was still answering, with a fresh clock
    const running = turns.find((turn) => turn.status === "RUNNING" && turn.runId);
    if (running?.runId && !pollTimer.current) {
      delete pollStateRef.current[running.runId];
      poll(running.clientMessageId, running.runId);
    }
    // Only when the panel opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // ─── Actions ───

  const send = useCallback(
    async (question: string, clientMessageId: string) => {
      sendingRef.current = true;
      try {
        const { data } = await apolloClient.mutate<{ askZcomPlatform: PlatformAssistantRun }>({
          mutation: ASK_ZCOM_PLATFORM,
          variables: {
            input: {
              ...(conversationId ? { conversationId } : {}),
              clientMessageId,
              text: question,
            },
          },
        });
        const run = data!.askZcomPlatform;
        // A repeat of the same id returns the same run: start from 0
        seqRef.current[run.id] = 0;
        delete pollStateRef.current[run.id];
        updateTurn(clientMessageId, (turn) => ({ ...turn, text: "" }));
        apply(clientMessageId, run);
        if (run.status === "RUNNING") poll(clientMessageId, run.id);
        else onSettledRef.current?.();
      } catch (error) {
        updateTurn(clientMessageId, (turn) => ({ ...turn, status: "FAILED", sendError: toSendError(error) }));
        onSettledRef.current?.();
      } finally {
        sendingRef.current = false;
      }
    },
    [apolloClient, apply, conversationId, poll, updateTurn],
  );

  const ask = useCallback(
    async (text: string) => {
      const question = askQuestionText(text);
      if (!question || isBusy || sendingRef.current) return;
      const clientMessageId = newClientMessageId();
      setTurns((list) => [
        ...list,
        { clientMessageId, question, status: "SENDING", text: "", toolActivity: [], sources: [] },
      ]);
      await send(question, clientMessageId);
    },
    [isBusy, send],
  );

  /** The same `clientMessageId` after a network error, a new one otherwise. */
  const retry = useCallback(
    async (turn: AskTurn) => {
      if (isBusy || sendingRef.current) return;
      const clientMessageId = turn.sendError?.canRetrySame ? turn.clientMessageId : newClientMessageId();
      setTurns((list) =>
        list.map((item) =>
          item.clientMessageId === turn.clientMessageId
            ? {
                ...item,
                clientMessageId,
                status: "SENDING",
                text: "",
                toolActivity: [],
                sources: [],
                runErrorReason: null,
                sendError: undefined,
              }
            : item,
        ),
      );
      await send(turn.question, clientMessageId);
    },
    [isBusy, send],
  );

  const cancel = useCallback(
    async (turn: AskTurn) => {
      if (!turn.runId) return;
      const runId = turn.runId;
      try {
        const { data } = await apolloClient.mutate<{ platformAssistantCancelRun: { id: string; status: string } }>({
          mutation: PLATFORM_ASSISTANT_CANCEL_RUN,
          variables: { runId },
        });
        // FE-2: cancelled once, then no more polls
        stopPolling();
        delete pollStateRef.current[runId];
        const status = data?.platformAssistantCancelRun?.status ?? "CANCELLED";
        updateTurn(turn.clientMessageId, (item) => ({
          ...item,
          status: status === "RUNNING" ? "CANCELLED" : status,
        }));
        onSettledRef.current?.();
      } catch {
        // Not cancelled: the poll keeps reporting the run
      }
    },
    [apolloClient, stopPolling, updateTurn],
  );

  const rate = useCallback(
    async (turn: AskTurn, rating: PlatformAssistantRating) => {
      if (!turn.messageId) return;
      updateTurn(turn.clientMessageId, (item) => ({ ...item, rating }));
      try {
        await apolloClient.mutate({
          mutation: PLATFORM_ASSISTANT_RATE_MESSAGE,
          variables: { messageId: turn.messageId, rating },
        });
      } catch {
        updateTurn(turn.clientMessageId, (item) => ({ ...item, rating: turn.rating ?? null }));
      }
    },
    [apolloClient, updateTurn],
  );

  const startNew = useCallback(() => {
    stopPolling();
    setConversationId(null);
    setTurns([]);
  }, [stopPolling]);

  /** Opens a stored conversation; false when it's gone. */
  const open = useCallback(
    async (id: string): Promise<boolean> => {
      stopPolling();
      setIsLoadingConversation(true);
      try {
        const { data } = await apolloClient.query<{
          platformAssistantConversation: PlatformAssistantConversation | null;
        }>({
          query: PLATFORM_ASSISTANT_CONVERSATION,
          variables: { id },
          fetchPolicy: "no-cache",
        });
        const conversation = data?.platformAssistantConversation ?? null;
        if (!conversation) return false;
        setConversationId(conversation.id);
        setTurns(turnsFromConversation(conversation.messages ?? []));
        return true;
      } catch {
        return false;
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [apolloClient, stopPolling],
  );

  return { conversationId, turns, isBusy, isLoadingConversation, ask, retry, cancel, rate, startNew, open };
}
