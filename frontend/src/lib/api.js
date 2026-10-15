/**
 * Thin client for the local backend.
 *
 * All conversation state lives on the server; this module only shapes requests
 * and normalises errors into something the UI can show verbatim.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Turn a status code into an actionable hint for the user. */
export function recoveryHint(error) {
  if (!(error instanceof ApiError)) return 'Please try again.';
  if (error.status === 0) {
    return 'Start the backend with `npm start` in the Backend folder, then retry.';
  }
  if (error.status === 503) {
    return 'Start Ollama (`ollama serve`) and make sure the configured model is pulled.';
  }
  if (error.status === 504) {
    return 'The local model took too long. Try a shorter prompt or a smaller context.';
  }
  if (error.status === 401) {
    return 'The Gmail session expired. Reconnect your account from the sidebar.';
  }
  if (error.status >= 500) {
    return 'Check the backend logs for the underlying error.';
  }
  return 'Please try again.';
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(path, options);
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('Cannot reach the backend.', 0);
  }

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${response.status}.`,
      response.status,
      data?.details ?? null
    );
  }

  return data;
}

const json = (method, body) => ({
  method,
  headers: JSON_HEADERS,
  body: JSON.stringify(body)
});

/**
 * Build a chat request body.
 *
 * `conversationId: null` means "start a new conversation" and is sent
 * explicitly; omitting the key entirely means "continue whichever conversation
 * the server currently considers active".
 */
function chatBody({ message, history, conversationId, stream }) {
  const body = { message, history };
  if (conversationId !== undefined) body.conversationId = conversationId;
  if (stream !== undefined) body.stream = stream;
  return body;
}

/* ------------------------------------------------------------------ health */

export const getHealth = () => request('/api/health');

/* ----------------------------------------------------------- conversations */

export const listConversations = () => request('/api/conversations');

export const getConversation = id => request(`/api/conversations/${encodeURIComponent(id)}`);

export const createConversation = firstMessage =>
  request('/api/conversations', json('POST', { firstMessage }));

export const renameConversation = (id, title) =>
  request(`/api/conversations/${encodeURIComponent(id)}`, json('PATCH', { title }));

export const setPinned = (id, pinned) =>
  request(`/api/conversations/${encodeURIComponent(id)}`, json('PATCH', { pinned }));

/** Toggles the pinned flag server-side and returns the updated conversation. */
export const togglePinnedConversation = id =>
  request(`/api/conversations/${encodeURIComponent(id)}/pin`, json('POST', {}));

export const deleteConversation = id =>
  request(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const activateConversation = id =>
  request(`/api/conversations/${encodeURIComponent(id)}/activate`, json('POST', {}));

export const searchConversations = query =>
  request(`/api/conversations/search?q=${encodeURIComponent(query)}`);

/* -------------------------------------------------------------------- chat */

export const sendChat = ({ message, history, conversationId }) =>
  request('/api/chat', json('POST', chatBody({ message, history, conversationId })));

export const regenerateResponse = conversationId =>
  request(
    `/api/conversations/${encodeURIComponent(conversationId)}/regenerate`,
    json('POST', {})
  );

export const editMessage = (conversationId, messageIndex, newContent) =>
  request(
    `/api/conversations/${encodeURIComponent(conversationId)}/edit-message`,
    json('POST', { messageIndex, newContent })
  );

/**
 * Stream a chat response, invoking `onDelta` with the accumulated text.
 *
 * Parses the backend's `data: {..}\n\n` framing over a `text/event-stream`
 * response. Resolves with the final text and the conversation it belongs to.
 */
export async function streamChat({ message, history, conversationId, signal, onDelta }) {
  let response;

  try {
    response = await fetch(
      '/api/chat',
      {
        ...json('POST', chatBody({ message, history, conversationId, stream: true })),
        signal
      }
    );
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('Cannot reach the backend.', 0);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    throw new ApiError(
      data?.error || `Request failed with status ${response.status}.`,
      response.status,
      data?.details ?? null
    );
  }

  if (!response.body) {
    throw new ApiError('The backend returned no stream body.', 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let resolvedConversationId = conversationId ?? null;

  const consume = block => {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.error) throw new ApiError(event.error, 502);
      if (event.conversationId) resolvedConversationId = event.conversationId;
      if (typeof event.full === 'string') {
        full = event.full;
        onDelta?.(full);
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) consume(block);
    }
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.releaseLock();
  }

  return { text: full, conversationId: resolvedConversationId };
}

/* ------------------------------------------------------------------- gmail */

export const getGmailStatus = () => request('/api/gmail/status');

export const getGmailConnectUrl = () => request('/api/gmail/connect');

export const disconnectGmail = () => request('/api/gmail/disconnect', json('POST', {}));

export const listGmailMessages = (query = '', maxResults = 20) =>
  request(
    `/api/gmail/messages?q=${encodeURIComponent(query)}&maxResults=${encodeURIComponent(maxResults)}`
  );

export const getGmailMessage = id => request(`/api/gmail/messages/${encodeURIComponent(id)}`);
