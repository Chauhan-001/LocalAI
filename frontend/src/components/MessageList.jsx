import { useRef } from 'react';
import Message from './Message.jsx';
import Markdown from './Markdown.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import { useSelectionToolbar } from '../hooks/useSelectionToolbar.js';
import { IconAlert, IconRefresh } from './Icons.jsx';
import { recoveryHint } from '../lib/api.js';

export default function MessageList({
  messages,
  streamingText,
  busy,
  error,
  loading,
  feedback,
  bottomRef,
  onEdit,
  onRegenerate,
  onFeedback,
  onRetry
}) {
  const containerRef = useRef(null);
  const selection = useSelectionToolbar(containerRef);

  const lastAssistantIndex = messages.reduce(
    (found, message, index) => (message.role === 'assistant' ? index : found),
    -1
  );

  return (
    <div className="transcript" ref={containerRef}>
      <div className="transcript__inner">
        {loading && (
          <div className="transcript__loading" role="status">
            Loading conversation…
          </div>
        )}

        {messages.map((message, index) => (
          <Message
            key={`${message.role}-${index}`}
            message={message}
            index={index}
            busy={busy}
            feedback={feedback[index] ?? null}
            canRegenerate={index === lastAssistantIndex && !busy}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
          />
        ))}

        {streamingText !== null && streamingText !== '' && (
          <article className="message message--assistant message--streaming">
            <div className="message__meta">
              <span className="message__author">Assistant</span>
              <span className="badge badge--live">streaming</span>
            </div>
            <div className="message__body">
              <Markdown content={streamingText} />
            </div>
          </article>
        )}

        {busy && streamingText === null && (
          <div className="transcript__working" role="status">
            <span className="spinner" aria-hidden="true" />
            Waiting for the local model…
          </div>
        )}

        {error && (
          <div className="inline-error" role="alert">
            <IconAlert size={16} />
            <div className="inline-error__body">
              <strong>{error.message}</strong>
              <span>{recoveryHint(error)}</span>
              {onRetry && (
                <button type="button" className="button button--ghost" onClick={onRetry}>
                  <IconRefresh size={14} />
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} className="transcript__sentinel" />
      </div>

      <SelectionToolbar selection={selection} />
    </div>
  );
}
