import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the store at a throwaway file before the config module is evaluated so
// tests never touch the developer's real conversation history.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsa-conv-'));
const storePath = path.join(tmpDir, 'conversations.json');
process.env.CONVERSATIONS_FILE = storePath;

const store = await import('../src/services/conversations.js');

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('createConversation derives a title and becomes active', () => {
  const conversation = store.createConversation('Explain closures in JavaScript');

  assert.equal(conversation.title, 'Explain closures in JavaScript');
  assert.equal(conversation.messages.length, 0);
  assert.equal(conversation.pinned, false);
  assert.ok(conversation.createdAt);
  assert.equal(store.getActiveConversation().id, conversation.id);
});

test('createConversation without a message falls back to a placeholder title', () => {
  assert.equal(store.createConversation().title, 'New Chat');
});

test('addMessage appends and persists across reads', () => {
  const conversation = store.createConversation();
  const id = conversation.id;

  store.addMessage(id, { role: 'user', content: 'What is a promise?' });
  store.addMessage(id, { role: 'assistant', content: 'A future value.' });

  const stored = store.getConversation(id);
  assert.equal(stored.messages.length, 2);
  assert.equal(stored.messages[0].role, 'user');
  assert.equal(stored.messages[1].content, 'A future value.');

  // Reload from disk to prove the write actually landed.
  assert.equal(JSON.parse(fs.readFileSync(storePath, 'utf-8')).conversations.length > 0, true);
});

test('updateMessage edits in place and rejects an out-of-range index', () => {
  const conversation = store.createConversation();
  store.addMessage(conversation.id, { role: 'user', content: 'original' });

  const updated = store.updateMessage(conversation.id, 0, { content: 'edited' });
  assert.equal(updated.content, 'edited');
  assert.equal(store.updateMessage(conversation.id, 99, { content: 'x' }), null);
});

test('deleteMessagesFrom truncates the branch', () => {
  const conversation = store.createConversation();
  const id = conversation.id;
  ['a', 'b', 'c'].forEach(content => store.addMessage(id, { role: 'user', content }));

  store.deleteMessagesFrom(id, 1);
  assert.deepEqual(store.getConversation(id).messages.map(m => m.content), ['a']);
});

test('rename and pin update metadata', () => {
  const conversation = store.createConversation();
  const renamed = store.updateConversation(conversation.id, { title: 'Better title' });
  assert.equal(renamed.title, 'Better title');

  const pinned = store.togglePin(conversation.id);
  assert.equal(pinned.pinned, true);
  assert.equal(store.togglePin(conversation.id).pinned, false);
  assert.equal(store.updateConversation('missing-id', { title: 'x' }), null);
});

test('deleteConversation removes it and reassigns the active conversation', () => {
  const conversation = store.createConversation();
  const id = conversation.id;
  assert.equal(store.getActiveConversation().id, id);

  assert.equal(store.deleteConversation(id), true);
  assert.equal(store.getConversation(id), null);
  assert.notEqual(store.getActiveConversation()?.id, id);
});

test('searchConversations matches titles and message bodies', () => {
  const conversation = store.createConversation('Understanding recursion');
  store.addMessage(conversation.id, { role: 'user', content: 'explain the call stack' });

  assert.equal(store.searchConversations('recursion').length, 1);
  assert.equal(store.searchConversations('call stack').length, 1);
  assert.equal(store.searchConversations('definitely-not-present-xyz').length, 0);
});

test('groupConversationsByDate buckets by updatedAt', () => {
  const now = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const grouped = store.groupConversationsByDate([
    { id: 'a', updatedAt: now },
    { id: 'b', updatedAt: threeDaysAgo },
    { id: 'c', updatedAt: thirtyDaysAgo }
  ]);

  assert.equal(grouped.Today.length, 1);
  assert.equal(grouped['Previous 7 Days'].length, 1);
  assert.equal(grouped.Older.length, 1);
  assert.equal(grouped.Yesterday.length, 0);
});

test('getAllConversations exposes summaries without leaking message bodies', () => {
  const summary = store.getAllConversations()[0];
  assert.ok('messageCount' in summary);
  assert.equal('messages' in summary, false);
});

test('resolveOrCreateConversation honours explicit null as "start new"', () => {
  const active = store.createConversation('active conversation');
  store.setActiveConversation(active.id);

  const fresh = store.resolveOrCreateConversation(null, 'brand new chat');

  assert.notEqual(fresh.id, active.id);
  assert.equal(fresh.title, 'brand new chat');
  // Creating for an explicit new chat also makes it active.
  assert.equal(store.getActiveConversation().id, fresh.id);
});

test('resolveOrCreateConversation continues a named conversation', () => {
  const first = store.createConversation('first');
  const second = store.createConversation('second');
  store.setActiveConversation(second.id);

  const resolved = store.resolveOrCreateConversation(first.id, 'ignored');
  assert.equal(resolved.id, first.id);
});

test('resolveOrCreateConversation falls back to the active conversation', () => {
  const active = store.createConversation('active');
  store.setActiveConversation(active.id);

  assert.equal(store.resolveOrCreateConversation(undefined, 'ignored').id, active.id);
});

test('resolveOrCreateConversation creates one when the id is unknown', () => {
  const resolved = store.resolveOrCreateConversation('no-such-id', 'recovery');
  assert.ok(resolved.id);
  assert.notEqual(resolved.id, 'no-such-id');
  assert.equal(resolved.title, 'recovery');
});
