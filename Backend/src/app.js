import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat.js';
import gmailRoutes from './routes/gmail.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { FRONTEND_URL } from './config/index.js';

const app = express();

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// Bounds a single request body. Conversation length is capped separately by
// MAX_CONTEXT_MESSAGES / MAX_MESSAGE_LENGTH in the validation layer.
app.use(express.json({ limit: '1mb' }));

// chatRoutes declares absolute paths ('/chat', '/conversations', '/health'),
// so it is mounted at '/api' to expose POST /api/chat, /api/conversations/*
// and GET /api/health (which reports Ollama reachability and the active model).
app.use('/api', chatRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/auth/gmail', gmailRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
