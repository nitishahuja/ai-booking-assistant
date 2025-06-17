import * as dotenv from 'dotenv';
import { BrowserAgent } from '../agent/stagehandAgent';
import * as calendly from '../platforms/calendly';
import { BookingDetails } from '../types/BookingRequest';

dotenv.config();

async function main() {
  console.log('🚀 Starting Calendly Booking Script');

  // Step 1: Setup static booking details for this run
  const bookingDetails: BookingDetails = {
    name: 'Nitish Ahuja',
    email: 'ahuja.nit@northeastern.edu',
    date: '2025-06-16',
    time: '10:00',
    platform: 'calendly',
  };

  console.log('\n📋 Booking Details:');
  console.log(JSON.stringify(bookingDetails, null, 2));

  const browserAgent = new BrowserAgent();

  try {
    // Step 2: Launch browser and initialize the Stagehand agent
    console.log('\n🧠 Initializing Browser Agent...');
    await browserAgent.initialize();

    // Step 3: Pass the details and platform to the booking function
    console.log('\n🤖 Booking via Calendly...');
    const result = await browserAgent.bookAppointment(bookingDetails, calendly);

    // Step 4: Print the final result
    console.log('\n📊 Booking Result:');
    if (result.success) {
      console.log('✅ Booking Successful!');
      console.log(`ℹ️  ${result.message}`);
    } else {
      console.error('❌ Booking Failed!');
      console.error(`💥 ${result.message}`);
    }
  } catch (error) {
    console.error('❌ Script failed with error:', error);
  } finally {
    // Step 5: Always close browser session to avoid leaks
    await browserAgent.close();
    console.log('🧹 Browser session closed.');
  }
}

main();
