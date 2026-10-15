import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconAlert, IconMail, IconSearch, IconSparkle } from './Icons.jsx';
import { recoveryHint } from '../lib/api.js';

const PREVIEW_LENGTH = 6000;

export default function GmailPanel({ gmail, onAttachEmail, onClose }) {
  const [query, setQuery] = useState('');

  const { connected, email, messages, selected, busy, error, notice } = gmail;

  return (
    <Modal title="Gmail (read-only)" onClose={onClose} size="wide">
      <div className="gmail">
        <div className="gmail__status">
          <IconMail size={16} />
          <span>
            {connected ? `Connected as ${email ?? 'your account'}` : 'Not connected'}
          </span>
          <span className="gmail__scope">Scope: gmail.readonly — messages are never modified.</span>

          {connected ? (
            <button type="button" className="button button--ghost" onClick={gmail.disconnect} disabled={busy}>
              Disconnect
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={gmail.connect}>
              Connect Gmail
            </button>
          )}
        </div>

        {notice && (
          <p className="notice" role="status">
            {notice}
            <button type="button" className="icon-button" onClick={gmail.clearNotice} aria-label="Dismiss">
              ×
            </button>
          </p>
        )}

        {error && (
          <div className="inline-error" role="alert">
            <IconAlert size={16} />
            <div className="inline-error__body">
              <strong>{error.message}</strong>
              <span>{recoveryHint(error)}</span>
            </div>
          </div>
        )}

        {connected && (
          <>
            <form
              className="gmail__search"
              onSubmit={event => {
                event.preventDefault();
                gmail.load(query);
              }}
            >
              <IconSearch size={15} />
              <label htmlFor="gmail-query" className="visually-hidden">
                Gmail search query
              </label>
              <input
                id="gmail-query"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="from:alice is:unread — uses Gmail search syntax"
              />
              <button type="submit" className="button button--ghost" disabled={busy}>
                Search
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setQuery('');
                  gmail.load('');
                }}
                disabled={busy}
              >
                Recent
              </button>
            </form>

            <div className="gmail__layout">
              <ul className="gmail__list">
                {messages.length === 0 && (
                  <li className="gmail__empty">
                    {busy ? 'Loading messages…' : 'No messages loaded yet.'}
                  </li>
                )}
                {messages.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`gmail__item${selected?.id === item.id ? ' is-active' : ''}`}
                      onClick={() => gmail.open(item.id)}
                    >
                      <span className="gmail__item-subject">{item.subject || '(no subject)'}</span>
                      <span className="gmail__item-from">{item.from}</span>
                      <span className="gmail__item-snippet">{item.snippet}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="gmail__detail">
                {!selected && <p className="gmail__empty">Select a message to read it.</p>}

                {selected && (
                  <>
                    <h3>{selected.subject || '(no subject)'}</h3>
                    <p className="gmail__detail-meta">
                      {selected.from} · {selected.date}
                    </p>
                    <pre className="gmail__body">
                      {(selected.body || selected.snippet || '').slice(0, PREVIEW_LENGTH)}
                    </pre>

                    <div className="gmail__detail-actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => onAttachEmail(selected, 'Summarize this email in a few bullet points.')}
                      >
                        <IconSparkle size={15} />
                        Summarize with AI
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => onAttachEmail(selected, 'What action does this email require from me?')}
                      >
                        Ask about this email
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {!connected && (
          <p className="gmail__empty">
            Connect your Gmail account to read recent messages or search your mailbox. Only read
            access is requested, and credentials stay on the backend.
          </p>
        )}
      </div>
    </Modal>
  );
}
