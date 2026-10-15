import app from './app.js';
import { PORT, FRONTEND_URL, OLLAMA_MODEL, OLLAMA_BASE_URL } from './config/index.js';

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Ollama: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
});

export default app;
