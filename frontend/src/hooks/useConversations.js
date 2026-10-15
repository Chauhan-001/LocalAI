import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activateConversation,
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
  searchConversations,
  togglePinnedConversation
} from '../lib/api.js';

const EMPTY_GROUPS = {
  Today: [],
  Yesterday: [],
  'Previous 7 Days': [],
  Older: []
};

/**
 * Owns the conversation sidebar: the list, its date grouping, the active id and
 * an optional search result set. The server is the source of truth; this hook
 * mirrors it and re-fetches after every mutation.
 */
export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [grouped, setGrouped] = useState(EMPTY_GROUPS);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const data = await listConversations();
      // Ignore out-of-order responses from overlapping refreshes.
      if (requestId !== requestIdRef.current) return;

      setConversations(data.conversations ?? []);
      setGrouped({ ...EMPTY_GROUPS, ...(data.grouped ?? {}) });
      setActiveId(data.activeId ?? null);
      setError(null);
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      setError(cause);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runSearch = useCallback(async value => {
    setQuery(value);

    if (!value.trim()) {
      setResults(null);
      return;
    }

    try {
      const data = await searchConversations(value.trim());
      setResults(data.conversations ?? []);
    } catch {
      setResults([]);
    }
  }, []);

  const create = useCallback(async firstMessage => {
    const conversation = await createConversation(firstMessage ?? '');
    setActiveId(conversation.id);
    await refresh();
    return conversation;
  }, [refresh]);

  const select = useCallback(async id => {
    setActiveId(id);
    // Persisting the selection keeps the browser and server in agreement.
    await activateConversation(id).catch(() => {});
  }, []);

  const rename = useCallback(async (id, title) => {
    const updated = await renameConversation(id, title);
    await refresh();
    return updated;
  }, [refresh]);

  const togglePin = useCallback(async id => {
    const updated = await togglePinnedConversation(id);
    await refresh();
    return updated;
  }, [refresh]);

  const remove = useCallback(async id => {
    await deleteConversation(id);
    await refresh();
  }, [refresh]);

  /** Delete every stored conversation. Used by the Settings panel. */
  const clearAll = useCallback(async () => {
    const all = await listConversations();
    await Promise.all((all.conversations ?? []).map(item => deleteConversation(item.id)));
    await refresh();
  }, [refresh]);

  return {
    conversations,
    grouped,
    activeId,
    loading,
    error,
    query,
    results,
    runSearch,
    refresh,
    create,
    select,
    rename,
    togglePin,
    remove,
    clearAll,
    setActiveId
  };
}
