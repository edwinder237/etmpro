// Calendar export utilities for Google, Microsoft, Apple calendars

interface CalendarEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
}

// Format date for ICS file (YYYYMMDDTHHMMSS)
function formatDateForICS(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

// Format date for Google Calendar URL (YYYYMMDDTHHMMSSZ in UTC)
function formatDateForGoogle(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Format date for Outlook URL (ISO format)
function formatDateForOutlook(date: Date): string {
  return date.toISOString();
}

// Generate ICS file content
export function generateICSFile(event: CalendarEvent): string {
  const now = new Date();
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@etm`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ETM Task Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateForICS(now)}`,
    `DTSTART:${formatDateForICS(event.startDate)}`,
    `DTEND:${formatDateForICS(event.endDate)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeICSText(event.description)}` : '',
    event.location ? `LOCATION:${escapeICSText(event.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  return icsContent;
}

// Escape special characters for ICS format
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Download ICS file (works for Apple Calendar and most calendar apps)
export function downloadICSFile(event: CalendarEvent): void {
  const icsContent = generateICSFile(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | null = null;

  try {
    link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
  } finally {
    // Ensure cleanup happens even if click() throws
    if (link?.parentNode) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }
}

// Generate Google Calendar URL
export function generateGoogleCalendarURL(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDateForGoogle(event.startDate)}/${formatDateForGoogle(event.endDate)}`,
    details: event.description ?? '',
    location: event.location ?? '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Generate Outlook Calendar URL (Outlook.com / Office 365)
export function generateOutlookCalendarURL(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatDateForOutlook(event.startDate),
    enddt: formatDateForOutlook(event.endDate),
    body: event.description ?? '',
    location: event.location ?? '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Generate Office 365 Calendar URL
export function generateOffice365CalendarURL(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatDateForOutlook(event.startDate),
    enddt: formatDateForOutlook(event.endDate),
    body: event.description ?? '',
    location: event.location ?? '',
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Generate Yahoo Calendar URL
export function generateYahooCalendarURL(event: CalendarEvent): string {
  const duration = Math.round((event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60)); // in minutes
  const durationHours = String(Math.floor(duration / 60)).padStart(2, '0');
  const durationMinutes = String(duration % 60).padStart(2, '0');

  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: formatDateForGoogle(event.startDate).replace('Z', ''),
    dur: `${durationHours}${durationMinutes}`,
    desc: event.description ?? '',
    in_loc: event.location ?? '',
  });

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

// Export types
export type CalendarProvider = 'google' | 'outlook' | 'office365' | 'yahoo' | 'ics';

// Open calendar URL or download ICS
export function addToCalendar(event: CalendarEvent, provider: CalendarProvider): void {
  switch (provider) {
    case 'google':
      window.open(generateGoogleCalendarURL(event), '_blank');
      break;
    case 'outlook':
      window.open(generateOutlookCalendarURL(event), '_blank');
      break;
    case 'office365':
      window.open(generateOffice365CalendarURL(event), '_blank');
      break;
    case 'yahoo':
      window.open(generateYahooCalendarURL(event), '_blank');
      break;
    case 'ics':
      downloadICSFile(event);
      break;
  }
}
