import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate persisted state before the app (and its config) is loaded.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsa-api-'));
process.env.CONVERSATIONS_FILE = path.join(tmpDir, 'conversations.json');
process.env.GMAIL_TOKENS_FILE = path.join(tmpDir, 'gmail-tokens.json');

const { default: app } = await import('../src/app.js');

const server = app.listen(0);
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const post = (url, body) =>
  fetch(`${base}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

test.after(() => {
  // fetch keeps connections alive; close them or the runner never exits.
  server.closeAllConnections?.();
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('GET /api/health reports Ollama state and the configured model', async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.status, 'ok');
  assert.ok(['connected', 'disconnected'].includes(body.ollama));
  assert.equal(typeof body.model, 'string');
  assert.ok(Array.isArray(body.models));
});

test('POST /api/chat rejects a missing or blank message', async () => {
  assert.equal((await post('/api/chat', {})).status, 400);
  assert.equal((await post('/api/chat', { message: '   ' })).status, 400);
  assert.equal((await post('/api/chat', { message: 42 })).status, 400);
});

test('POST /api/chat rejects an over-long message', async () => {
  const res = await post('/api/chat', { message: 'a'.repeat(9000) });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /too long/i);
});

test('POST /api/chat rejects malformed history', async () => {
  assert.equal((await post('/api/chat', { message: 'hi', history: 'nope' })).status, 400);
  assert.equal((await post('/api/chat', { message: 'hi', history: [{}] })).status, 400);
  assert.equal(
    (await post('/api/chat', { message: 'hi', history: [{ role: 'system', content: 'x' }] })).status,
    400
  );
});

test('conversation CRUD endpoints behave and validate input', async () => {
  const created = await post('/api/conversations', { firstMessage: 'How do I profile Node?' });
  assert.equal(created.status, 201);
  const conversation = await created.json();
  assert.ok(conversation.id);

  const list = await (await fetch(`${base}/api/conversations`)).json();
  assert.equal(list.conversations.some(c => c.id === conversation.id), true);
  assert.ok(list.grouped && typeof list.grouped === 'object');

  const fetched = await fetch(`${base}/api/conversations/${conversation.id}`);
  assert.equal(fetched.status, 200);

  const renamed = await fetch(`${base}/api/conversations/${conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Renamed' })
  });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).title, 'Renamed');

  const blank = await fetch(`${base}/api/conversations/${conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '   ' })
  });
  assert.equal(blank.status, 400);

  const pinned = await post(`/api/conversations/${conversation.id}/pin`, {});
  assert.equal((await pinned.json()).pinned, true);

  assert.equal((await fetch(`${base}/api/conversations/does-not-exist`)).status, 404);
  assert.equal((await post('/api/conversations/does-not-exist/pin', {})).status, 404);

  const search = await (await fetch(`${base}/api/conversations/search?q=Renamed`)).json();
  assert.equal(search.conversations.some(c => c.id === conversation.id), true);

  assert.equal((await fetch(`${base}/api/conversations/search`)).status, 400);

  const removed = await fetch(`${base}/api/conversations/${conversation.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal((await fetch(`${base}/api/conversations/${conversation.id}`)).status, 404);
});

test('regenerate requires an existing conversation', async () => {
  const res = await post('/api/conversations/nope/regenerate', {});
  assert.equal(res.status, 404);
});

test('edit-message validates the index before calling the model', async () => {
  const conversation = await (await post('/api/conversations', { firstMessage: 'q' })).json();
  const res = await post(`/api/conversations/${conversation.id}/edit-message`, {
    messageIndex: -1,
    newContent: 'x'
  });
  assert.equal(res.status, 400);

  const missing = await post(`/api/conversations/${conversation.id}/edit-message`, {
    messageIndex: 0,
    newContent: 'x'
  });
  // Index 0 does not exist yet in an empty conversation.
  assert.equal(missing.status, 404);
});

test('Gmail endpoints report disconnected state safely', async () => {
  const status = await (await fetch(`${base}/api/gmail/status`)).json();
  assert.equal(status.connected, false);
  assert.equal(status.email, null);

  const messages = await fetch(`${base}/api/gmail/messages`);
  assert.equal(messages.status, 401);

  const detail = await fetch(`${base}/api/gmail/messages/some-id`);
  assert.equal(detail.status, 401);

  const search = await post('/api/gmail/search', { query: 'invoice' });
  assert.equal(search.status, 401);

  // Connect either returns an authorization URL or a clear 503 when the
  // operator has not configured OAuth credentials.
  const connect = await fetch(`${base}/api/gmail/connect`);
  const body = await connect.json();
  if (connect.status === 200) {
    assert.match(body.url, /^https:\/\/accounts\.google\.com/);
    assert.match(body.url, /gmail\.readonly/);
  } else {
    assert.equal(connect.status, 503);
    assert.match(body.error, /not configured/i);
  }
});

test('unknown endpoints return a consistent JSON 404', async () => {
  const res = await fetch(`${base}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Endpoint not found.' });
});
