import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Sidebar from './components/Sidebar.jsx';
import MessageList from './components/MessageList.jsx';
import Composer from './components/Composer.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import ShortcutsDialog from './components/ShortcutsDialog.jsx';
import GmailPanel from './components/GmailPanel.jsx';

import { useChat } from './hooks/useChat.js';
import { useConversations } from './hooks/useConversations.js';
import { useGmail } from './hooks/useGmail.js';
import { useHealth } from './hooks/useHealth.js';
import { useTheme } from './hooks/useTheme.js';

import { copyText } from './lib/clipboard.js';
import { conversationToMarkdown, downloadTextFile, safeFilename } from './lib/format.js';
import { withEmailContext, withEmailsContext, detectEmailIntent } from './lib/email-context.js';
import { IconDownload, IconMenu, IconSettings, IconSparkle } from './components/Icons.jsx';

const CONTEXT_LIMIT_KEY = 'lsa.contextLimit';
const SIDEBAR_KEY = 'lsa.sidebarCollapsed';
const CONTEXT_OPTIONS = [4, 8, 12, 20];

function readStoredContextLimit() {
  try {
    const stored = Number(localStorage.getItem(CONTEXT_LIMIT_KEY));
    return CONTEXT_OPTIONS.includes(stored) ? stored : 20;
  } catch {
    return 20;
  }
}

