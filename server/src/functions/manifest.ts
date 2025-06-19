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
          platform: {
            type: 'string',
            enum: ['calendly', 'housecallpro'],
            description: 'The booking platform to use',
          },
        },
        required: ['name', 'email', 'date', 'time', 'platform'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'checkAvailability',
      say: "I'll check if that time slot is available.",
      description:
        'Check if a time slot is available on the selected platform. For Housecall Pro, this will also list available services if needed.',
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
          platform: {
            type: 'string',
            enum: ['calendly', 'housecallpro'],
            description: 'The booking platform to use',
          },
          service: {
            type: 'string',
            description: 'Service type (required for Housecall Pro)',
          },
        },
        required: ['name', 'email', 'date', 'time', 'platform'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bookAppointment',
      say: "I'll process your service request now.",
      description: 'Book the appointment on the selected platform.',
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
          platform: {
            type: 'string',
            enum: ['calendly', 'housecallpro'],
            description: 'The booking platform to use',
          },
          // Optional parameters based on platform
          date: {
            type: 'string',
            description:
              'Date for the booking in YYYY-MM-DD format (required for Calendly)',
          },
          time: {
            type: 'string',
            description:
              'Time for the booking in HH:mm format (24-hour) (required for Calendly)',
          },
          serviceCategory: {
            type: 'string',
            description:
              'Service category (e.g., Plumbing, Appliances) for Housecall Pro',
          },
          serviceType: {
            type: 'string',
            description:
              'Specific service type (e.g., Leak Detection, Drain Cleaning) for Housecall Pro',
          },
          serviceDetails: {
            type: 'string',
            description:
              'Additional details about the service/equipment for Housecall Pro',
          },
          phone: {
            type: 'string',
            description: 'Phone number (required for Housecall Pro)',
          },
          address: {
            type: 'string',
            description: 'Service address (required for Housecall Pro)',
          },
          customFields: {
            type: 'object',
            description: 'Any additional custom fields required by the form',
            additionalProperties: true,
          },
        },
        required: ['name', 'email', 'platform'],
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
