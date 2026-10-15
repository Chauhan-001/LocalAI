import { MAX_MESSAGE_LENGTH } from '../config/index.js';

export function validateChatRequest(req, res, next) {
  const { message, history } = req.body;
  
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }
  
  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ error: 'History must be an array.' });
  }
  
  if (Array.isArray(history)) {
    for (const item of history) {
      if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') {
        return res.status(400).json({ error: 'Invalid history format.' });
      }
      if (item.content.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: 'History message too long.' });
      }
    }
  }
  
  next();
}

export function validateConversationId(req, res, next) {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required.' });
  }
  next();
}

export function validateMessageIndex(req, res, next) {
  const raw = req.body?.messageIndex ?? req.params?.messageIndex;
  const index = parseInt(raw, 10);
  if (isNaN(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid message index.' });
  }
  req.messageIndex = index;
  next();
}