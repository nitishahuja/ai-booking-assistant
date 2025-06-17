import { z } from 'zod';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.extend(isoWeek);

// Common date formats we can parse directly
const commonFormats = [
  'YYYY-MM-DD',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'MMMM D', // June 19
  'MMMM D YYYY', // June 19 2024
  'D MMMM', // 19 June
  'D MMMM YYYY', // 19 June 2024
  'MMM D', // Jun 19
  'MMM D YYYY', // Jun 19 2024
  'D MMM', // 19 Jun
  'D MMM YYYY', // 19 Jun 2024
];

// Map of weekday names to numbers (0 = Sunday, 6 = Saturday)
const weekdayMap: { [key: string]: number } = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parseRelativeDate(dateStr: string): dayjs.Dayjs | null {
  const lowercaseStr = dateStr.toLowerCase().trim();

  // Handle "next week day" patterns
  const nextWeekdayMatch = lowercaseStr.match(
    /next\s+(sun|mon|tues|wednes|thurs|fri|satur)day/
  );
  if (nextWeekdayMatch) {
    const dayName = nextWeekdayMatch[1] + 'day';
    const targetDay = weekdayMap[dayName];
    if (targetDay !== undefined) {
      const today = dayjs();
      let nextOccurrence = today.day(targetDay + 7); // +7 ensures we get next week's occurrence
      return nextOccurrence;
    }
  }

  // Handle "this week day" patterns
  const thisWeekdayMatch = lowercaseStr.match(
    /this\s+(sun|mon|tues|wednes|thurs|fri|satur)day/
  );
  if (thisWeekdayMatch) {
    const dayName = thisWeekdayMatch[1] + 'day';
    const targetDay = weekdayMap[dayName];
    if (targetDay !== undefined) {
      const today = dayjs();
      let thisOccurrence = today.day(targetDay);
      if (thisOccurrence.isBefore(today)) {
        thisOccurrence = thisOccurrence.add(7, 'day');
      }
      return thisOccurrence;
    }
  }

  // Handle common relative terms
  switch (lowercaseStr) {
    case 'today':
      return dayjs();
    case 'tomorrow':
      return dayjs().add(1, 'day');
    case 'day after tomorrow':
      return dayjs().add(2, 'day');
  }

  // Handle "next week"
  if (lowercaseStr.includes('next week')) {
    // If a specific day is mentioned
    const dayMatch = lowercaseStr.match(
      /next week\s+(on\s+)?(sun|mon|tues|wednes|thurs|fri|satur)day/
    );
    if (dayMatch) {
      const dayName = dayMatch[2] + 'day';
      const targetDay = weekdayMap[dayName];
      if (targetDay !== undefined) {
        return dayjs().add(1, 'week').day(targetDay);
      }
    }
    // If no specific day mentioned, assume same day next week
    return dayjs().add(1, 'week');
  }

  return null;
}

export const dateSchema = {
  name: 'normalizeBookingDate',
  description: 'Validate and normalize a date string into a consistent format',
  parameters: z.object({
    dateStr: z.string().describe('The date string to normalize'),
  }),
};

export function normalizeBookingDate({ dateStr }: { dateStr: string }) {
  // Try to parse relative dates first
  const relativeDate = parseRelativeDate(dateStr);
  if (relativeDate) {
    return {
      date: relativeDate.format('YYYY-MM-DD'),
      isValid: true,
      wasAmbiguous: false,
    };
  }

  // Try to parse with common formats
  for (const format of commonFormats) {
    const parsed = dayjs(dateStr, format);
    if (parsed.isValid()) {
      // If year is not specified, assume it's this year or next year
      if (!dateStr.includes(parsed.year().toString())) {
        const thisYear = dayjs().year();
        const withThisYear = parsed.year(thisYear);
        const withNextYear = parsed.year(thisYear + 1);

        // Use next year if this year's date would be in the past
        const finalDate = withThisYear.isBefore(dayjs())
          ? withNextYear
          : withThisYear;
        return {
          date: finalDate.format('YYYY-MM-DD'),
          isValid: true,
          wasAmbiguous: false,
        };
      }

      return {
        date: parsed.format('YYYY-MM-DD'),
        isValid: true,
        wasAmbiguous: false,
      };
    }
  }

  // If we can't parse it with any format, it might be ambiguous
  return {
    date: dateStr,
    isValid: false,
    wasAmbiguous: true,
    message:
      'Could not parse date. Please provide date in a clearer format like:\n' +
      '- Exact date (e.g., "June 19 2024" or "2024-06-19")\n' +
      '- Relative date (e.g., "next Wednesday", "tomorrow")\n' +
      '- This/next week (e.g., "this Monday", "next week Wednesday")',
  };
}
