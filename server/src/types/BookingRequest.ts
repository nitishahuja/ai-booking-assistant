export interface BookingDetails {
  name: string; // Full name of the user making the booking
  email: string; // Email to send the confirmation
  date: string; // Preferred date in YYYY-MM-DD format
  time: string; // Preferred time in HH:mm format (24-hour)
  platform: 'calendly'; // Can be extended in future: 'calendly' | 'google' | 'zoom' etc.
}
