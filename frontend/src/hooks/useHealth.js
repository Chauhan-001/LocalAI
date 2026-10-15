import { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth } from '../lib/api.js';

const POLL_INTERVAL_MS = 20000;

/**
 * Polls the backend health endpoint so the UI can show whether the local model
 * is actually reachable instead of failing silently on the first prompt.
 */
export function useHealth() {
  const [status, setStatus] = useState({ state: 'checking', model: null, models: [] });
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getHealth();
      if (!mountedRef.current) return;
      setStatus({
        state: data.ollama === 'connected' ? 'connected' : 'disconnected',
        model: data.model ?? null,
        models: data.models ?? []
      });
    } catch {
      if (!mountedRef.current) return;
      setStatus({ state: 'unreachable', model: null, models: [] });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { ...status, refresh };
}
