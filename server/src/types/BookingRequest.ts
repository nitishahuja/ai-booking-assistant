export interface BookingDetails {
  name: string; // Full name of the user making the booking
  email: string; // Email to send the confirmation
  date: string; // Preferred date in YYYY-MM-DD format
  time: string; // Preferred time in HH:mm format (24-hour)
  platform: 'calendly' | 'housecallpro'; // Can be extended in future: 'calendly' | 'google' | 'zoom' etc.
  // Service information for Housecall Pro
  serviceCategory?: string; // e.g., "Plumbing", "Appliances"
  serviceType?: string; // e.g., "Leak Detection", "Drain Cleaning"
  serviceDetails?: string; // Additional details about the service/equipment
  // Contact information
  phone?: string; // Phone number for Housecall Pro
  address?: string; // Service address for Housecall Pro
  meetingNotes?: string;
  guestCount?: number;
  customFields?: { [key: string]: string };
}
