// src/platforms/calendly.ts
import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';

/**
 * Step 1: Check availability using pure LLM reasoning
 */
export async function checkAvailability(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<boolean> {
  const { page } = stagehand;

  try {
    console.log('🤖 Asking LLM to check availability...');
    await page.goto('https://calendly.com/aadhrik-myaifrontdesk/30min', {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    const agent = stagehand.agent();

    await agent.execute(`
      1. Open the calendar on the page.
      2. Go to the date "${bookingDetails.date}".
      3. Check if there is a time slot around "${bookingDetails.time}".
      4. If yes, select that time slot.
    `);

    console.log('✅ LLM agent executed availability logic.');
    return true; // trusting agent's flow for now
  } catch (err) {
    console.error('❌ Error in LLM-based availability check:', err);
    return false;
  }
}

/**
 * Step 2: Book appointment using pure LLM interaction
 */
export async function bookAppointment(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<{ success: boolean; message: string }> {
  const { page } = stagehand;

  try {
    console.log('📅 Booking confirmed slot via Calendly...');
    await page.goto('https://calendly.com/aadhrik-myaifrontdesk/30min', {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    const agent = stagehand.agent();
    // After the agent executes the booking
    await agent.execute(`
  1. Open the calendar and go to the date "${bookingDetails.date}".
  2. Select the time slot closest to "${bookingDetails.time}".
  3. Wait for the form asking for name and email to load.
  4. Enter the name: "${bookingDetails.name}".
  5. Enter the email: "${bookingDetails.email}".
  6. Click the "Schedule Event" or equivalent confirmation button.
  7. Wait until you see a confirmation message or success screen.
`);

    // Try to extract confirmation time text from the final screen
    const confirmedText = await page.textContent('body');

    // Fallback if we can’t extract exact time
    let confirmedTime = 'the selected time';
    const match = confirmedText?.match(
      /(?:at|for)\s+(\d{1,2}:\d{2}\s?[apAP][mM])/
    );
    if (match && match[1]) {
      confirmedTime = match[1];
    }

    console.log('✅ Booking flow executed by LLM agent');
    return {
      success: true,
      message: `Scheduled on ${bookingDetails.date} at ${bookingDetails.time}`,
    };
  } catch (error: any) {
    console.error('❌ Error during booking:', error);
    await page.screenshot({
      path: `calendly-booking-error-${Date.now()}.png`,
    });

    return {
      success: false,
      message: `Booking failed: ${error.message || error}`,
    };
  }
}
