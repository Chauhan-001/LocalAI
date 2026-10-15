import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  GMAIL_CLIENT_ID, 
  GMAIL_CLIENT_SECRET, 
  GMAIL_REDIRECT_URI, 
  GMAIL_TOKENS_FILE 
} from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

let oauth2Client = null;

function getOAuth2Client() {
  if (!oauth2Client && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET) {
    oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    );
  }
  return oauth2Client;
}

const backendRoot = path.join(__dirname, '..', '..');

function getTokensPath() {
  return path.isAbsolute(GMAIL_TOKENS_FILE)
    ? GMAIL_TOKENS_FILE
    : path.resolve(backendRoot, GMAIL_TOKENS_FILE);
}

function ensureTokensDir() {
  const tokensPath = getTokensPath();
  const dir = path.dirname(tokensPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getAuthUrl(state) {
  const client = getOAuth2Client();
  if (!client) {
    throw new Error('Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.');
  }
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent'
  });
}

export async function getTokensFromCode(code) {
  const client = getOAuth2Client();
  if (!client) {
    throw new Error('Gmail OAuth not configured.');
  }
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function setCredentials(tokens) {
  const client = getOAuth2Client();
  if (!client) return false;
  client.setCredentials(tokens);
  return true;
}

export function saveTokens(tokens) {
  ensureTokensDir();
  try {
    fs.writeFileSync(getTokensPath(), JSON.stringify(tokens, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving Gmail tokens:', error.message);
    return false;
  }
}

export function loadTokens() {
  try {
    if (fs.existsSync(getTokensPath())) {
      const data = fs.readFileSync(getTokensPath(), 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading Gmail tokens:', error.message);
  }
  return null;
}

export function clearTokens() {
  try {
    if (fs.existsSync(getTokensPath())) {
      fs.unlinkSync(getTokensPath());
    }
    return true;
  } catch (error) {
    console.error('Error clearing Gmail tokens:', error.message);
    return false;
  }
}

export function isConnected() {
  const tokens = loadTokens();
  if (!tokens || !tokens.access_token) return false;
  const client = getOAuth2Client();
  if (!client) return false;
  client.setCredentials(tokens);
  return !client.isTokenExpiring();
}

export async function getGmailClient() {
  const tokens = loadTokens();
  if (!tokens) return null;
  const client = getOAuth2Client();
  if (!client) return null;
  client.setCredentials(tokens);
  
  if (client.isTokenExpiring()) {
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      saveTokens(credentials);
    } catch (error) {
      console.error('Failed to refresh Gmail token:', error.message);
      return null;
    }
  }
  
  return google.gmail({ version: 'v1', auth: client });
}

export async function listMessages(query = '', maxResults = 20) {
  const gmail = await getGmailClient();
  if (!gmail) return { messages: [], error: 'Gmail not connected' };
  
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    });
    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      return { messages: [], error: null };
    }
    
    // Fetch full message data for each to get headers
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date', 'Message-ID']
          });
          return full.data;
        } catch (e) {
          return msg;
        }
      })
    );
    
    return { messages: fullMessages, error: null };
  } catch (error) {
    console.error('Error listing messages:', error.message);
    return { messages: [], error: error.message };
  }
}

export async function getMessage(messageId) {
  const gmail = await getGmailClient();
  if (!gmail) return { message: null, error: 'Gmail not connected' };
  
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    return { message: response.data, error: null };
  } catch (error) {
    console.error('Error getting message:', error.message);
    return { message: null, error: error.message };
  }
}

export function parseMessage(message) {
  if (!message) return null;
  
  const headers = message.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  const subject = getHeader('Subject');
  const from = getHeader('From');
  const date = getHeader('Date');
  const messageId = getHeader('Message-ID');
  
  let body = '';
  let htmlBody = '';
  
  function extractBody(payload) {
    if (!payload) return;
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType === 'text/html' && payload.body?.data) {
      htmlBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        extractBody(part);
      }
    }
  }
  
  extractBody(message.payload);
  
  return {
    id: message.id,
    threadId: message.threadId,
    subject,
    from,
    date,
    messageId,
    body: body || htmlBody || '',
    snippet: message.snippet || ''
  };
}

export async function searchAndParseMessages(query = '', maxResults = 10) {
  const { messages, error } = await listMessages(query, maxResults);
  if (error) return { messages: [], error };
  
  const parsed = [];
  for (const msg of messages) {
    const { message, error: msgError } = await getMessage(msg.id);
    if (!msgError && message) {
      parsed.push(parseMessage(message));
    }
  }
  
  return { messages: parsed, error: null };
}