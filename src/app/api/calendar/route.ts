import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ical, { type VEvent } from "node-ical";

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
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

const querySchema = z.object({
  url: z.string().url("Invalid calendar URL"),
});

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = querySchema.safeParse({
      url: req.nextUrl.searchParams.get("url"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    // Fetch the iCal feed server-side (avoids CORS issues)
    const feedRes = await fetch(parsed.data.url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "EisenQ Calendar/1.0" },
    });
    if (!feedRes.ok) {
      return NextResponse.json({ error: "Could not fetch calendar feed" }, { status: 502 });
    }

    const feedText = await feedRes.text();
    const allEvents = ical.parseICS(feedText);

    // Extract calendar display name from X-WR-CALNAME (non-standard but widely supported)
    const calendarName = /^X-WR-CALNAME:(.+)$/m.exec(feedText)?.[1]?.trim();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const todayEvents: CalendarEvent[] = [];

    for (const component of Object.values(allEvents)) {
      if (!component || component.type !== "VEVENT") continue;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const event = component as VEvent;

      const start = event.start ? new Date(event.start) : null;
      const end = event.end ? new Date(event.end) : start;
      if (!start) continue;

      const eventTitle = typeof event.summary === "string" ? event.summary : "Untitled";
      const eventLocation = typeof event.location === "string" ? event.location : undefined;

      // Handle recurring events
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

      // Single event — check if it overlaps with today
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

    return NextResponse.json(
      { events: todayEvents, calendarName },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("Calendar API error:", err);
    return NextResponse.json({ error: "Failed to parse calendar feed" }, { status: 500 });
  }
}
