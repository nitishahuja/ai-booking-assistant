export interface BookingDetails {
  name: string; // Full name of the user making the booking
  email: string; // Email address for confirmation
  date: string; // Preferred date in YYYY-MM-DD format
  time: string; // Preferred time in HH:mm format (24-hour)
  platform: 'calendly' | 'housecallpro' | 'opentable'; // Booking platform
  // Service information for Housecall Pro
  serviceCategory?: string; // e.g., "Plumbing", "Appliances"
  serviceType?: string; // e.g., "Leak Detection", "Drain Cleaning"
  serviceDetails?: string; // Additional details about the service/equipment
  // Contact information
  phone?: string; // Phone number for Housecall Pro and OpenTable
  address?: string; // Service address for Housecall Pro
  // OpenTable specific fields
  partySize?: number; // Number of guests for OpenTable
  occasion?: string; // Special occasion (Birthday, Anniversary, etc.)
  specialRequests?: string; // Special requests or notes
  // Common fields
  meetingNotes?: string;
  guestCount?: number;
  customFields?: { [key: string]: string };
}
