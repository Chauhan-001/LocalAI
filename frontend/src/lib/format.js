/** Deterministic, dependency-free formatting helpers. */

const MAX_TITLE_LENGTH = 60;

/**
 * Derive a conversation title from the first user message.
 *
 * Mirrors the backend's generator so the optimistic title shown right after
 * sending matches what the server then stores.
 */
export function titleFromMessage(text) {
  const trimmed = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'New Chat';
  return trimmed.length > MAX_TITLE_LENGTH
    ? `${trimmed.slice(0, MAX_TITLE_LENGTH)}...`
    : trimmed;
}

export function formatRelativeTime(iso) {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '';

  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

/** Render a conversation as a portable Markdown document. */
export function conversationToMarkdown(conversation) {
  const lines = [
    `# ${conversation.title || 'Conversation'}`,
    '',
    `_Exported ${new Date().toLocaleString()} from Local AI Assistant._`,
    ''
  ];

  for (const message of conversation.messages ?? []) {
    lines.push(message.role === 'user' ? '## You' : '## Assistant');
    lines.push('');
    lines.push(message.content ?? '');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function safeFilename(title) {
  const cleaned = (title || 'conversation')
    .replace(/[^\w\d-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${cleaned || 'conversation'}.md`;
}
