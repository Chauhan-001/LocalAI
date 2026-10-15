import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONVERSATIONS_FILE } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve data paths against the backend root rather than process.cwd() so the
// store behaves the same however the server is launched.
const backendRoot = path.join(__dirname, '..', '..');
const dataDir = path.join(backendRoot, 'data');
const conversationsPath = path.isAbsolute(CONVERSATIONS_FILE)
  ? CONVERSATIONS_FILE
  : path.resolve(backendRoot, CONVERSATIONS_FILE);

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readConversations() {
  ensureDataDir();
  try {
    if (fs.existsSync(conversationsPath)) {
      const data = fs.readFileSync(conversationsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading conversations:', error.message);
  }
  return { conversations: [], activeId: null };
}

function writeConversations(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(conversationsPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing conversations:', error.message);
    return false;
  }
}

const PLACEHOLDER_TITLE = 'New Chat';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function generateTitle(firstMessage) {
  const trimmed = firstMessage.trim();
  if (!trimmed) return PLACEHOLDER_TITLE;
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
}

function isPlaceholderTitle(title) {
  return !title || title === PLACEHOLDER_TITLE;
}

export function getAllConversations() {
  const data = readConversations();
  return data.conversations.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages?.length || 0,
    pinned: c.pinned || false
  }));
}

export function getConversation(id) {
  const data = readConversations();
  return data.conversations.find(c => c.id === id) || null;
}

export function createConversation(firstMessage = '') {
  const data = readConversations();
  const now = new Date().toISOString();
  const conversation = {
    id: generateId(),
    title: generateTitle(firstMessage),
    createdAt: now,
    updatedAt: now,
    messages: [],
    pinned: false
  };
  data.conversations.unshift(conversation);
  data.activeId = conversation.id;
  writeConversations(data);
  return conversation;
}

export function updateConversation(id, updates) {
  const data = readConversations();
  const index = data.conversations.findIndex(c => c.id === id);
  if (index === -1) return null;
  data.conversations[index] = {
    ...data.conversations[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  writeConversations(data);
  return data.conversations[index];
}

export function deleteConversation(id) {
  const data = readConversations();
  data.conversations = data.conversations.filter(c => c.id !== id);
  if (data.activeId === id) {
    data.activeId = data.conversations[0]?.id || null;
  }
  writeConversations(data);
  return true;
}

export function addMessage(conversationId, message) {
  const data = readConversations();
  const conversation = data.conversations.find(c => c.id === conversationId);
  if (!conversation) return null;
  conversation.messages.push(message);
  conversation.updatedAt = new Date().toISOString();

  // Derive a title from the first message, but never overwrite a title the
  // user (or the create call) already chose.
  if (conversation.messages.length === 1 && isPlaceholderTitle(conversation.title)) {
    conversation.title = generateTitle(message.content);
  }

  writeConversations(data);
  return message;
}

export function updateMessage(conversationId, messageIndex, updates) {
  const data = readConversations();
  const conversation = data.conversations.find(c => c.id === conversationId);
  if (!conversation || messageIndex < 0 || messageIndex >= conversation.messages.length) {
    return null;
  }
  conversation.messages[messageIndex] = {
    ...conversation.messages[messageIndex],
    ...updates
  };
  conversation.updatedAt = new Date().toISOString();
  writeConversations(data);
  return conversation.messages[messageIndex];
}

export function deleteMessagesFrom(conversationId, messageIndex) {
  const data = readConversations();
  const conversation = data.conversations.find(c => c.id === conversationId);
  if (!conversation) return false;
  conversation.messages = conversation.messages.slice(0, messageIndex);
  conversation.updatedAt = new Date().toISOString();
  writeConversations(data);
  return true;
}

/**
 * Resolve which conversation a chat request targets.
 *
 * - `null`     -> explicitly start a new conversation
 * - `<id>`     -> that conversation (creating one if it no longer exists)
 * - `undefined`-> the server's currently active conversation
 */
export function resolveOrCreateConversation(conversationId, firstMessage = '') {
  if (conversationId === null) {
    return createConversation(firstMessage);
  }

  if (typeof conversationId === 'string' && conversationId) {
    return getConversation(conversationId) ?? createConversation(firstMessage);
  }

  return getActiveConversation() ?? createConversation(firstMessage);
}

export function getActiveConversation() {
  const data = readConversations();
  if (data.activeId) {
    return data.conversations.find(c => c.id === data.activeId) || null;
  }
  return data.conversations[0] || null;
}

export function setActiveConversation(id) {
  const data = readConversations();
  data.activeId = id;
  writeConversations(data);
  return true;
}

export function searchConversations(query) {
  const data = readConversations();
  const lowerQuery = query.toLowerCase();
  return data.conversations.filter(c => 
    c.title.toLowerCase().includes(lowerQuery) ||
    c.messages?.some(m => m.content.toLowerCase().includes(lowerQuery))
  ).map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages?.length || 0,
    pinned: c.pinned || false
  }));
}

export function togglePin(conversationId) {
  const data = readConversations();
  const conversation = data.conversations.find(c => c.id === conversationId);
  if (!conversation) return null;
  conversation.pinned = !conversation.pinned;
  writeConversations(data);
  return conversation;
}

export function groupConversationsByDate(conversations) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups = { Today: [], Yesterday: [], 'Previous 7 Days': [], Older: [] };

  for (const conv of conversations) {
    const updated = new Date(conv.updatedAt);
    if (updated >= today) {
      groups.Today.push(conv);
    } else if (updated >= yesterday) {
      groups.Yesterday.push(conv);
    } else if (updated >= sevenDaysAgo) {
      groups['Previous 7 Days'].push(conv);
    } else {
      groups.Older.push(conv);
    }
  }

  return groups;
}