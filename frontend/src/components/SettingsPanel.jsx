import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconDownload, IconKeyboard, IconMonitor, IconMoon, IconSun, IconTrash } from './Icons.jsx';

const THEME_OPTIONS = [
  { value: 'system', label: 'System', Icon: IconMonitor },
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'dark', label: 'Dark', Icon: IconMoon }
];

const CONTEXT_OPTIONS = [4, 8, 12, 20];

export default function SettingsPanel({
  theme,
  resolvedTheme,
  onThemeChange,
  health,
  contextLimit,
  onContextLimitChange,
  conversationCount,
  onClearHistory,
  onExportConversation,
  canExport,
  onOpenShortcuts,
  onClose
}) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const clearHistory = async () => {
    setBusy(true);
    try {
      await onClearHistory();
      setMessage('Conversation history cleared.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
      setConfirmingClear(false);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <section className="settings__group">
        <h3>Appearance</h3>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              className={`segmented__option${theme === value ? ' is-active' : ''}`}
              onClick={() => onThemeChange(value)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <p className="settings__hint">Currently showing the {resolvedTheme} theme.</p>
      </section>

      <section className="settings__group">
        <h3>Local model</h3>
        <dl className="settings__facts">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`status-dot status-dot--${health.state === 'connected' ? 'ok' : 'off'}`} aria-hidden="true" />
              {health.state === 'connected' ? 'Connected' : health.state}
            </dd>
          </div>
          <div>
            <dt>Active model</dt>
            <dd>{health.model ?? 'unknown'}</dd>
          </div>
          <div>
            <dt>Backend</dt>
            <dd>http://localhost:3002 (proxied via /api)</dd>
          </div>
        </dl>
        {health.models.length > 0 && (
          <p className="settings__hint">
            Installed models: {health.models.join(', ')}. Change the active model with the
            OLLAMA_MODEL environment variable.
          </p>
        )}
      </section>

      <section className="settings__group">
        <h3>Context</h3>
        <label className="settings__field">
          <span>Recent messages sent with each request</span>
          <select
            value={contextLimit}
            onChange={event => onContextLimitChange(Number(event.target.value))}
          >
            {CONTEXT_OPTIONS.map(limit => (
              <option key={limit} value={limit}>
                Last {limit} messages
              </option>
            ))}
          </select>
        </label>
        <p className="settings__hint">
          Smaller context is faster and more predictable. The backend also caps context
          independently, so the smaller of the two always applies.
        </p>
      </section>

      <section className="settings__group">
        <h3>History</h3>
        <p className="settings__hint">
          {conversationCount} conversation{conversationCount === 1 ? '' : 's'} stored on this machine.
        </p>

        <div className="settings__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={onOpenShortcuts}
          >
            <IconKeyboard size={15} />
            Keyboard shortcuts
          </button>

          <button
            type="button"
            className="button button--ghost"
            onClick={onExportConversation}
            disabled={!canExport}
            title={canExport ? 'Export the open conversation as Markdown' : 'Open a conversation first'}
          >
            <IconDownload size={15} />
            Export current chat
          </button>

          {confirmingClear ? (
            <span className="settings__confirm" role="alertdialog" aria-label="Confirm clearing history">
              <span>Delete all conversations?</span>
              <button type="button" className="button button--danger" onClick={clearHistory} disabled={busy}>
                Yes, delete
              </button>
              <button type="button" className="button button--ghost" onClick={() => setConfirmingClear(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="button button--danger-ghost"
              onClick={() => setConfirmingClear(true)}
              disabled={conversationCount === 0}
            >
              <IconTrash size={15} />
              Clear all history
            </button>
          )}
        </div>

        {message && <p className="settings__hint">{message}</p>}
      </section>
    </Modal>
  );
}
