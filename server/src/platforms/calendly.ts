// src/platforms/calendly.ts
import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';
import axios from 'axios';
import { normalizeBookingDate } from '../functions/dateUtils';

// Configuration for Calendly
const CALENDLY_CONFIG = {
  EVENT_TYPE_UUID: 'd6ff74c5-133f-4e39-a6ba-889b59d00293',
  SCHEDULING_LINK: 'cq8c-xxx-t9m',
  EVENT_URL: 'https://calendly.com/aadhrik-myaifrontdesk/30min',
};

export interface CalendlyResponse {
  success: boolean;
  message?: string;
  requestedTime: string;
  selectedTime?: string;
  isReadyToConfirm?: boolean;
  availableSlots?: string[];
  missingFields?: { label: string; required: boolean }[];
  needsOTP?: boolean;
  error?: string;
}

interface TimeSlot {
  time: Date;
  formatted: string;
  raw: string;
  date: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening'; // Add timeOfDay field with specific values
}

interface CalendlySlot {
  start_time: string;
  status: 'available' | 'unavailable';
}

interface CalendlyDay {
  date: string;
  status: 'available' | 'unavailable';
  spots: {
    start_time: string;
    status: string;
  }[];
  invitee_events: any[];
}

interface CalendlyAPIResponse {
  invitee_publisher_error: boolean;
  today: string;
  availability_timezone: string;
  days: CalendlyDay[];
  diagnostic_data: any;
  current_user: {
    id: string | null;
    email: string | null;
    locale: string | null;
    date_notation: string | null;
    time_notation: string | null;
    avatar_url: string | null;
    is_pretending: boolean;
    diagnostics: {
      available: boolean;
      enabled: boolean;
    };
  };
}

interface CalendlyAPIError {
  name: string;
  message: string;
  response?: {
    status?: number;
    statusText?: string;
  };
}

/**
 * Get available time slots from Calendly API
 */
const getAvailableSlots = async (date: string, time: string) => {
  try {
    // Convert date to required format and calculate range
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7); // Get a week's worth of slots

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log('🔍 Fetching slots for range:', {
      formattedStartDate,
      formattedEndDate,
    });

    // Make API call to get available slots
    const response = await axios.get(
      `https://calendly.com/api/booking/event_types/${CALENDLY_CONFIG.EVENT_TYPE_UUID}/calendar/range`,
      {
        params: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          diagnostics: false,
          range_start: formattedStartDate,
          range_end: formattedEndDate,
          scheduling_link_uuid: CALENDLY_CONFIG.SCHEDULING_LINK,
        },
      }
    );

    // Log the raw response structure with spot details
    console.log('📦 Raw API response structure:', {
      hasData: !!response.data,
      hasDays: !!response.data?.days,
      daysCount: response.data?.days?.length,
      firstDay: response.data?.days?.[0]
        ? {
            date: response.data.days[0].date,
            status: response.data.days[0].status,
            hasSpots: !!response.data.days[0].spots,
            spotsCount: response.data.days[0].spots?.length,
            firstSpot: response.data.days[0].spots?.[0],
          }
        : null,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    const apiError = error as CalendlyAPIError;
    console.error('❌ API Error details:', {
      name: apiError.name,
      message: apiError.message,
      status: apiError.response?.status,
      statusText: apiError.response?.statusText,
    });
    throw error;
  }
};

/**
 * Format a Calendly time slot
 */
function formatCalendlySpot(spot: {
  start_time: string;
  status: string;
}): TimeSlot | null {
  if (spot.status !== 'available') return null;

  // Calendly spots come in ISO format, parse them correctly
  const date = new Date(spot.start_time);
  if (isNaN(date.getTime())) return null;

  const hour = date.getHours();
  return {
    time: date,
    formatted: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    raw: spot.start_time,
    date: date.toISOString().split('T')[0],
    timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
  };
}

/**
 * Check availability using API first, fallback to agent if API fails
 */
