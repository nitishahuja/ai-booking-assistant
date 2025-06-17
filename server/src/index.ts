// src/index.ts
import http from 'http';
import app from './app';
import { initChatSocket } from './routes/chat-ws';

const PORT = process.env.PORT || 3001;

// Create the base HTTP server from the Express app
const server = http.createServer(app);

// Initialize WebSocket server
initChatSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
