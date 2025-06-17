import { WebSocket } from 'ws';
import { GPTService } from '../services/GPTService';
import {
  ServerEventType,
  ClientEventType,
  ServerEvents,
  ClientEvents,
  ServerEventPayload,
} from './types';
import { BookingDetails } from '../types/BookingRequest';

export type SessionState =
  | 'idle'
  | 'checking'
  | 'awaiting_confirmation'
  | 'booking'
  | 'completed'
  | 'error';

export class WebSocketManager {
  private sessions = new Map<WebSocket, GPTService>();
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Periodically cleanup inactive sessions
    setInterval(() => this.cleanupInactiveSessions(), this.CLEANUP_INTERVAL);
  }

  public handleConnection(ws: WebSocket): void {
    console.log('🔌 New WebSocket connection established');
    const gptService = new GPTService(ws);
    this.sessions.set(ws, gptService);

    // Initialize the session immediately
    gptService.initializeSession().catch((error) => {
      console.error('Failed to initialize session:', error);
      ws.send(
        JSON.stringify({
          error: 'Failed to initialize session',
          details: error.message,
        })
      );
    });

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        const text = data.text || data.toString();

        await gptService.processMessage(text);
      } catch (error) {
        console.error('❌ Error handling message:', error);
        ws.send(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          })
        );
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      this.cleanupSession(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.cleanupSession(ws);
    });
  }

  private cleanupSession(ws: WebSocket): void {
    const service = this.sessions.get(ws);
    if (service) {
      service.cleanup();
      this.sessions.delete(ws);
    }
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    for (const [ws, service] of this.sessions.entries()) {
      const lastUsed = service.getLastUsed();
      if (now - lastUsed > this.CLEANUP_INTERVAL) {
        console.log('🧹 Cleaning up inactive session');
        this.cleanupSession(ws);
      }
    }
  }

  public getWebSocket(): WebSocket {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public on<T extends ClientEventType>(
    event: T,
    handler: (payload: ClientEvents[T]) => Promise<void>
  ) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  private sendMessage(data: any) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emit<T extends ServerEventType>(event: ServerEventPayload<T>) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emitMessage(text: string) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emitError(message: string) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emitBookingValidationError(errors: string[]) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emitBookingAvailability(
    available: boolean,
    details?: BookingDetails,
    message?: string
  ) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emitBookingConfirmed(success: boolean, message: string) {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public emitFunctionResult(name: string, result: any) {
    // Implementation needed
    throw new Error('Method not implemented');
  }
}