export async function checkAvailability(
  stagehand: Stagehand | null,
  bookingDetails: BookingDetails
): Promise<CalendlyResponse> {
  try {
    console.log('🔍 Checking availability via Calendly API...');
    const apiResponse = await getAvailableSlots(
      bookingDetails.date,
      bookingDetails.time || '' // Make time optional
    );

    // Log the API response structure
    console.log('📦 Processing API response:', {
      hasData: !!apiResponse.data,
      hasDays: !!apiResponse.data?.days,
      daysCount: apiResponse.data?.days?.length,
    });

    // Validate API response format
    if (!apiResponse.data || !Array.isArray(apiResponse.data.days)) {
      console.error('❌ Invalid API response format:', apiResponse);
      return {
        success: false,
        message: 'Unable to fetch availability. Please try again.',
        requestedTime: bookingDetails.time,
        error: 'Invalid API response format',
      };
    }

    const { days } = apiResponse.data;

    // Log available days
    console.log(
      '📅 Available days:',
      days.map((day: CalendlyDay) => ({
        date: day.date,
        status: day.status,
        spotsCount: day.spots?.length || 0,
      }))
    );

    // No available days
    if (days.length === 0) {
      return {
        success: false,
        message: 'No available dates found. Please try a different date range.',
        requestedTime: bookingDetails.time,
      };
    }

    // Collect all available spots across days
    const allSlots = days.reduce((slots: TimeSlot[], day: CalendlyDay) => {
      if (day.status === 'available' && Array.isArray(day.spots)) {
        // Convert spots to our TimeSlot format and filter only available ones
        const daySlots = day.spots
          .filter((spot) => spot.status === 'available')
          .map((spot) => {
            const date = new Date(spot.start_time);
            if (isNaN(date.getTime())) return null;
            const hour = date.getHours();
            return {
              time: date,
              formatted: date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }),
              raw: spot.start_time,
              date: date.toISOString().split('T')[0],
              timeOfDay:
                hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
            };
          })
          .filter((slot): slot is TimeSlot => slot !== null);
        return [...slots, ...daySlots];
      }
      return slots;
    }, []);

    // Filter slots for requested date
    const requestedDate = bookingDetails.date;
    const dateSlots = allSlots.filter(
      (slot: TimeSlot) => slot.date === requestedDate
    );

    // If no time is specified, just return all available slots
    if (!bookingDetails.time) {
      // Group slots by time of day for better readability
      const groupedSlots = dateSlots.reduce(
        (groups: { [key: string]: string[] }, slot: TimeSlot) => {
          if (!groups[slot.timeOfDay]) {
            groups[slot.timeOfDay] = [];
          }
          groups[slot.timeOfDay].push(slot.formatted);
          return groups;
        },
        {}
      );

      const formatTimeGroups = () => {
        if (dateSlots.length === 0) {
          return `No available slots found for ${requestedDate}.`;
        }

        const timeGroups = [];
        if (groupedSlots.morning?.length) {
          timeGroups.push(`Morning: ${groupedSlots.morning.join(', ')}`);
        }
        if (groupedSlots.afternoon?.length) {
          timeGroups.push(`Afternoon: ${groupedSlots.afternoon.join(', ')}`);
        }
        if (groupedSlots.evening?.length) {
          timeGroups.push(`Evening: ${groupedSlots.evening.join(', ')}`);
        }

        return `Available slots for ${requestedDate}:\n${timeGroups.join(
          '\n'
        )}`;
      };

      return {
        success: true,
        message: formatTimeGroups(),
        requestedTime: '',
        availableSlots: dateSlots.map((slot: TimeSlot) => slot.formatted),
        isReadyToConfirm: false, // Not ready to confirm until specific time is chosen
      };
    }

    // If time is specified, find the closest available slot
    const requestedDateTime = new Date(
      `${bookingDetails.date}T${bookingDetails.time}`
    );

    // Ensure requested time is valid
    if (isNaN(requestedDateTime.getTime())) {
      return {
        success: false,
        message: 'Invalid requested time format.',
        requestedTime: bookingDetails.time,
      };
    }

    const closestSlot = dateSlots.reduce(
      (closest: TimeSlot, current: TimeSlot) => {
        const currentDiff = Math.abs(
          current.time.getTime() - requestedDateTime.getTime()
        );
        const closestDiff = Math.abs(
          closest.time.getTime() - requestedDateTime.getTime()
        );
        return currentDiff < closestDiff ? current : closest;
      },
      dateSlots[0]
    );

    // Return successful API response with closest available slot
    return {
      success: true,
      message: `The closest available slot to your requested time is ${closestSlot.formatted}.`,
      requestedTime: bookingDetails.time,
      selectedTime: closestSlot.formatted,
      availableSlots: dateSlots.map((slot: TimeSlot) => slot.formatted),
      isReadyToConfirm: true,
    };
  } catch (error) {
    console.error('❌ Error:', error);
    return {
      success: false,
      message: 'Unable to check availability at this time. Please try again.',
      requestedTime: bookingDetails.time || '',
    };
  }
}

/**
 * Fallback: Check availability using the agent
 */
