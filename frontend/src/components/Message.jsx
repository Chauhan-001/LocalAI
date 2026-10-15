import Markdown from './Markdown.jsx';
import CopyButton from './CopyButton.jsx';
import {
  IconPencil,
  IconRefresh,
  IconThumbDown,
  IconThumbUp
} from './Icons.jsx';

/**
 * One transcript entry.
 *
 * Assistant text is rendered as markdown; user text stays literal so pasted
 * code is never reinterpreted. Actions are icon-only with accessible labels and
 * reveal on hover or keyboard focus.
 */
export default function Message({
  message,
  index,
  canRegenerate = false,
  busy = false,
  feedback = null,
  onEdit,
  onRegenerate,
  onFeedback
}) {
  const isUser = message.role === 'user';

  return (
    <article className={`message message--${message.role}`} data-message-index={index}>
      <div className="message__meta">
        <span className="message__author">{isUser ? 'You' : 'Assistant'}</span>
        {message.interrupted && <span className="badge badge--warn">stopped early</span>}
        {message.pending && <span className="badge">sending</span>}
      </div>

      <div className="message__body">
        {isUser ? (
          <p className="message__text">{message.content}</p>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>

      <div className="message__actions">
        <CopyButton
          text={message.content}
          label={isUser ? 'Copy message' : 'Copy response'}
          iconOnly
          className="icon-button"
        />

        {isUser && onEdit && (
          <button
            type="button"
            className="icon-button"
            title="Edit and resend"
            aria-label="Edit and resend this message"
            onClick={() => onEdit(index)}
            disabled={busy}
          >
            <IconPencil size={15} />
          </button>
        )}

        {!isUser && canRegenerate && (
          <button
            type="button"
            className="icon-button"
            title="Regenerate response"
            aria-label="Regenerate this response"
            onClick={onRegenerate}
            disabled={busy}
          >
            <IconRefresh size={15} />
          </button>
        )}

        {!isUser && onFeedback && (
          <>
            <button
              type="button"
              className={`icon-button${feedback === 'up' ? ' is-active' : ''}`}
              title="Good response"
              aria-label="Mark this response as helpful"
              aria-pressed={feedback === 'up'}
              onClick={() => onFeedback(index, 'up')}
            >
              <IconThumbUp size={15} />
            </button>
            <button
              type="button"
              className={`icon-button${feedback === 'down' ? ' is-active' : ''}`}
              title="Bad response"
              aria-label="Mark this response as not helpful"
              aria-pressed={feedback === 'down'}
              onClick={() => onFeedback(index, 'down')}
            >
              <IconThumbDown size={15} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