function readStoredBoolean(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const { theme, resolved, setTheme } = useTheme();
  const health = useHealth();
  const conversations = useConversations();
  const gmail = useGmail();

  const [contextLimit, setContextLimit] = useState(readStoredContextLimit);
  const chat = useChat({
    onConversationsChanged: conversations.refresh,
    contextLimit
  });

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readStoredBoolean(SIDEBAR_KEY));
  const [emailContext, setEmailContext] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [toast, setToast] = useState(null);

  const bottomRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = chat.busy;
  }, [chat.busy]);

  useEffect(() => {
    try {
      localStorage.setItem(CONTEXT_LIMIT_KEY, String(contextLimit));
    } catch {
      // Preferences are best-effort; the app still works without storage.
    }
  }, [contextLimit]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
  }, [collapsed]);

  // `load` is stable, so depending on it directly keeps this effect from
  // re-running on every unrelated `chat` state change.
  const loadConversation = chat.load;

  // Load the selected conversation, unless a request is mid-flight (in which
  // case the send path owns the transcript state).
  useEffect(() => {
    if (busyRef.current) return;
    loadConversation(conversations.activeId);
  }, [conversations.activeId, loadConversation]);

  const hasMessages = chat.messages.length > 0 || chat.streamingText !== null;

  // Keep the newest content in view.
  useEffect(() => {
    if (!hasMessages && !chat.busy) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: reduced ? 'auto' : 'smooth' });
  }, [chat.messages.length, chat.streamingText, chat.busy, hasMessages]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((text, type = 'info') => setToast({ text, type }), []);

  const handleNewChat = useCallback(() => {
    chat.startNew();
    conversations.setActiveId(null);
    setDraft('');
    setEditing(null);
    setEmailContext(null);
    setSidebarOpen(false);
  }, [chat, conversations]);

  const handleSelectConversation = useCallback(
    id => {
      conversations.select(id);
      setEditing(null);
      setEmailContext(null);
      setSidebarOpen(false);
    },
    [conversations]
  );

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || chat.busy) return;

    if (editing) {
      const result = await chat.editAndResend(editing.index, text);
      if (result.ok) {
        setEditing(null);
        setDraft('');
      } else {
        showToast(result.error?.message ?? 'Could not update that message.', 'error');
      }
      return;
    }

    // Check for email intent and auto-fetch if needed
    const { shouldFetch, query } = detectEmailIntent(text);
    let payload = text;

    if (shouldFetch && gmail.connected) {
      setToast({ text: `Fetching emails${query ? ` (${query})` : ''}...`, type: 'info' });
      try {
        const fetchedMessages = await gmail.load(query);
        if (fetchedMessages.length > 0) {
          payload = withEmailsContext(text, fetchedMessages);
        }
      } catch (e) {
        showToast(`Failed to fetch emails: ${e.message}`, 'error');
      }
    }

    // Use emailContext if manually attached (takes precedence over auto-fetch)
    if (emailContext) {
      payload = withEmailContext(text, emailContext);
    }

    setDraft('');
    setEmailContext(null);
    setToast(null);

    const result = await chat.send(payload);

    if (result.ok) {
      if (result.conversationId) conversations.setActiveId(result.conversationId);
      return;
    }

    if (result.reason === 'error') {
      showToast(result.error?.message ?? 'The request failed.', 'error');
      if (result.restoreDraft) setDraft(text);
    }
  }, [chat, conversations, draft, editing, emailContext, gmail.connected, gmail.messages, showToast]);

  const handleRegenerate = useCallback(async () => {
    const result = await chat.regenerate();
    if (!result.ok) showToast(result.error?.message ?? 'Could not regenerate.', 'error');
  }, [chat, showToast]);

  const handleEditRequest = useCallback(
    index => {
      const message = chat.messages[index];
      if (!message) return;
      setEditing({ index, content: message.content });
      setDraft(message.content);
    },
    [chat.messages]
  );

  const handleFeedback = useCallback(
    (index, value) => {
      setFeedback(previous => ({
        ...previous,
        [index]: previous[index] === value ? null : value
      }));
      showToast(value === 'up' ? 'Marked as helpful.' : 'Marked as not helpful.');
    },
    [showToast]
  );

  const handleExport = useCallback(() => {
    if (!chat.conversation) return;
    downloadTextFile(
      safeFilename(chat.title),
      conversationToMarkdown(chat.conversation)
    );
    showToast('Conversation exported as Markdown.');
  }, [chat.conversation, chat.title, showToast]);

  const copyLastResponse = useCallback(async () => {
    const lastAssistant = [...chat.messages].reverse().find(message => message.role === 'assistant');
    if (!lastAssistant) {
      showToast('No assistant response to copy yet.', 'error');
      return;
    }
    const copied = await copyText(lastAssistant.content);
    showToast(copied ? 'Copied the latest response.' : 'Copy failed — select the text and press Ctrl+C.', copied ? 'info' : 'error');
  }, [chat.messages, showToast]);

  const handleAttachEmail = useCallback(
    (email, prompt) => {
      setEmailContext(email);
      setDraft(prompt);
      setDialog(null);
    },
    []
  );

  const handleClearHistory = useCallback(async () => {
    await conversations.clearAll();
    chat.startNew();
    setFeedback({});
  }, [chat, conversations]);

  // Global shortcuts. Documented in ShortcutsDialog.
  useEffect(() => {
    const onKeyDown = event => {
      const modifier = event.ctrlKey || event.metaKey;

      if (!modifier) {
        if (event.altKey && event.key.toLowerCase() === 'n') {
          event.preventDefault();
          handleNewChat();
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'k':
          event.preventDefault();
          document.getElementById('conversation-search')?.focus();
          break;
        case 'b':
          event.preventDefault();
          setCollapsed(value => !value);
          break;
        case '/':
          event.preventDefault();
          setDialog(current => (current === 'shortcuts' ? null : 'shortcuts'));
          break;
        case 'c':
          if (event.shiftKey) {
            event.preventDefault();
            copyLastResponse();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copyLastResponse, handleNewChat]);

  const activeConversation = useMemo(
    () => conversations.conversations.find(item => item.id === conversations.activeId) ?? null,
    [conversations.activeId, conversations.conversations]
  );

  const headerTitle = chat.title || activeConversation?.title || 'New chat';

  return (
    <div className={`app${collapsed ? ' app--collapsed' : ''}`}>
      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(value => !value)}
        onClose={() => setSidebarOpen(false)}
        grouped={conversations.grouped}
        conversations={conversations.conversations}
        results={conversations.results}
        query={conversations.query}
        onSearch={conversations.runSearch}
        activeId={conversations.activeId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onRename={conversations.rename}
        onDelete={conversations.remove}
        onTogglePin={conversations.togglePin}
        health={health}
        gmail={gmail}
        onOpenSettings={() => setDialog('settings')}
        onOpenShortcuts={() => setDialog('shortcuts')}
        onOpenGmail={() => setDialog('gmail')}
      />

      <main className="workspace">
        <header className="workspace__header">
          <button
            type="button"
            className="icon-button workspace__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <IconMenu size={18} />
          </button>

          <div className="workspace__heading">
            <h1>{headerTitle}</h1>
            <p className={`workspace__model status--${health.state}`}>
              <span className="status-dot" aria-hidden="true" />
              {health.state === 'connected' ? `${health.model} · running locally` : health.state}
            </p>
          </div>

          <div className="workspace__actions">
            <button
              type="button"
              className="icon-button"
              onClick={handleExport}
              disabled={!chat.conversation}
              title="Export this conversation as Markdown"
              aria-label="Export this conversation as Markdown"
            >
              <IconDownload size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => setDialog('settings')}
              title="Settings"
              aria-label="Open settings"
            >
              <IconSettings size={16} />
            </button>
          </div>
        </header>

        <div className="workspace__body">
          {!hasMessages && !chat.loadingConversation ? (
            <WelcomeScreen
              model={health.model}
              health={health}
              onSelectPrompt={prompt => {
                setDraft(prompt);
                setEditing(null);
              }}
            />
          ) : (
            <MessageList
              messages={chat.messages}
              streamingText={chat.streamingText}
              busy={chat.busy}
              error={chat.error}
              loading={chat.loadingConversation}
              feedback={feedback}
              bottomRef={bottomRef}
              onEdit={handleEditRequest}
              onRegenerate={handleRegenerate}
              onFeedback={handleFeedback}
              onRetry={handleSubmit}
            />
          )}
        </div>

        <footer className="workspace__composer">
          {emailContext && (
            <div className="context-chip">
              <IconSparkle size={14} />
              <span>
                Email context attached: <strong>{emailContext.subject || '(no subject)'}</strong>
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEmailContext(null)}
                aria-label="Remove attached email"
              >
                ×
              </button>
            </div>
          )}

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onStop={chat.stop}
            busy={chat.busy}
            canStream={chat.streamingText !== null}
            editing={editing}
            onCancelEdit={() => {
              setEditing(null);
              setDraft('');
            }}
          />
        </footer>
      </main>

      {dialog === 'settings' && (
        <SettingsPanel
          theme={theme}
          resolvedTheme={resolved}
          onThemeChange={setTheme}
          health={health}
          contextLimit={contextLimit}
          onContextLimitChange={setContextLimit}
          conversationCount={conversations.conversations.length}
          onClearHistory={handleClearHistory}
          onExportConversation={handleExport}
          canExport={Boolean(chat.conversation)}
          onOpenShortcuts={() => setDialog('shortcuts')}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}

      {dialog === 'gmail' && (
        <GmailPanel gmail={gmail} onAttachEmail={handleAttachEmail} onClose={() => setDialog(null)} />
      )}

      {toast && (
        <div className={`toast toast--${toast.type}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
