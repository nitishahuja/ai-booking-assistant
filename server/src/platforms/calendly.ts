// src/platforms/calendly.ts
import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';

export interface CalendlyResponse {
  success: boolean;
  message?: string;
  requestedTime: string;
  selectedTime?: string;
  isReadyToConfirm?: boolean;
  missingFields?: { label: string; required: boolean }[];
  needsOTP?: boolean;
  error?: string;
}

/**
 * Phase 1: Check availability and select slot (but don't confirm)
 */
export async function checkAvailability(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<CalendlyResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Phase 1: Checking availability and selecting slot...');
    await page.goto('https://calendly.com/aadhrik-myaifrontdesk/30min', {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    const agent = stagehand.agent();

    // Execute but stop before final confirmation
    const response = await agent.execute(`
      1. Open the calendar on the page.
      2. Go to the date "${bookingDetails.date} and if the date is not available then return all available nearest dates".
      3. Check all available time slots around "${bookingDetails.time}".
      5. Return all available times.
    `);

    console.log('✅ Phase 1 completed: Slot selected and form ready');
    console.log('📝 Agent response:', JSON.stringify(response, null, 2));

    // Parse the response to get available times and selected slot
    let parsedResponse;
    let selectedTime;
    try {
      if (typeof response === 'string') {
        const responseObj = JSON.parse(response);
        parsedResponse = responseObj.answer;
      } else if (response && typeof response === 'object') {
        parsedResponse = response.message || JSON.stringify(response);
      } else {
        parsedResponse = String(response);
      }

      // Try to extract the selected time from the response
      const timeMatch = parsedResponse.match(
        /selected.*?(\d{1,2}:\d{2}\s*(?:am|pm))/i
      );
      if (timeMatch) {
        selectedTime = timeMatch[1].toLowerCase().replace(/\s+/g, '');
      }
    } catch (e) {
      console.log('⚠️ Error parsing response:', e);
      parsedResponse = String(response);
    }

    // Take a screenshot of the form state
    try {
      await page.screenshot({ path: `slot-selected-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take form screenshot:', e);
    }

    return {
      success: true,
      message: parsedResponse,
      requestedTime: bookingDetails.time,
      selectedTime,
      isReadyToConfirm: true,
    };
  } catch (err: any) {
    console.error('❌ Error in availability check:', err);
    return {
      success: false,
      message: err.message || 'Failed to check availability',
      requestedTime: bookingDetails.time,
    };
  }
}

/**
 * Phase 2: Complete booking from existing form state
 */
export async function bookAppointment(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<CalendlyResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Phase 2: Completing booking from existing form...');

    // The form should already be open from Phase 1
    // Just fill in details and confirm
    const agent = stagehand.agent();
    const response = await agent.execute(`
      1. The booking form should already be open.
      2. Finally select the time slot "${bookingDetails.time}".
      3. click on the time slot "${bookingDetails.time}".
      4. It should open the confirmation page.
      5. Look at ALL form fields (both required and optional) and their current state.
         - Enter the name: "${bookingDetails.name}"
         - Enter the email: "${bookingDetails.email}"
         - Click the "Schedule Event" button
         - Wait for confirmation
    `);

    // Check for missing fields in the response
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response);
    const fieldMatches = responseStr.match(
      /FIELD:\s*"([^"]+)"\s*\nREQUIRED:\s*(yes|no)/gi
    );

    if (fieldMatches) {
      const missingFields = fieldMatches.map((match) => {
        const fieldMatch = match.match(/FIELD:\s*"([^"]+)"/i);
        const requiredMatch = match.match(/REQUIRED:\s*(yes|no)/i);
        return {
          label: fieldMatch?.[1] || '',
          required: requiredMatch?.[1].toLowerCase() === 'yes',
        };
      });

      return {
        success: false,
        message: 'Additional fields needed',
        requestedTime: bookingDetails.time,
        missingFields,
      };
    }

    console.log('✅ Phase 2 completed: Booking confirmed');

    // Take a screenshot of the confirmation
    try {
      await page.screenshot({ path: `booking-confirmed-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take confirmation screenshot:', e);
    }

    // Try to extract confirmation time from the page
    let confirmedTime = bookingDetails.time;
    try {
      const confirmationText = await page.textContent('body');
      const timeMatch = confirmationText?.match(
        /(?:scheduled|confirmed|booked).*?(\d{1,2}:\d{2}\s*[AaPp][Mm])/i
      );
      if (timeMatch) {
        confirmedTime = timeMatch[1];
      }
    } catch (e) {
      console.error('Failed to extract confirmation time:', e);
    }

    return {
      success: true,
      message: `Successfully booked for ${bookingDetails.date} at ${confirmedTime}`,
      requestedTime: bookingDetails.time,
    };
  } catch (error: any) {
    console.error('❌ Error during booking:', error);

    // Take error screenshot
    try {
      await page.screenshot({ path: `booking-error-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take error screenshot:', e);
    }

    return {
      success: false,
      message: `Booking failed: ${error.message || error}`,
      requestedTime: bookingDetails.time,
    };
  }
}
