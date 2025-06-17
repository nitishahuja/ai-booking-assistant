import { BookingDetails } from '../types/BookingRequest';

// Server -> Client Events
export enum ServerEventType {
  WELCOME = 'welcome',
  MESSAGE = 'message',
  BOOKING_VALIDATION_ERROR = 'booking_validation_error',
  BOOKING_AVAILABILITY = 'booking_availability',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_ERROR = 'booking_error',
  FUNCTION_RESULT = 'function_result',
  ERROR = 'error',
}

// Client -> Server Events
export enum ClientEventType {
  MESSAGE = 'message',
  CONFIRM_BOOKING = 'confirm_booking',
  CANCEL_BOOKING = 'cancel_booking',
}

// Event Payloads
export interface ServerEvents {
  [ServerEventType.WELCOME]: {
    message: string;
  };
  [ServerEventType.MESSAGE]: {
    text: string;
  };
  [ServerEventType.BOOKING_VALIDATION_ERROR]: {
    errors: string[];
  };
  [ServerEventType.BOOKING_AVAILABILITY]: {
    available: boolean;
    details?: BookingDetails;
    message: string;
  };
  [ServerEventType.BOOKING_CONFIRMED]: {
    success: boolean;
    message: string;
  };
  [ServerEventType.BOOKING_ERROR]: {
    message: string;
  };
  [ServerEventType.FUNCTION_RESULT]: {
    name: string;
    result: any;
  };
  [ServerEventType.ERROR]: {
    message: string;
  };
}

export interface ClientEvents {
  [ClientEventType.MESSAGE]: {
    text: string;
  };
  [ClientEventType.CONFIRM_BOOKING]: {
    confirm: boolean;
  };
  [ClientEventType.CANCEL_BOOKING]: void;
}

// Helper type for emitting events
export type ServerEventPayload<T extends ServerEventType> = {
  type: T;
  payload: ServerEvents[T];
};

export type ClientEventPayload<T extends ClientEventType> = {
  type: T;
  payload: ClientEvents[T];
};
