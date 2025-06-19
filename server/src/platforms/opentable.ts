import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';
import { EventEmitter } from 'events';

export interface OpenTableResponse {
  success: boolean;
  message?: string;
  needsOTP?: boolean;
  availableTimes?: string[];
  missingFields?: { label: string; required: boolean }[];
  needsMoreInfo?: boolean;
  isReadyToConfirm?: boolean;
  selectedTime?: string;
  error?: string;
}

/**
 * Phase 1: Check availability and select slot (but don't confirm)
 */
export async function checkAvailability(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<OpenTableResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Phase 1: Checking OpenTable availability...');
    await page.goto('https://www.opentable.com/r/cafe-dalsace-new-york', {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    const agent = stagehand.agent();

    // Execute but stop before final confirmation
    const response = await agent.execute(`
      1. Find the form which says "Make a reservation" and fill it out:
         - Find and click the party size dropdown
         - Select "${bookingDetails.partySize || 4}" guests
         - Find and click the date dropdown
         - Set the date to "${bookingDetails.date}"
         - Find and click the time dropdown
         - Set the time to "${bookingDetails.time}"
      2. On the same form, you will see a list of available time slots under "Select a time"
         - Look for available time slots near "${bookingDetails.time}"
         - If you find times, return them in this format:
           AVAILABLE_TIMES: "5:00 PM, 5:30 PM, 6:00 PM"
         - If no times are available, return:
           NO_AVAILABILITY: "No tables available at this time. Here are other available times: [list times]"
    `);

    console.log('✅ Phase 1 completed: Available times checked');
    console.log('📝 Agent response:', JSON.stringify(response, null, 2));

    // Parse the response to get available times
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response);

    // Check for no availability
    const noAvailMatch = responseStr.match(/NO_AVAILABILITY:\s*"([^"]*)"/);
    if (noAvailMatch) {
      return {
        success: false,
        message: noAvailMatch[1],
      };
    }

    // Extract available times
    const timesMatch = responseStr.match(/AVAILABLE_TIMES:\s*"([^"]*)"/);
    const availableTimes = timesMatch
      ? timesMatch[1].split(',').map((t) => t.trim())
      : [];

    // Take a screenshot of the available times
    try {
      await page.screenshot({ path: `opentable-times-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take times screenshot:', e);
    }

    // Find the closest time to requested time
    let selectedTime = null;
    if (availableTimes.length > 0 && bookingDetails.time) {
      const requestedTime = bookingDetails.time;
      selectedTime = availableTimes.reduce((closest, current) => {
        if (!closest) return current;
        const closestDiff = Math.abs(
          new Date('1970/01/01 ' + closest).getTime() -
            new Date('1970/01/01 ' + requestedTime).getTime()
        );
        const currentDiff = Math.abs(
          new Date('1970/01/01 ' + current).getTime() -
            new Date('1970/01/01 ' + requestedTime).getTime()
        );
        return currentDiff < closestDiff ? current : closest;
      });
    }

    return {
      success: true,
      message: `Available times found: ${availableTimes.join(', ')}`,
      availableTimes,
      isReadyToConfirm: true,
      selectedTime: selectedTime || availableTimes[0],
    };
  } catch (err: any) {
    console.error('❌ Error in availability check:', err);
    return {
      success: false,
      message: err.message || 'Failed to check availability',
    };
  }
}

/**
 * Phase 2: Complete booking from existing form state
 */
export async function bookAppointment(
  stagehand: Stagehand,
  bookingDetails: BookingDetails,
  otpEmitter: EventEmitter
): Promise<OpenTableResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Phase 2: Completing OpenTable booking...');

    const agent = stagehand.agent();

    // First fill out the initial form
    const fillResponse = await agent.execute(`
      I have these booking details:
      ${JSON.stringify(bookingDetails, null, 2)}

      1. Click on the time slot link under "Select a time"
      2. Fill out the phone number field
      3. Fill out any booking notes if provided
      4. Click through any confirmation or "Complete Reservation" buttons
      5. When you reach the verification/OTP page, return:
         NEEDS_OTP: true
      6. If you don't reach the OTP page, return:
         NO_OTP: true

      Note: Stay on the page after reaching the OTP screen.
    `);

    // Ensure we have a string to work with
    const fillStr =
      typeof fillResponse === 'string'
        ? fillResponse
        : JSON.stringify(fillResponse);

    // Check if we need OTP
    if (fillStr.includes('NEEDS_OTP')) {
      console.log('🔐 Waiting for OTP...');
      return {
        success: false,
        needsOTP: true,
        isReadyToConfirm: false,
      };
    }

    // If we didn't need OTP (shouldn't happen with OpenTable)
    return {
      success: false,
      needsOTP: false,
      isReadyToConfirm: false,
      error: 'Unexpected booking flow - OTP was not requested',
    };
  } catch (error: any) {
    console.error('❌ Error during booking:', error);

    // Take error screenshot
    try {
      await page.screenshot({ path: `opentable-error-${Date.now()}.png` });
    } catch (e) {
      console.error('Failed to take error screenshot:', e);
    }

    return {
      success: false,
      needsOTP: false,
      error: error.message || error,
      isReadyToConfirm: false,
    };
  }
}

export async function submitOTP(
  stagehand: Stagehand,
  bookingDetails: BookingDetails,
  otp: string
): Promise<OpenTableResponse> {
  const { page } = stagehand;
  const agent = stagehand.agent();

  try {
    console.log('📱 Submitting OTP and completing booking...');

    // First try with the agent
    const confirmResponse = await agent.execute(`
      I have these booking details:
      ${JSON.stringify(bookingDetails, null, 2)}

      1. Look for the OTP input field in the verification modal
      2. If you can interact with it:
         - Enter this OTP code: "${otp}"
         - Click the submit or verify button
         - Return: AGENT_SUCCESS
      3. If you cannot interact with the input:
         Return: NEED_DIRECT_INPUT

      Note: Stay on the page regardless of the outcome.
    `);

    const confirmStr =
      typeof confirmResponse === 'string'
        ? confirmResponse
        : JSON.stringify(confirmResponse);

    // If agent couldn't handle it, try direct selectors
    if (confirmStr.includes('NEED_DIRECT_INPUT')) {
      console.log('🔄 Falling back to direct input...');

      // Known OpenTable OTP input selector
      const otpInput = await page.$('[data-test="verification-code-input"]');
      if (otpInput) {
        await otpInput.fill(otp);
      } else {
        // Fallback selectors if the known one isn't found
        const selectors = [
          '#emailVerificationCode',
          'input[inputmode="numeric"]',
          'input[placeholder="Enter verification code"]',
          'input[type="text"]',
          'input[type="number"]',
          'input[placeholder*="verification"]',
          'input[placeholder*="code"]',
          'input[aria-label*="verification"]',
          'input[aria-label*="code"]',
        ];

        // Try each selector until we find one that works
        for (const selector of selectors) {
          const input = await page.$(selector);
          if (input) {
            await input.fill(otp);
            break;
          }
        }
      }

      // Common selectors for submit button
      const buttonSelectors = [
        '[data-test="verify-code-button"]',
        'button[type="submit"]',
        'button:has-text("Verify")',
        'button:has-text("Submit")',
        'button:has-text("Confirm")',
      ];

      // Try each button selector
      for (const selector of buttonSelectors) {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          break;
        }
      }

      // Wait for confirmation
      await page.waitForTimeout(2000); // Give it time to process
    }

    // Check for success or error
    const successSelectors = [
      '[data-test="confirmation-page"]',
      'text="Reservation confirmed"',
      'text="Booking confirmed"',
    ];

    const errorSelectors = [
      '[data-test="error-message"]',
      '#emailVerificationCode-error',
      'text="Invalid code"',
      'text="Verification failed"',
    ];

    // Take a screenshot for debugging
    try {
      await page.screenshot({
        path: `opentable-confirmation-${Date.now()}.png`,
      });
    } catch (e) {
      console.error('Failed to take confirmation screenshot:', e);
    }

    // Check for errors
    for (const selector of errorSelectors) {
      const errorElement = await page.$(selector);
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(errorText || 'Failed to confirm booking');
      }
    }

    // Check for success
    let isSuccess = false;
    for (const selector of successSelectors) {
      const successElement = await page.$(selector);
      if (successElement) {
        isSuccess = true;
        break;
      }
    }

    if (!isSuccess) {
      // If no clear success/error, let the agent check the final state
      const finalCheck = await agent.execute(`
        Check the current page state:
        1. If you see any confirmation or success message:
           Return: BOOKING_CONFIRMED
        2. If you see any error message:
           Return: BOOKING_ERROR: "error message"
        3. If you can't determine the state:
           Return: BOOKING_UNKNOWN
      `);

      const finalCheckStr =
        typeof finalCheck === 'string'
          ? finalCheck
          : JSON.stringify(finalCheck);

      if (finalCheckStr.includes('BOOKING_ERROR')) {
        const errorMatch = finalCheckStr.match(/BOOKING_ERROR:\s*"([^"]*)"/);
        throw new Error(
          errorMatch ? errorMatch[1] : 'Failed to confirm booking'
        );
      } else if (!finalCheckStr.includes('BOOKING_CONFIRMED')) {
        throw new Error('Could not determine if booking was successful');
      }
    }

    return {
      success: true,
      needsOTP: false,
      isReadyToConfirm: true,
    };
  } catch (error: any) {
    console.error('❌ Error during OTP submission:', error);

    // Take error screenshot
    try {
      await page.screenshot({
        path: `opentable-error-${Date.now()}.png`,
      });
    } catch (e) {
      console.error('Failed to take error screenshot:', e);
    }

    return {
      success: false,
      needsOTP: false,
      error: error.message || error,
      isReadyToConfirm: false,
    };
  }
}
