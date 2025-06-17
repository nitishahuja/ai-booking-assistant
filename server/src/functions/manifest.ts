// Extend OpenAI's function definition type to include our custom properties
type ExtendedFunctionDefinition = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  say?: string; // Our custom property
};

type ExtendedChatCompletionTool = {
  type: 'function';
  function: ExtendedFunctionDefinition;
};

// create metadata for all the available functions to pass to completions API
const tools: ExtendedChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'normalizeBookingDate',
      say: 'Let me check that date for you.',
      description:
        'Validate and normalize a date string into a consistent format',
      parameters: {
        type: 'object',
        properties: {
          dateStr: {
            type: 'string',
            description: 'The date string to normalize',
          },
        },
        required: ['dateStr'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'validateBookingDetails',
      say: 'Let me validate those booking details.',
      description:
        'Validate all booking details before proceeding with booking',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Full name of the person booking',
          },
          email: {
            type: 'string',
            description: 'Email address for the booking',
          },
          date: {
            type: 'string',
            description: 'Date for the booking in YYYY-MM-DD format',
          },
          time: {
            type: 'string',
            description: 'Time for the booking in HH:mm format (24-hour)',
          },
        },
        required: ['name', 'email', 'date', 'time'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'checkAvailability',
      say: "I'll check if that time slot is available.",
      description: 'Check if a time slot is available in Calendly',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the person booking',
          },
          email: {
            type: 'string',
            description: 'Email address for the booking',
          },
          date: {
            type: 'string',
            description: 'Date for the booking in YYYY-MM-DD format',
          },
          time: {
            type: 'string',
            description: 'Time for the booking in HH:mm format (24-hour)',
          },
        },
        required: ['name', 'email', 'date', 'time'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bookAppointment',
      say: "I'll book that appointment for you now.",
      description:
        'Book the appointment in Calendly after confirming availability',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the person booking',
          },
          email: {
            type: 'string',
            description: 'Email address for the booking',
          },
          date: {
            type: 'string',
            description: 'Date for the booking in YYYY-MM-DD format',
          },
          time: {
            type: 'string',
            description: 'Time for the booking in HH:mm format (24-hour)',
          },
        },
        required: ['name', 'email', 'date', 'time'],
      },
    },
  },
] as const;

// Import all functions included in function manifest
const availableFunctions: { [key: string]: Function } = {
  normalizeBookingDate: require('./dateUtils').normalizeBookingDate,
  validateBookingDetails: require('./validateBooking').validateBookingDetails,
};

export { tools, availableFunctions, ExtendedChatCompletionTool };
