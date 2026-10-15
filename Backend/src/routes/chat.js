import express from 'express';
import {
  sendChatRequest,
  sendStreamingChatRequest,
  validateHistory,
  checkOllamaConnection,
  getAvailableModels
} from '../services/ollama.js';
import { 
  getAllConversations, 
  getConversation, 
  createConversation, 
  updateConversation, 
  deleteConversation,
  addMessage,
  updateMessage,
  deleteMessagesFrom,
  getActiveConversation,
  setActiveConversation,
  resolveOrCreateConversation,
  searchConversations,
  togglePin,
  groupConversationsByDate
} from '../services/conversations.js';
import { validateChatRequest, validateConversationId, validateMessageIndex } from '../middleware/validation.js';
import { OLLAMA_MODEL } from '../config/index.js';

const router = express.Router();

router.get('/conversations', (req, res) => {
  try {
    const conversations = getAllConversations();
    const grouped = groupConversationsByDate(conversations);
    const active = getActiveConversation();
    res.json({ conversations, grouped, activeId: active?.id || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

router.get('/conversations/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }
    const results = searchConversations(q);
    res.json({ conversations: results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed.' });
  }
});

router.post('/conversations', (req, res) => {
  try {
    const { firstMessage } = req.body;
    const conversation = createConversation(firstMessage || '');
    setActiveConversation(conversation.id);
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation.' });
  }
});

router.get('/conversations/active', (req, res) => {
  try {
    const active = getActiveConversation();
    if (!active) {
      return res.status(404).json({ error: 'No active conversation.' });
    }
    res.json(active);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get active conversation.' });
  }
});

router.get('/conversations/:id', validateConversationId, (req, res) => {
  try {
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversation.' });
  }
});

router.patch('/conversations/:id', validateConversationId, (req, res) => {
  try {
    const { title, pinned } = req.body;
    const updates = {};
    if (typeof title === 'string') {
      const trimmed = title.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }
      updates.title = trimmed.slice(0, 100);
    }
    if (typeof pinned === 'boolean') updates.pinned = pinned;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide a title or pinned value to update.' });
    }

    const conversation = updateConversation(req.params.id, updates);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update conversation.' });
  }
});

router.delete('/conversations/:id', validateConversationId, (req, res) => {
  try {
    const deleted = deleteConversation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

router.post('/conversations/:id/activate', validateConversationId, (req, res) => {
  try {
    setActiveConversation(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate conversation.' });
  }
});

router.post('/conversations/:id/pin', validateConversationId, (req, res) => {
  try {
    const conversation = togglePin(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle pin.' });
  }
});

router.post('/chat', validateChatRequest, async (req, res) => {
  try {
    const { message, history, conversationId, stream } = req.body;
    const safeHistory = validateHistory(history, message);
    
    // `conversationId: null` explicitly starts a new conversation; an absent
    // value continues whatever is active. See resolveOrCreateConversation.
    const conversation = resolveOrCreateConversation(conversationId, message);

    // Always track the resolved id. Previously this was only assigned when a
    // new conversation was created, so reusing the active conversation left it
    // undefined and messages were never persisted.
    const targetConversationId = conversation.id;
    
    const userMessage = { role: 'user', content: message.trim(), timestamp: new Date().toISOString() };
    addMessage(targetConversationId, userMessage);
    
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('X-Conversation-Id', targetConversationId);
      res.flushHeaders();
      
      let fullContent = '';
      const encoder = new TextEncoder();
      
      try {
        await sendStreamingChatRequest(message, safeHistory, (chunk, full, done) => {
          fullContent = full;
          const data = JSON.stringify({ chunk, full, done, conversationId: targetConversationId });
          res.write(encoder.encode(`data: ${data}\n\n`));
        });
        
        const assistantMessage = { 
          role: 'assistant', 
          content: fullContent, 
          timestamp: new Date().toISOString() 
        };
        addMessage(targetConversationId, assistantMessage);
        
        res.write(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: targetConversationId })}\n\n`));
        res.end();
      } catch (streamError) {
        console.error('Streaming error:', streamError.message);
        const errorData = JSON.stringify({ error: streamError.message, conversationId: targetConversationId });
        res.write(encoder.encode(`data: ${errorData}\n\n`));
        res.end();
      }
    } else {
      const reply = await sendChatRequest(message, safeHistory);
      const assistantMessage = { 
        role: 'assistant', 
        content: reply, 
        timestamp: new Date().toISOString() 
      };
      addMessage(targetConversationId, assistantMessage);

      // Read the message count back from the store; the `conversation` object
      // captured above predates both addMessage calls.
      const stored = getConversation(targetConversationId);

      res.json({ 
        reply, 
        conversationId: targetConversationId,
        messageCount: stored?.messages.length ?? 0,
        title: stored?.title || null
      });
    }
  } catch (error) {
    res.status(502).json({ 
      error: 'Could not get a response from the local model.',
      details: error.message
    });
  }
});

router.post('/conversations/:id/regenerate', validateConversationId, async (req, res) => {
  try {
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    
    const lastUserIndex = conversation.messages.findLastIndex(m => m.role === 'user');
    if (lastUserIndex === -1) {
      return res.status(400).json({ error: 'No user message to regenerate.' });
    }
    
    const userMessage = conversation.messages[lastUserIndex];
    const history = conversation.messages.slice(0, lastUserIndex);
    const safeHistory = validateHistory(history, userMessage.content);

    // Drop the previous answer(s) before generating a replacement so the old
    // and new responses never coexist as competing final answers.
    deleteMessagesFrom(req.params.id, lastUserIndex + 1);
    
    const reply = await sendChatRequest(userMessage.content, safeHistory);
    const assistantMessage = { 
      role: 'assistant', 
      content: reply, 
      timestamp: new Date().toISOString() 
    };
    addMessage(req.params.id, assistantMessage);

    const stored = getConversation(req.params.id);
    res.json({ reply, messageCount: stored?.messages.length ?? 0 });
  } catch (error) {
    res.status(502).json({ 
      error: 'Could not regenerate response.',
      details: error.message
    });
  }
});

router.post('/conversations/:id/edit-message', validateConversationId, validateMessageIndex, async (req, res) => {
  try {
    const { newContent } = req.body;
    if (typeof newContent !== 'string' || !newContent.trim()) {
      return res.status(400).json({ error: 'New content is required.' });
    }
    
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    
    if (req.messageIndex >= conversation.messages.length) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    
    const message = conversation.messages[req.messageIndex];
    if (message.role !== 'user') {
      return res.status(400).json({ error: 'Can only edit user messages.' });
    }
    
    // Remove everything after the edited message, then rewrite it in place.
    deleteMessagesFrom(req.params.id, req.messageIndex + 1);
    updateMessage(req.params.id, req.messageIndex, { content: newContent.trim() });

    const history = conversation.messages.slice(0, req.messageIndex);
    const safeHistory = validateHistory(history, newContent.trim());
    
    const reply = await sendChatRequest(newContent.trim(), safeHistory);
    const assistantMessage = { 
      role: 'assistant', 
      content: reply, 
      timestamp: new Date().toISOString() 
    };
    addMessage(req.params.id, assistantMessage);

    const stored = getConversation(req.params.id);
    res.json({ reply, messageCount: stored?.messages.length ?? 0 });
  } catch (error) {
    res.status(502).json({ 
      error: 'Could not get response for edited message.',
      details: error.message
    });
  }
});

router.get('/health', async (req, res) => {
  const ollamaConnected = await checkOllamaConnection();
  let models = [];
  if (ollamaConnected) {
    models = (await getAvailableModels()).map(m => m.name);
  }
  res.json({
    status: 'ok',
    ollama: ollamaConnected ? 'connected' : 'disconnected',
    model: OLLAMA_MODEL,
    models,
    timestamp: new Date().toISOString()
  });
});

export default router;