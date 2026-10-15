import express from 'express';
import crypto from 'crypto';import { FRONTEND_URL } from '../config/index.js';
import {
  getAuthUrl,  
  getTokensFromCode, 
  setCredentials, 
  saveTokens, 
  loadTokens, 
  clearTokens, 
  isConnected,
  listMessages,
  getMessage,
  parseMessage,
  searchAndParseMessages
} from '../services/gmail.js';

const router = express.Router();

const oauthStates = new Map();

router.get('/status', (req, res) => {
  try {
    const connected = isConnected();
    const tokens = loadTokens();
    res.json({ 
      connected,
      email: tokens?.email || null,
      scopes: tokens?.scope || null
    });
  } catch (err) {
    console.error('Gmail status error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/connect', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { createdAt: Date.now() });
  
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);
  
  try {
    const url = getAuthUrl(state);
    res.json({ url, state });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`${FRONTEND_URL}?gmail=error&message=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}?gmail=error&message=Missing authorization code or state`);
  }
  
  const stateData = oauthStates.get(state);
  if (!stateData) {
    return res.redirect(`${FRONTEND_URL}?gmail=error&message=Invalid or expired state`);
  }
  oauthStates.delete(state);
  
  try {
    const tokens = await getTokensFromCode(code);
    setCredentials(tokens);
    saveTokens(tokens);
    
    res.redirect(`${FRONTEND_URL}?gmail=connected`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${FRONTEND_URL}?gmail=error&message=${encodeURIComponent(err.message)}`);
  }
});

router.post('/disconnect', (req, res) => {
  clearTokens();
  res.json({ success: true });
});

router.get('/messages', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(401).json({ error: 'Gmail not connected.' });
    }
    
    const { q, maxResults } = req.query;
    const query = typeof q === 'string' ? q : '';
    const max = Math.min(parseInt(maxResults, 10) || 20, 50);
    
    const { messages, error } = await listMessages(query, max);
    if (error) {
      return res.status(502).json({ error: 'Failed to fetch messages.', details: error });
    }
    
    const parsed = messages.map(m => parseMessage(m)).filter(Boolean);
    res.json({ messages: parsed });
  } catch (err) {
    console.error('Gmail messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/messages/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(401).json({ error: 'Gmail not connected.' });
  }
  
  const { message, error } = await getMessage(req.params.id);
  if (error || !message) {
    return res.status(404).json({ error: 'Message not found.', details: error });
  }
  
  const parsed = parseMessage(message);
  res.json({ message: parsed });
});

router.post('/search', async (req, res) => {
  if (!isConnected()) {
    return res.status(401).json({ error: 'Gmail not connected.' });
  }
  
  const { query, maxResults } = req.body;
  const q = typeof query === 'string' ? query : '';
  const max = Math.min(parseInt(maxResults, 10) || 10, 20);
  
  const { messages, error } = await searchAndParseMessages(q, max);
  if (error) {
    return res.status(502).json({ error: 'Search failed.', details: error });
  }
  
  res.json({ messages });
});

export default router;