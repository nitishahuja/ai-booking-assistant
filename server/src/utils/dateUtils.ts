export function normalizeBookingDate(dateStr: string): string {
  const parsed = new Date(dateStr);

  // If year is wrong or invalid, fallback to current year
  const now = new Date();
  if (isNaN(parsed.getTime()) || parsed.getFullYear() < now.getFullYear()) {
    parsed.setFullYear(now.getFullYear());
  }

  // Format as YYYY-MM-DD
  return parsed.toISOString().split('T')[0];
}
