import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';

export interface HousecallProResponse {
  success: boolean;
  message: string;
  missingFields?: { label: string; required: boolean }[];
  needsMoreInfo?: boolean;
}

/**
 * Phase 2: Complete booking process
 */
export async function bookAppointment(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<HousecallProResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Starting Housecall Pro booking...');
    console.log(
      '📝 Initial booking details:',
      JSON.stringify(bookingDetails, null, 2)
    );

    await page.goto(
      'https://book.housecallpro.com/book/My-AI-Frontdesk/ff43037256a44791816647e0e5e9f2cd?v2=true',
      {
        timeout: 45000,
        waitUntil: 'domcontentloaded',
      }
    );

    const agent = stagehand.agent();

    // First, let the agent analyze the form and our current information
    const analysisResponse = await agent.execute(`
      1. Analyze the booking details:
         ${JSON.stringify(bookingDetails, null, 2)}

      2. Look at the form and all available services
      3. Based on the service information:
         - Category: "${bookingDetails.serviceCategory || ''}"
         - Type: "${bookingDetails.serviceType || ''}"
         - Details: "${bookingDetails.serviceDetails || ''}"
         
         Find and select the most appropriate service.
         If unsure, return:
         NEEDS_CLARIFICATION: "specific question about the service"

      4. After selecting the service, look at ALL form fields
      5. Compare available fields with our booking details
      6. For any missing required information, return:
         MISSING_FIELD: "field name"
         DESCRIPTION: "what information is needed"
         REQUIRED: yes/no

      7. If all required fields are present, return:
         READY_TO_FILL
    `);

    const analysisStr =
      typeof analysisResponse === 'string'
        ? analysisResponse
        : JSON.stringify(analysisResponse);

    // Check if we need service clarification
    const clarificationMatch = analysisStr.match(
      /NEEDS_CLARIFICATION:\s*"([^"]*)"/
    );
    if (clarificationMatch) {
      return {
        success: false,
        needsMoreInfo: true,
        message: clarificationMatch[1],
        missingFields: [
          {
            label: 'Service Details',
            required: true,
          },
        ],
      };
    }

    // Check for missing fields
    const missingFieldsMatches = analysisStr.matchAll(
      /MISSING_FIELD:\s*"([^"]*)"\nDESCRIPTION:\s*"([^"]*)"\nREQUIRED:\s*(yes|no)/g
    );
    const missingFields = Array.from(missingFieldsMatches).map((match) => ({
      label: match[1],
      description: match[2],
      required: match[3].toLowerCase() === 'yes',
    }));

    if (missingFields.length > 0) {
      return {
        success: false,
        needsMoreInfo: true,
        message: 'Additional information needed',
        missingFields: missingFields.map((field) => ({
          label: `${field.label}: ${field.description}`,
          required: field.required,
        })),
      };
    }

    // If we have all needed information, proceed with filling the form
    const fillResponse = await agent.execute(`
      1. I have these booking details:
         ${JSON.stringify(bookingDetails, null, 2)}

      2. Fill out the form intelligently:
         - Use the full name to determine first/last name fields
         - Format the phone number appropriately
         - Break down the address into its components if needed
         - Use service details to fill any service-specific fields
         - Handle any custom fields based on the context

      3. Before submitting:
         - Review all filled information
         - Make sure required fields are filled
         - Verify the selected service matches the request
         - Look for the confirmation message that starts with "I'll process your service request now."
         - Verify that the details shown match what we submitted
         - Click the book my appointment button to confirm

      4. If you find any problems or details don't match, return:
         FILL_ERROR: "description of the problem"

      5. If everything looks correct:
         - Click the final booking/confirmation button
         - Wait for the confirmation page to load
         - Look for "Thank you" and "Your booking was successful. We'll send you an email confirmation."
    `);

    const fillStr =
      typeof fillResponse === 'string'
        ? fillResponse
        : JSON.stringify(fillResponse);
    const fillErrorMatch = fillStr.match(/FILL_ERROR:\s*"([^"]*)"/);

    if (fillErrorMatch) {
      return {
        success: false,
        message: fillErrorMatch[1],
        needsMoreInfo: true,
      };
    }

    // Take a screenshot of the confirmation
    try {
      await page.screenshot({ path: `hcp-confirmation-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take confirmation screenshot:', e);
    }

    // Verify the booking was successful
    const confirmResponse = await agent.execute(`
      1. Look for the text "Thank you" and "Your booking was successful. We'll send you an email confirmation."
      2. If you don't see this exact success message, return:
         BOOKING_ERROR: "Could not find final success confirmation message"
      3. If you see the success message, verify one last time that all details are correct:
         - Service type
         - Customer information
      4. If anything doesn't match, return:
         BOOKING_ERROR: "what doesn't match"
      5. If all good, return:
         BOOKING_CONFIRMED
    `);

    const confirmStr =
      typeof confirmResponse === 'string'
        ? confirmResponse
        : JSON.stringify(confirmResponse);
    if (confirmStr.includes('BOOKING_ERROR')) {
      const errorMatch = confirmStr.match(/BOOKING_ERROR:\s*"([^"]*)"/);
      throw new Error(
        errorMatch ? errorMatch[1] : 'Booking details mismatch in confirmation'
      );
    }

    return {
      success: true,
      message: 'Booking confirmed successfully',
    };
  } catch (error: any) {
    console.error('❌ Error during booking:', error);

    // Take error screenshot
    try {
      await page.screenshot({ path: `hcp-error-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take error screenshot:', e);
    }

    return {
      success: false,
      message: `Booking failed: ${error.message || error}`,
    };
  }
}
