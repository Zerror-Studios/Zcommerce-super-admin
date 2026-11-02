/**
 * Ask ZCOM for staff: conversation state (backend PRD-026 FR-7.2, guide §12)
 *
 * `ask` sends `askZcomPlatform` with a fresh `clientMessageId` (kept for a
 * retry after a network error, so a repeat returns the same run), then
 * polls `platformAssistantRun` about once a second with `afterSeq`,
 * appending each `delta` until the run stops being RUNNING; the final
 * `message.text` then replaces the streamed text. Polling stops while the
 * panel is closed (the run continues on the server) and resumes on open.
 * One question at a time per conversation. Mirrors the dashboard's
 * merchant chat (`useAskZcom`) on the platform operations.
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
  isTurnBusy,
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
    canRetrySame: Boolean((error as { networkError?: unknown } | null)?.networkError),
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
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const isBusy = turns.some(isTurnBusy);

  // ─── Helpers ───

  const updateTurn = useCallback((clientMessageId: string, patch: (turn: AskTurn) => AskTurn) => {
    setTurns((list) => list.map((turn) => (turn.clientMessageId === clientMessageId ? patch(turn) : turn)));
  }, []);

  const stopPolling = useCallback(() => {
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

  const poll = useCallback(
    (clientMessageId: string, runId: string) => {
      stopPolling();
      if (!activeRef.current) return;
      pollTimer.current = setTimeout(async () => {
        try {
          const { data } = await apolloClient.query<{ platformAssistantRun: PlatformAssistantRun }>({
            query: PLATFORM_ASSISTANT_RUN,
            variables: { runId, afterSeq: seqRef.current[runId] ?? 0 },
            fetchPolicy: "no-cache",
          });
          const run = data.platformAssistantRun;
          apply(clientMessageId, run);
          if (run.status === "RUNNING") poll(clientMessageId, runId);
          else onSettledRef.current?.();
        } catch {
          // A dropped poll is retried; the run keeps going on the server
          poll(clientMessageId, runId);
        }
      }, ASK_POLL_MS);
    },
    [apolloClient, apply, stopPolling],
  );

  // ─── Effects ───

  useEffect(() => {
    activeRef.current = isActive;
    if (!isActive) {
      stopPolling();
      return;
    }
    // Reopened: pick up a run that was still answering
    const running = turns.find((turn) => turn.status === "RUNNING" && turn.runId);
    if (running?.runId && !pollTimer.current) poll(running.clientMessageId, running.runId);
    // Only when the panel opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => stopPolling, [stopPolling]);

  // ─── Actions ───

  const send = useCallback(
    async (question: string, clientMessageId: string) => {
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
        updateTurn(clientMessageId, (turn) => ({ ...turn, text: "" }));
        apply(clientMessageId, run);
        if (run.status === "RUNNING") poll(clientMessageId, run.id);
        else onSettledRef.current?.();
      } catch (error) {
        updateTurn(clientMessageId, (turn) => ({ ...turn, status: "FAILED", sendError: toSendError(error) }));
        onSettledRef.current?.();
      }
    },
    [apolloClient, apply, conversationId, poll, updateTurn],
  );

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || isBusy) return;
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
      if (isBusy) return;
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
      try {
        await apolloClient.mutate({ mutation: PLATFORM_ASSISTANT_CANCEL_RUN, variables: { runId: turn.runId } });
      } catch {
        // The poll reports whatever state the run reached
      }
    },
    [apolloClient],
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
