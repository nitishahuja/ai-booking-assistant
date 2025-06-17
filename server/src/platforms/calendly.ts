import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';

let bookingLink: string | null = null;
let selectedTime: string | null = null;

/**
 * Step 1: Check availability using LLM, extract actual time + booking URL
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

    const result = await agent.execute(`
      1. Go to the date "${bookingDetails.date}" on the Calendly calendar.
      2. Find a time slot near "${bookingDetails.time}".
      3. If a slot is available, click/select it.
      4. After the time slot is selected, extract the actual time shown.
      5. Provide the current URL and the selected time as a JSON object like:
         {"time": "11:30 AM", "url": "<booking page URL>"}
    `);

    const output = typeof result === 'string' ? JSON.parse(result) : result;
    selectedTime = output.time;
    bookingLink = output.url;

    console.log(`✅ Found slot: ${selectedTime}, link: ${bookingLink}`);
    return true;
  } catch (err) {
    console.error('❌ Error in LLM-based availability check:', err);
    return false;
  }
}

/**
 * Step 2: Book the appointment via direct link and return confirmed time
 */
export async function bookAppointment(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<{ success: boolean; message: string }> {
  const { page } = stagehand;

  try {
    console.log('📅 Booking confirmed slot via Calendly...');

    if (!bookingLink) {
      throw new Error(
        'No booking link found. Please run checkAvailability first.'
      );
    }

    await page.goto(bookingLink, {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    const agent = stagehand.agent();

    await agent.execute(`
      1. Wait for the form to appear.
      2. Enter the name: "${bookingDetails.name}".
      3. Enter the email: "${bookingDetails.email}".
      4. Submit the form to confirm the booking.
      5. Wait for confirmation message or thank you screen.
    `);

    await page.waitForSelector('text=/scheduled|confirmed|thank you/i', {
      timeout: 15000,
    });

    const finalUrl = page.url();

    return {
      success: true,
      message: `✅ Booking confirmed for ${
        selectedTime || bookingDetails.time
      } on ${bookingDetails.date}. Confirmation link: ${finalUrl}`,
    };
  } catch (error: any) {
    console.error('❌ Error during booking:', error);
    await page.screenshot({ path: `calendly-booking-error-${Date.now()}.png` });

    return {
      success: false,
      message: `Booking failed: ${error.message || error}`,
    };
  }
}
