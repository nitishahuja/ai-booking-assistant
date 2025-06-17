import WebSocket from 'ws';
import {
  ServerEventType,
  ClientEventType,
  ServerEvents,
  ClientEvents,
  ServerEventPayload,
} from './types';
import { BookingDetails } from '../types/BookingRequest';

export class WebSocketManager {
  protected ws: WebSocket;
  private eventHandlers: Map<
    ClientEventType,
    ((payload: any) => Promise<void>)[]
  >;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.eventHandlers = new Map();
    this.setupMessageHandler();
  }

  public getWebSocket(): WebSocket {
    return this.ws;
  }

  private setupMessageHandler() {
    this.ws.on('message', async (data: string) => {
      try {
        console.log('📩 Received raw message:', data.toString());

        // Try to parse as JSON first
        let event;
        try {
          event = JSON.parse(data.toString());
          console.log('📨 Parsed as JSON:', event);
        } catch (e) {
          // If not JSON, treat as plain text message
          event = {
            type: ClientEventType.MESSAGE,
            payload: { text: data.toString() },
          };
          console.log('📝 Treating as plain text message:', event);
        }

        // Validate event structure
        if (
          !event.type ||
          !Object.values(ClientEventType).includes(event.type)
        ) {
          // If no valid type, treat as plain message
          event = {
            type: ClientEventType.MESSAGE,
            payload: { text: data.toString() },
          };
        }

        const handlers = this.eventHandlers.get(event.type as ClientEventType);
        if (handlers) {
          for (const handler of handlers) {
            await handler(event.payload);
          }
        }
      } catch (err) {
        console.error('❌ Error handling message:', err);
        this.emitError('Failed to process message');
      }
    });

    // Add connection error handler
    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  }

  public on<T extends ClientEventType>(
    event: T,
    handler: (payload: ClientEvents[T]) => Promise<void>
  ) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  private sendMessage(data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      console.log('📤 Sending message:', message);
      this.ws.send(message);
    } else {
      console.warn('⚠️ WebSocket not open, message not sent');
    }
  }

  public emit<T extends ServerEventType>(event: ServerEventPayload<T>) {
    this.sendMessage(event);
  }

  public emitMessage(text: string) {
    // For compatibility with existing clients, send simple format
    this.sendMessage({
      sender: 'bot',
      text: text,
    });
  }

  public emitError(message: string) {
    this.sendMessage({
      sender: 'bot',
      text: `Error: ${message}`,
      error: true,
    });
  }

  public emitBookingValidationError(errors: string[]) {
    this.sendMessage({
      sender: 'bot',
      text: `Validation errors:\n${errors.join('\n')}`,
      error: true,
    });
  }

  public emitBookingAvailability(
    available: boolean,
    details?: BookingDetails,
    message?: string
  ) {
    this.sendMessage({
      sender: 'bot',
      text:
        message ||
        (available
          ? `That time is available! Should I confirm this?`
          : 'Sorry, that time appears to be unavailable. Could you please suggest a different time?'),
      bookingDetails: details,
    });
  }

  public emitBookingConfirmed(success: boolean, message: string) {
    this.sendMessage({
      sender: 'bot',
      text: message,
      success: success,
    });
  }

  public emitFunctionResult(name: string, result: any) {
    this.sendMessage({
      sender: 'bot',
      text: `Function ${name} result: ${JSON.stringify(result)}`,
      functionResult: { name, result },
    });
  }
}
