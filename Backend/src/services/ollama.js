import {
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  OLLAMA_TIMEOUT,
  SYSTEM_PROMPT,
  MAX_CONTEXT_MESSAGES,
  MAX_MESSAGE_LENGTH
} from '../config/index.js';

const OLLAMA_CHAT_ENDPOINT = `${OLLAMA_BASE_URL}/api/chat`;
const OLLAMA_TAGS_ENDPOINT = `${OLLAMA_BASE_URL}/api/tags`;

export async function checkOllamaConnection() {
  try {
    const response = await fetch(OLLAMA_TAGS_ENDPOINT, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.models?.some(m => m.name === OLLAMA_MODEL) || false;
  } catch {
    return false;
  }
}

export async function getAvailableModels() {
  try {
    const response = await fetch(OLLAMA_TAGS_ENDPOINT, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return [];
  }
}

function buildMessages(history, userMessage) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history
      .filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-MAX_CONTEXT_MESSAGES)
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage.trim() }
  ];
  return messages;
}

export async function sendChatRequest(message, history, signal) {
  const messages = buildMessages(history, message);
  
  const response = await fetch(OLLAMA_CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages
    }),
    signal: signal || AbortSignal.timeout(OLLAMA_TIMEOUT)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Ollama returned HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.message?.content ?? '';
}

export async function sendStreamingChatRequest(message, history, onChunk, signal) {
  const messages = buildMessages(history, message);
  
  const response = await fetch(OLLAMA_CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      messages
    }),
    signal: signal || AbortSignal.timeout(OLLAMA_TIMEOUT)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Ollama returned HTTP ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body from Ollama');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            onChunk(chunk.message.content, fullContent, chunk.done);
          }
          if (chunk.done) {
            return fullContent;
          }
        } catch (e) {
          console.warn('Failed to parse streaming chunk:', line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.message?.content) {
          fullContent += chunk.message.content;
          onChunk(chunk.message.content, fullContent, chunk.done);
        }
        if (chunk.done) {
          return fullContent;
        }
      } catch (e) {
        console.warn('Failed to parse final buffer chunk');
      }
    }

    return fullContent;
  } finally {
    reader.releaseLock();
  }
}

export function validateMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    return { valid: false, error: 'Message is required.' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }
  return { valid: true };
}

/**
 * Keep only well-formed user/assistant turns, cap the count, and drop a
 * trailing history entry that merely repeats `latestUserMessage` so the model
 * never receives the same prompt twice.
 */
export function validateHistory(history, latestUserMessage = null) {
  if (!Array.isArray(history)) return [];

  const safe = history
    .filter(item =>
      item &&
      ['user', 'assistant'].includes(item.role) &&
      typeof item.content === 'string' &&
      item.content.length <= MAX_MESSAGE_LENGTH
    )
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(({ role, content }) => ({ role, content }));

  if (
    latestUserMessage !== null &&
    safe.length > 0 &&
    safe[safe.length - 1].role === 'user' &&
    safe[safe.length - 1].content.trim() === String(latestUserMessage).trim()
  ) {
    safe.pop();
  }

  return safe;
}