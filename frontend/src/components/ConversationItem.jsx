import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from '../lib/format.js';
import { IconChat, IconCheck, IconClose, IconPencil, IconPin, IconTrash } from './Icons.jsx';

/**
 * A single conversation row.
 *
 * Destructive actions are staged inline rather than fired immediately, so a
 * misclick on Delete cannot remove history.
 */
export default function ConversationItem({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
  onTogglePin
}) {
  const [mode, setMode] = useState('idle');
  const [draftTitle, setDraftTitle] = useState(conversation.title);
  const [actionError, setActionError] = useState(null);
  const inputRef = useRef(null);

  const beginRename = () => {
    // Seed the draft from the current title at the moment editing starts; no
    // effect is needed to keep the two in sync.
    setDraftTitle(conversation.title);
    setMode('renaming');
  };

  useEffect(() => {
    if (mode === 'renaming') inputRef.current?.select();
  }, [mode]);

  const commitRename = async () => {
    const next = draftTitle.trim();
    if (!next || next === conversation.title) {
      setMode('idle');
      return;
    }

    try {
      await onRename(conversation.id, next);
      setMode('idle');
      setActionError(null);
    } catch (error) {
      setActionError(error.message);
      setMode('idle');
    }
  };

  const confirmDelete = async () => {
    try {
      await onDelete(conversation.id);
    } catch (error) {
      setActionError(error.message);
      setMode('idle');
    }
  };

  if (mode === 'renaming') {
    return (
      <li className="conversation conversation--editing">
        <form
          onSubmit={event => {
            event.preventDefault();
            commitRename();
          }}
        >
          <input
            ref={inputRef}
            className="conversation__rename-input"
            value={draftTitle}
            onChange={event => setDraftTitle(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') setMode('idle');
            }}
            aria-label="Conversation title"
            maxLength={100}
          />
          <div className="conversation__rename-actions">
            <button type="submit" className="icon-button" aria-label="Save title" title="Save">
              <IconCheck size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Cancel rename"
              title="Cancel"
              onClick={() => setMode('idle')}
            >
              <IconClose size={15} />
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`conversation${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="conversation__select"
        onClick={() => onSelect(conversation.id)}
        aria-current={active ? 'true' : undefined}
      >
        <span className="conversation__icon" aria-hidden="true">
          {conversation.pinned ? <IconPin size={14} /> : <IconChat size={14} />}
        </span>
        <span className="conversation__text">
          <span className="conversation__title">{conversation.title}</span>
          <span className="conversation__meta">
            {formatRelativeTime(conversation.updatedAt)}
            {conversation.messageCount ? ` · ${conversation.messageCount} msgs` : ''}
          </span>
        </span>
      </button>

      {mode === 'confirmDelete' ? (
        <span className="conversation__confirm" role="alertdialog" aria-label="Confirm delete">
          <span>Delete?</span>
          <button type="button" className="icon-button icon-button--danger" onClick={confirmDelete} aria-label="Confirm delete">
            <IconCheck size={15} />
          </button>
          <button type="button" className="icon-button" onClick={() => setMode('idle')} aria-label="Cancel delete">
            <IconClose size={15} />
          </button>
        </span>
      ) : (
        <span className="conversation__actions">
          <button
            type="button"
            className="icon-button"
            title={conversation.pinned ? 'Unpin' : 'Pin'}
            aria-label={conversation.pinned ? 'Unpin conversation' : 'Pin conversation'}
            onClick={() => onTogglePin(conversation.id)}
          >
            <IconPin size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="Rename"
            aria-label="Rename conversation"
            onClick={beginRename}
          >
            <IconPencil size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="Delete"
            aria-label="Delete conversation"
            onClick={() => setMode('confirmDelete')}
          >
            <IconTrash size={14} />
          </button>
        </span>
      )}

      {actionError && <p className="conversation__error">{actionError}</p>}
    </li>
  );
}
