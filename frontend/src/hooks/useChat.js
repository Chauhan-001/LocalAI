import { useCallback, useEffect, useRef, useState } from 'react';
import {
  editMessage,
  getConversation,
  regenerateResponse,
  streamChat
} from '../lib/api.js';
import { titleFromMessage } from '../lib/format.js';

/**
 * Owns the active conversation's transcript plus the request lifecycle.
 *
 * Streaming is real (the backend forwards Ollama's token stream); the server
 * remains authoritative, so every terminal state re-reads the conversation
 * rather than trusting local accumulation.
 */
export function useChat({ onConversationsChanged, contextLimit = 20 } = {}) {
  const [conversation, setConversation] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const [error, setError] = useState(null);

  const conversationRef = useRef(null);
  const abortRef = useRef(null);
  const partialRef = useRef('');

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(
    () => () => {
      // Abort any in-flight stream when the app unmounts.
      abortRef.current?.abort();
    },
    []
  );

  const load = useCallback(async id => {
    if (!id) {
      setConversation(null);
      setError(null);
      return null;
    }

    setLoadingConversation(true);
    try {
      const data = await getConversation(id);
      setConversation(data);
      setError(null);
      return data;
    } catch (cause) {
      setError(cause);
      setConversation(null);
      return null;
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const startNew = useCallback(() => {
    abortRef.current?.abort();
    setConversation(null);
    setError(null);
    setStreamingText(null);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * Reconcile after an interruption: keep the partial answer visible if the
   * server never stored an assistant reply, so the user does not lose text.
   */
  const reconcileInterrupted = useCallback(async (id, partial) => {
    if (!id) return;
    const stored = await getConversation(id).catch(() => null);
    if (!stored) return;

    const last = stored.messages[stored.messages.length - 1];
    if (last?.role !== 'assistant' && partial) {
      setConversation({
        ...stored,
        messages: [...stored.messages, { role: 'assistant', content: partial, interrupted: true }]
      });
    } else {
      setConversation(stored);
    }
  }, []);

  const send = useCallback(
    async rawText => {
      const text = (rawText ?? '').trim();
      if (!text || abortRef.current) return { ok: false, reason: 'busy' };

      const current = conversationRef.current;
      const targetId = current?.id ?? null;
      // Only the most recent `contextLimit` turns are forwarded; interrupted
      // partial answers are excluded so they cannot pollute the context.
      const history = (current?.messages ?? [])
        .filter(message => !message.interrupted)
        .slice(-contextLimit)
        .map(({ role, content }) => ({ role, content }));

      setError(null);
      setBusy(true);
      setStreamingText(null);
      partialRef.current = '';

      // Optimistic user turn for an immediate response.
      setConversation(previous => ({
        id: previous?.id ?? null,
        title: previous?.title || titleFromMessage(text),
        messages: [
          ...(previous?.messages ?? []),
          { role: 'user', content: text, timestamp: new Date().toISOString() }
        ]
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await streamChat({
          message: text,
          history,
          conversationId: targetId,
          signal: controller.signal,
          onDelta: full => {
            partialRef.current = full;
            setStreamingText(full);
          }
        });

        const resolvedId = result.conversationId ?? targetId;
        const stored = await getConversation(resolvedId).catch(() => null);

        setConversation(
          stored ?? {
            id: resolvedId,
            title: titleFromMessage(text),
            messages: [
              ...(conversationRef.current?.messages ?? []),
              { role: 'assistant', content: result.text }
            ]
          }
        );

        return { ok: true, conversationId: resolvedId };
      } catch (cause) {
        if (cause?.name === 'AbortError') {
          await reconcileInterrupted(targetId, partialRef.current);
          return { ok: false, reason: 'aborted' };
        }

        setError(cause);

        // The server may still have recorded the user turn before failing;
        // only ask the composer to restore the draft if it did not.
        const stored = targetId ? await getConversation(targetId).catch(() => null) : null;
        if (stored) setConversation(stored);

        const recorded = (stored?.messages ?? []).some(
          message => message.role === 'user' && message.content.trim() === text
        );

        return { ok: false, reason: 'error', restoreDraft: !recorded, error: cause };
      } finally {
        abortRef.current = null;
        partialRef.current = '';
        setBusy(false);
        setStreamingText(null);
        onConversationsChanged?.();
      }
    },
    [contextLimit, onConversationsChanged, reconcileInterrupted]
  );

  const regenerate = useCallback(async () => {
    const current = conversationRef.current;
    if (!current?.id || abortRef.current) return { ok: false };

    setBusy(true);
    setError(null);

    try {
      await regenerateResponse(current.id);
      await load(current.id);
      return { ok: true };
    } catch (cause) {
      setError(cause);
      return { ok: false, error: cause };
    } finally {
      setBusy(false);
      onConversationsChanged?.();
    }
  }, [load, onConversationsChanged]);

  const editAndResend = useCallback(
    async (messageIndex, newContent) => {
      const current = conversationRef.current;
      const text = (newContent ?? '').trim();
      if (!current?.id || !text || abortRef.current) return { ok: false };

      setBusy(true);
      setError(null);

      try {
        await editMessage(current.id, messageIndex, text);
        await load(current.id);
        return { ok: true };
      } catch (cause) {
        setError(cause);
        return { ok: false, error: cause };
      } finally {
        setBusy(false);
        onConversationsChanged?.();
      }
    },
    [load, onConversationsChanged]
  );

  return {
    conversation,
    messages: conversation?.messages ?? [],
    title: conversation?.title ?? null,
    loadingConversation,
    busy,
    streamingText,
    error,
    clearError: () => setError(null),
    load,
    startNew,
    send,
    stop,
    regenerate,
    editAndResend
  };
}