export async function checkAvailabilityWithAgent(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<CalendlyResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Checking availability via agent...');
    await page.goto(CALENDLY_CONFIG.EVENT_URL, {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    const agent = stagehand.agent();

    const response = await agent.execute(`
      1. Open the calendar on the page.
      2. Go to the date "${bookingDetails.date}" and if the date is not available then return all available nearest dates.
      3. Check all available time slots around "${bookingDetails.time}".
      4. Return all available times.
    `);

    console.log('✅ Agent check completed');
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
    console.error('❌ Error in agent availability check:', err);
    return {
      success: false,
      message: err.message || 'Failed to check availability',
      requestedTime: bookingDetails.time,
    };
  }
}

/**
 * Format date and time for Calendly URL
 */
function formatCalendlyDateTime(date: string, time: string): string {
  // Convert to timezone-aware format (e.g., 2025-07-30T10:00:00-04:00)
  const dateTime = new Date(`${date}T${time}`);
  const timeZoneOffset = dateTime.getTimezoneOffset();
  const hours = Math.floor(Math.abs(timeZoneOffset) / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (Math.abs(timeZoneOffset) % 60).toString().padStart(2, '0');
  const timeZonePart =
    timeZoneOffset > 0 ? `-${hours}:${minutes}` : `+${hours}:${minutes}`;

  // Format: YYYY-MM-DDTHH:mm:ss±HH:mm
  return `${date}T${time}:00${timeZonePart}`;
}

/**
 * Generate direct Calendly booking URL
 */
function generateBookingUrl(bookingDetails: BookingDetails): string {
  const dateTime = formatCalendlyDateTime(
    bookingDetails.date,
    bookingDetails.time
  );

  // Base URL should be like: https://calendly.com/aadhrik-myaifrontdesk/30min/2025-07-28T16:15:00-04:00
  const baseUrl = `${CALENDLY_CONFIG.EVENT_URL}/${dateTime}`;

  // Add query parameters using URLSearchParams
  const params = new URLSearchParams({
    month: bookingDetails.date.substring(0, 7), // YYYY-MM format
    date: bookingDetails.date,
  });

  // Add optional parameters if they exist
  if (bookingDetails.name) params.append('name', bookingDetails.name);
  if (bookingDetails.email) params.append('email', bookingDetails.email);
  if (bookingDetails.phone) params.append('phone', bookingDetails.phone);

  // Log the generated URL for debugging
  const finalUrl = `${baseUrl}?${params.toString()}`;
  console.log('🔗 Generated booking URL:', finalUrl);
  return finalUrl;
}

/**
 * Book appointment using browser automation with direct URL
 */
export async function bookAppointment(
  stagehand: Stagehand,
  bookingDetails: BookingDetails
): Promise<CalendlyResponse> {
  const { page } = stagehand;

  try {
    console.log('🤖 Booking appointment...');

    // Generate direct booking URL with time slot and user details
    const bookingUrl = generateBookingUrl(bookingDetails);
    console.log('📍 Navigating to booking URL:', bookingUrl);

    // First navigate with basic load
    await page.goto(bookingUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });

    // Then wait for either the form or any error message
    console.log('⏳ Waiting for page to be fully loaded...');
    try {
      await Promise.race([
        page.waitForSelector('form', { timeout: 15000 }),
        page.waitForSelector('.error-message', { timeout: 15000 }),
        page.waitForSelector('.calendar-table', { timeout: 15000 }), // Also check for calendar view
      ]);
    } catch (e) {
      console.warn('⚠️ Timeout waiting for page elements, but continuing...');
    }

    // Take screenshot for debugging
    await page.screenshot({ path: `booking-page-${Date.now()}.png` });

    const agent = stagehand.agent();
    console.log('🤖 Executing booking steps...');

    // Tell agent exactly what page we're on and what to do
    const response = await agent.execute(`
      You are on the Calendly booking page: ${bookingUrl}
      The time slot ${bookingDetails.time} should be pre-selected.
      
      Steps:
      1. Do NOT navigate anywhere - you are already on the correct page
      2. Fill these fields if not already filled:
         - Name: "${bookingDetails.name}"
         - Email: "${bookingDetails.email}"
         - Phone: "${bookingDetails.phone}"
      3. Click the "Schedule Event" button
      4. Wait for confirmation page
      5. Return one of these exact responses:
         - "SUCCESS: Booking confirmed" if successful
         - "ERROR: [specific error message]" if failed
         - "PENDING: [reason]" if unable to determine status
    `);

    // Parse agent response
    console.log('📝 Agent response:', response);
    const responseStr =
      typeof response === 'string' ? response : JSON.stringify(response);

    // Check for specific response formats
    if (responseStr.includes('SUCCESS:')) {
      try {
        await page.screenshot({ path: `booking-confirmed-${Date.now()}.png` });
      } catch (e) {
        console.error('Failed to take confirmation screenshot:', e);
      }
      return {
        success: true,
        message: `Successfully booked for ${bookingDetails.date} at ${bookingDetails.time}`,
        requestedTime: bookingDetails.time,
      };
    }

    if (responseStr.includes('ERROR:')) {
      const errorMessage = responseStr.split('ERROR:')[1].trim();
      return {
        success: false,
        message: `Booking failed: ${errorMessage}`,
        requestedTime: bookingDetails.time,
      };
    }

    if (responseStr.includes('PENDING:')) {
      const pendingReason = responseStr.split('PENDING:')[1].trim();
      return {
        success: false,
        message: `Booking status unclear: ${pendingReason}. Please check your email for confirmation.`,
        requestedTime: bookingDetails.time,
      };
    }

    // If response doesn't match expected format, check page content
    const pageContent = await page.content();
    if (
      pageContent.toLowerCase().includes('confirmed') ||
      pageContent.toLowerCase().includes('scheduled') ||
      pageContent.toLowerCase().includes('success')
    ) {
      return {
        success: true,
        message: `Successfully booked for ${bookingDetails.date} at ${bookingDetails.time}`,
        requestedTime: bookingDetails.time,
      };
    }

    // If we get here, something went wrong
    return {
      success: false,
      message:
        'Unable to confirm if booking was successful. Please check your email for confirmation.',
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
