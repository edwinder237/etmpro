import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ical, { type VEvent } from "node-ical";

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window (each request fetches N feeds)
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetTime) rateLimitMap.delete(key);
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const bodySchema = z.object({
  urls: z.array(z.string().url("Invalid calendar URL")).min(1).max(10),
  timezone: z.string().max(50).default("UTC"),
  // Optional explicit window (ISO strings). When omitted, defaults to "today".
  rangeStart: z.string().datetime().optional(),
  rangeEnd: z.string().datetime().optional(),
});

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

export interface CalendarGroup {
  name: string;
  events: CalendarEvent[];
  error: boolean;
}

/**
 * Returns start-of-day and end-of-day in the given IANA timezone as UTC Dates.
 * Uses the toLocaleString trick: parse "now" as a local date string in the target
 * timezone, extract y/m/d, then shift back to UTC.
 */
function getTodayBounds(timezone: string): { todayStart: Date; todayEnd: Date } {
  const now = new Date();
  // Represent now in the user's timezone as a parseable local datetime
  const localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const y = localNow.getFullYear();
  const m = localNow.getMonth();
  const d = localNow.getDate();
  // UTC offset: positive means the timezone is behind UTC (e.g. GMT-4 → +14400000ms)
  const utcOffset = now.getTime() - localNow.getTime();
  return {
    todayStart: new Date(new Date(y, m, d, 0, 0, 0, 0).getTime() + utcOffset),
    todayEnd:   new Date(new Date(y, m, d, 23, 59, 59, 999).getTime() + utcOffset),
  };
}

async function parseFeed(
  url: string,
  index: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarGroup> {
  const fallbackName = `Calendar ${index + 1}`;
  try {
    const feedRes = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "EisenQ Calendar/1.0" },
    });
    if (!feedRes.ok) return { name: fallbackName, events: [], error: true };

    const feedText = await feedRes.text();
    const calendarName = /^X-WR-CALNAME:(.+)$/m.exec(feedText)?.[1]?.trim() ?? fallbackName;
    const allComponents = ical.parseICS(feedText);

    const todayStart = rangeStart;
    const todayEnd = rangeEnd;

    const todayEvents: CalendarEvent[] = [];

    for (const component of Object.values(allComponents)) {
      if (!component || component.type !== "VEVENT") continue;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const event = component as VEvent;

      const start = event.start ? new Date(event.start) : null;
      const end = event.end ? new Date(event.end) : start;
      if (!start) continue;

      const eventTitle = typeof event.summary === "string" ? event.summary : "Untitled";
      const eventLocation = typeof event.location === "string" ? event.location : undefined;

      if (event.rrule) {
        const duration = end ? end.getTime() - start.getTime() : 0;
        const occurrences = event.rrule.between(todayStart, todayEnd, true);
        for (const occ of occurrences) {
          todayEvents.push({
            id: `${event.uid ?? ""}-${occ.toISOString()}`,
            title: eventTitle,
            start: occ.toISOString(),
            end: new Date(occ.getTime() + duration).toISOString(),
            allDay: event.datetype === "date",
            location: eventLocation,
          });
        }
        continue;
      }

      const eventEnd = end ?? start;
      if (start <= todayEnd && eventEnd >= todayStart) {
        todayEvents.push({
          id: String(event.uid ?? start.toISOString()),
          title: eventTitle,
          start: start.toISOString(),
          end: eventEnd.toISOString(),
          allDay: event.datetype === "date",
          location: eventLocation,
        });
      }
    }

    todayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return { name: calendarName, events: todayEvents, error: false };
  } catch {
    return { name: fallbackName, events: [], error: true };
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { timezone, rangeStart, rangeEnd } = parsed.data;

    let start: Date;
    let end: Date;
    if (rangeStart && rangeEnd) {
      start = new Date(rangeStart);
      end = new Date(rangeEnd);
    } else {
      const bounds = getTodayBounds(timezone);
      start = bounds.todayStart;
      end = bounds.todayEnd;
    }

    const groups = await Promise.all(parsed.data.urls.map((url, i) => parseFeed(url, i, start, end)));

    // POST responses are user-specific — must not be cached by CDN
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Calendar feeds API error:", err);
    return NextResponse.json({ error: "Failed to fetch calendar feeds" }, { status: 500 });
  }
}
