import { z } from 'zod';
import { BookingDetails } from '../types/BookingRequest';

export const validateBookingSchema = {
  name: 'validateBookingDetails',
  description:
    'Validates booking details including name, email, date and time format',
  parameters: z
    .object({
      name: z.string().min(2).describe('Full name of the person booking'),
      email: z.string().email().describe('Valid email address'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Date in YYYY-MM-DD format'),
      time: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .describe('Time in HH:MM format'),
    })
    .describe('Booking details to validate'),
  returnType: z
    .object({
      isValid: z.boolean(),
      errors: z.array(z.string()),
    })
    .describe('Validation result with any error messages'),
};

export function validateBookingDetails(details: BookingDetails): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Name validation
  if (!details.name || details.name.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!details.email || !emailRegex.test(details.email)) {
    errors.push('Invalid email address');
  }

  // Date validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!details.date || !dateRegex.test(details.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  // Time validation
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!details.time || !timeRegex.test(details.time)) {
    errors.push('Time must be in HH:MM format');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
