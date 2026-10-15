import { useEffect, useRef } from 'react';
import { IconSend, IconStop, IconClose } from './Icons.jsx';

const MAX_HEIGHT_PX = 220;

/**
 * Message composer.
 *
 * Enter sends, Shift+Enter inserts a newline, and the field grows with its
 * content up to a cap. While a request is running the send action is disabled
 * and replaced by Stop.
 */
export default function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  canStream,
  editing,
  onCancelEdit,
  placeholder = 'Ask about code, paste an error, or describe what to build…'
}) {
  const textareaRef = useRef(null);

  // Grow to fit, then scroll internally once the cap is reached.
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;

    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  // Return focus to the field when an edit is staged or a request finishes.
  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy, editing]);

  const submit = () => {
    if (busy || !value.trim()) return;
    onSubmit();
  };

  const handleKeyDown = event => {
    if (event.key !== 'Enter') return;
    // Let IME composition (e.g. Japanese input) finish first.
    if (event.nativeEvent.isComposing) return;
    if (event.shiftKey) return;

    event.preventDefault();
    submit();
  };

  return (
    <div className="composer">
      {editing && (
        <div className="composer__editing" role="status">
          <span>Editing an earlier message. Sending will replace everything after it.</span>
          <button type="button" className="icon-button" onClick={onCancelEdit} aria-label="Cancel editing">
            <IconClose size={14} />
          </button>
        </div>
      )}

      <form
        className="composer__form"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="composer-input" className="visually-hidden">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          className="composer__input"
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          spellCheck="true"
        />

        <div className="composer__controls">
          <span className="composer__hint" aria-hidden="true">
            Enter to send · Shift+Enter for a new line
          </span>

          {busy ? (
            <button type="button" className="button button--stop" onClick={onStop}>
              <IconStop size={15} />
              {canStream ? 'Stop generating' : 'Cancel'}
            </button>
          ) : (
            <button
              type="submit"
              className="button button--primary"
              disabled={!value.trim()}
              aria-label="Send message"
            >
              <IconSend size={15} />
              Send
            </button>
          )}
        </div>
      </form>

      <p className="composer__status" role="status" aria-live="polite">
        {busy ? 'Request in progress…' : ''}
      </p>
    </div>
  );
}
