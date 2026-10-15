export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);
  
  if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
    return res.status(499).json({ error: 'Request cancelled.' });
  }
  
  if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
    return res.status(504).json({ error: 'Request timed out.' });
  }
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({ 
      error: 'Cannot connect to Ollama. Please ensure Ollama is running.',
      details: 'Connection refused'
    });
  }
  
  if (err.message?.includes('Ollama returned HTTP')) {
    return res.status(502).json({ 
      error: 'Error from local model.',
      details: err.message
    });
  }
  
  if (err.message?.includes('Gmail OAuth not configured')) {
    return res.status(503).json({ 
      error: 'Gmail integration not configured.',
      details: 'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.'
    });
  }
  
  if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired or revoked')) {
    return res.status(401).json({ 
      error: 'Gmail authorization expired or revoked.',
      details: 'Please reconnect your Gmail account.'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint not found.' });
}