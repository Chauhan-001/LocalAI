import { useMemo } from 'react';
import ConversationItem from './ConversationItem.jsx';
import {
  IconClose,
  IconKeyboard,
  IconMail,
  IconPanelLeft,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkle
} from './Icons.jsx';

const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

export default function Sidebar({
  open,
  collapsed,
  onToggleCollapse,
  onClose,
  grouped,
  conversations,
  results,
  query,
  onSearch,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onTogglePin,
  health,
  gmail,
  onOpenSettings,
  onOpenShortcuts,
  onOpenGmail
}) {
  // Pinned conversations surface first, regardless of age.
  const pinned = useMemo(
    () => conversations.filter(conversation => conversation.pinned),
    [conversations]
  );

  const isSearching = query.trim().length > 0;
  const visible = results ?? [];
  const isEmptyLibrary = !isSearching && conversations.length === 0;

  const renderItem = conversation => (
    <ConversationItem
      key={conversation.id}
      conversation={conversation}
      active={conversation.id === activeId}
      onSelect={onSelect}
      onRename={onRename}
      onDelete={onDelete}
      onTogglePin={onTogglePin}
    />
  );

  return (
    <>
      {open && <button type="button" className="sidebar__scrim" aria-label="Close sidebar" onClick={onClose} />}

      <aside
        className={`sidebar${open ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}
        aria-label="Conversations"
      >
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <span className="sidebar__logo" aria-hidden="true">
              <IconSparkle size={16} />
            </span>
            {!collapsed && <span className="sidebar__name">Local AI Assistant</span>}
          </div>

          <div className="sidebar__top-actions">
            <button
              type="button"
              className="icon-button sidebar__collapse"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
            >
              <IconPanelLeft size={16} />
            </button>
            <button
              type="button"
              className="icon-button sidebar__close"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>

        {collapsed ? (
          <div className="sidebar__rail">
            <button type="button" className="icon-button" onClick={onNewChat} title="New chat" aria-label="New chat">
              <IconPlus size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onToggleCollapse}
              title="Search conversations"
              aria-label="Search conversations"
            >
              <IconSearch size={16} />
            </button>
            <button type="button" className="icon-button" onClick={onOpenSettings} title="Settings" aria-label="Open settings">
              <IconSettings size={16} />
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="button button--new-chat" onClick={onNewChat}>
              <IconPlus size={16} />
              New Chat
            </button>

            <div className="sidebar__search">
              <IconSearch size={15} />
              <label htmlFor="conversation-search" className="visually-hidden">
                Search conversations
              </label>
              <input
                id="conversation-search"
                type="search"
                value={query}
                placeholder="Search conversations"
                onChange={event => onSearch(event.target.value)}
              />
              {query && (
                <button type="button" className="icon-button" onClick={() => onSearch('')} aria-label="Clear search">
                  <IconClose size={14} />
                </button>
              )}
            </div>

            <nav className="sidebar__history">
              {isEmptyLibrary && (
                <p className="sidebar__empty">
                  No conversations yet. Start one below and it will be saved automatically.
                </p>
              )}

              {isSearching && (
                <>
                  <h2 className="sidebar__group-title">Results</h2>
                  {visible.length === 0 ? (
                    <p className="sidebar__empty">Nothing matched “{query}”.</p>
                  ) : (
                    <ul className="conversation-list">{visible.map(renderItem)}</ul>
                  )}
                </>
              )}

              {!isSearching && pinned.length > 0 && (
                <>
                  <h2 className="sidebar__group-title">Pinned</h2>
                  <ul className="conversation-list">{pinned.map(renderItem)}</ul>
                </>
              )}

              {!isSearching &&
                GROUP_ORDER.map(group => {
                  const items = (grouped?.[group] ?? []).filter(item => !item.pinned);
                  if (items.length === 0) return null;

                  return (
                    <section key={group}>
                      <h2 className="sidebar__group-title">{group}</h2>
                      <ul className="conversation-list">{items.map(renderItem)}</ul>
                    </section>
                  );
                })}
            </nav>

            <div className="sidebar__footer">
              <button
                type="button"
                className="sidebar__row"
                onClick={onOpenGmail}
                title="Gmail"
              >
                <IconMail size={15} />
                <span className="sidebar__row-label">Gmail</span>
                <span className={`status-dot status-dot--${gmail.connected ? 'ok' : 'off'}`} aria-hidden="true" />
                <span className="sidebar__row-value">
                  {gmail.connected ? gmail.email ?? 'Connected' : 'Not connected'}
                </span>
              </button>

              <button type="button" className="sidebar__row" onClick={onOpenSettings} title="Settings">
                <IconSettings size={15} />
                <span className="sidebar__row-label">Settings</span>
              </button>

              <button type="button" className="sidebar__row" onClick={onOpenShortcuts} title="Keyboard shortcuts">
                <IconKeyboard size={15} />
                <span className="sidebar__row-label">Shortcuts</span>
              </button>

              <p className={`sidebar__local status--${health.state}`}>
                <span className="status-dot" aria-hidden="true" />
                {health.state === 'connected' && `Local model ready · ${health.model}`}
                {health.state === 'disconnected' && `Model ${health.model ?? ''} not pulled`}
                {health.state === 'unreachable' && 'Ollama unreachable'}
                {health.state === 'checking' && 'Checking local model…'}
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
