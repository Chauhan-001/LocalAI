import { useCallback, useEffect, useState } from 'react';
import {
  disconnectGmail,
  getGmailConnectUrl,
  getGmailMessage,
  getGmailStatus,
  listGmailMessages
} from '../lib/api.js';

const MAX_RESULTS = 15;
const REDIRECT_KEYS = ['gmail', 'message'];

/**
 * Read-only Gmail access. Tokens stay entirely on the backend; this hook only
 * ever receives message metadata and bodies for explicit user actions.
 */
export function useGmail() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  // The OAuth callback redirects back with ?gmail=connected|error, so seed the
  // initial feedback straight from the URL rather than via an effect.
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('gmail') === 'error'
      ? new Error(params.get('message') || 'Gmail authorization failed.')
      : null;
  });
  const [notice, setNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('gmail') === 'connected'
      ? 'Gmail connected. Only read access was requested.'
      : null;
  });

  // `loadingStatus` starts true, so this only ever needs to clear it.
  const refreshStatus = useCallback(async () => {
    try {
      const data = await getGmailStatus();
      setConnected(Boolean(data.connected));
      setEmail(data.email ?? null);
    } catch {
      setConnected(false);
      setEmail(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Strip the OAuth redirect parameters from the address bar once consumed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('gmail')) {
      refreshStatus();
      return;
    }

    REDIRECT_KEYS.forEach(key => params.delete(key));
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);

    refreshStatus();
  }, [refreshStatus]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const { url } = await getGmailConnectUrl();
      window.location.assign(url);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectGmail();
      setMessages([]);
      setSelected(null);
      setNotice('Gmail disconnected. Stored credentials were removed.');
      await refreshStatus();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const load = useCallback(async (query = '') => {
    setBusy(true);
    setError(null);
    try {
      const data = await listGmailMessages(query, MAX_RESULTS);
      const msgs = data.messages ?? [];
      setMessages(msgs);
      if (msgs.length === 0) {
        setNotice('No messages matched. Try a different search.');
      }
      return msgs;
    } catch (cause) {
      setError(cause);
      setMessages([]);
      return [];
    } finally {
      setBusy(false);
    }
  }, []);

  const open = useCallback(async id => {
    setBusy(true);
    setError(null);
    try {
      const data = await getGmailMessage(id);
      setSelected(data.message);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    connected,
    email,
    loadingStatus,
    messages,
    selected,
    busy,
    error,
    notice,
    refreshStatus,
    connect,
    disconnect,
    load,
    open,
    closeMessage: () => setSelected(null),
    clearError: () => setError(null),
    clearNotice: () => setNotice(null)
  };
}
