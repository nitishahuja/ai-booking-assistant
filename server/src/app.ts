// src/app.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { GPTService } from './services/GPTService';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
console.log('✅ WebSocket server is running on /ws');

// Store active GPT services
const gptServices = new Map<string, GPTService>();

// Heartbeat interval to keep connections alive
const HEARTBEAT_INTERVAL = 30000;
const CLIENT_TIMEOUT = 35000;

// Extend WebSocket type
type ExtendedWebSocket = WebSocket & { isAlive: boolean };

wss.on('connection', (ws: WebSocket) => {
  const extWs = ws as ExtendedWebSocket;
  console.log('🔌 New client connected');

  // Setup heartbeat
  extWs.isAlive = true;
  ws.on('pong', () => {
    extWs.isAlive = true;
  });

  // Initialize GPT service
  const gptService = new GPTService(ws);
  const clientId = Math.random().toString(36).substring(7);
  gptServices.set(clientId, gptService);

  // Handle GPT service events
  gptService.on('response', (content: string) => {
    ws.send(
      JSON.stringify({
        sender: 'bot',
        text: content,
      })
    );
  });

  gptService.on('error', (error: Error) => {
    console.error('GPT Service error:', error);
    ws.send(
      JSON.stringify({
        sender: 'bot',
        text: `Error: ${error.message}`,
        error: true,
      })
    );
  });

  gptService.initializeSession();

  ws.on('close', () => {
    console.log('Client disconnected:', clientId);
    gptService.handleDisconnect();
    gptServices.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    gptService.handleDisconnect();
    gptServices.delete(clientId);
    try {
      ws.terminate();
    } catch (e) {
      console.error('Error terminating connection:', e);
    }
  });
});

// Heartbeat interval
const interval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    if (extWs.isAlive === false) {
      console.log('Terminating inactive client');
      return ws.terminate();
    }

    extWs.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Cleanup on server shutdown
wss.on('close', () => {
  clearInterval(interval);
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (_req, res) => {
  res.send('🩺 AI Booking Assistant API is up and running!');
});

// Stats route
app.get('/stats', (_req, res) => {
  res.json({
    activeConnections: wss.clients.size,
    activeServices: gptServices.size,
  });
});

export { app, server };
